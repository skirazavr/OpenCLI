import type { ModelProvider } from "../providers/ModelProvider.js";
import type { ModelMessage, ModelToolCall } from "../protocol/ModelMessage.js";
import type { ModelRequest } from "../protocol/ModelRequest.js";
import type { ModelResponse } from "../protocol/ModelResponse.js";
import type { AgentEvent } from "../protocol/ProviderEvent.js";
import type { ToolRegistry, ApprovalHandler } from "../tools/ToolRegistry.js";

export interface AgentResult {
    answer: string;
    messages: ModelMessage[];
    iterations: number;
}

type AgentEventHandler = (event: AgentEvent) => void;

export class AgentLoop {
    private readonly maxIterations = 20;

    constructor(private readonly provider: ModelProvider, private readonly registry: ToolRegistry, private readonly approve: ApprovalHandler) {
    }

    async run(history: ModelMessage[], userMessage: string, signal?: AbortSignal, onEvent?: AgentEventHandler): Promise<AgentResult> {
        const messages: ModelMessage[] = [
            ...history,
            {
                role: "user",
                content: userMessage
            }
        ];

        const tools = this.registry.getDefinitions();

        try {
            for (let iteration = 1; iteration <= this.maxIterations; iteration++) {
                this.throwIfAborted(signal);

                const request: ModelRequest = {
                    messages,
                    ...(tools.length > 0 ? { tools } : {})
                };

                onEvent?.({
                    type: "request_started",
                    provider: this.provider.displayName,
                    iteration
                });

                const response = await this.requestModel(request, signal, onEvent);

                onEvent?.({
                    type: "request_completed",
                    finishReason: response.finishReason
                });

                const assistantMessage: ModelMessage = {
                    role: "assistant",
                    content: response.content ?? "",
                    ...(response.toolCalls.length > 0
                        ? { toolCalls: response.toolCalls }
                        : {})
                };

                messages.push(assistantMessage);

                if (response.toolCalls.length === 0) {
                    const answer = this.extractAnswer(response.content);

                    onEvent?.({
                        type: "completed",
                        iterations: iteration
                    });

                    return {
                        answer,
                        messages,
                        iterations: iteration
                    };
                }

                for (const toolCall of response.toolCalls) {
                    this.throwIfAborted(signal);

                    await this.executeTool(toolCall, messages, signal, onEvent);
                }
            }

            onEvent?.({
                type: "iteration_limit",
                limit: this.maxIterations
            });

            return {
                answer: "Достигнут предел итераций агента",
                messages,
                iterations: this.maxIterations
            };
        } catch (error: unknown) {
            onEvent?.({
                type: "error",
                error
            });

            throw error;
        }
    }

    private async executeTool(toolCall: ModelToolCall, messages: ModelMessage[], signal?: AbortSignal, onEvent?: AgentEventHandler): Promise<void> {
        this.throwIfAborted(signal);

        let args: unknown;

        try {
            args = JSON.parse(toolCall.arguments);
        } catch {
            args = toolCall.arguments;
        }

        onEvent?.({
            type: "tool_requested",
            name: toolCall.name,
            arguments: args
        });

        try {
            let rejected = false;

            const result = await this.registry.execute(
                toolCall.name,
                toolCall.arguments,
                async (name, arguments_) => {
                    onEvent?.({
                        type: "approval_required",
                        name,
                        arguments: arguments_
                    });

                    return this.approve(name, arguments_);
                },
                {
                    onStarted: (name, arguments_) => {
                        onEvent?.({
                            type: "tool_started",
                            name,
                            arguments: arguments_
                        });
                    },
                    onRejected: name => {
                        rejected = true;

                        onEvent?.({
                            type: "tool_rejected",
                            name
                        });
                    }
                }
            );

            this.throwIfAborted(signal);

            messages.push({
                role: "tool",
                toolCallId: toolCall.id,
                content: result
            });

            if (!rejected) {
                onEvent?.({
                    type: "tool_completed",
                    name: toolCall.name,
                    result
                });
            }
        } catch (error: unknown) {
            const errorMessage = this.getErrorMessage(error);

            messages.push({
                role: "tool",
                toolCallId: toolCall.id,
                content: `Error: ${errorMessage}`
            });

            onEvent?.({
                type: "tool_failed",
                name: toolCall.name,
                error: errorMessage
            });
        }
    }

    private async requestModel(request: ModelRequest, signal?: AbortSignal, onEvent?: AgentEventHandler): Promise<ModelResponse> {
        if (this.provider.capabilities.streaming && this.provider.stream) {
            return this.requestStream(request, signal, onEvent);
        }

        const response = await this.provider.chat(request, signal);

        if (response.content) {
            onEvent?.({
                type: "response_delta",
                text: response.content
            });
        }

        return response;
    }

    private async requestStream(request: ModelRequest, signal?: AbortSignal, onEvent?: AgentEventHandler): Promise<ModelResponse> {
        let content = "";
        let finishReason: string | undefined;
        let usage: ModelResponse["usage"];
        let thinkingStarted = false;

        const toolCalls = new Map<number, {
            id: string;
            name: string;
            arguments: string;
        }>();

        const stream = this.provider.stream!(request, signal);

        for await (const event of stream) {
            this.throwIfAborted(signal);

            switch (event.type) {
                case "text_delta":
                    content += event.text;

                    onEvent?.({
                        type: "response_delta",
                        text: event.text
                    });

                    break;
                case "reasoning_summary_delta":
                    if (!thinkingStarted) {
                        thinkingStarted = true;

                        onEvent?.({
                            type: "thinking_started"
                        });
                    }

                    break;
                case "tool_call_delta": {
                    const current = toolCalls.get(event.index) ?? {
                        id: "",
                        name: "",
                        arguments: ""
                    };

                    if (event.id) {
                        current.id = event.id;
                    }

                    if (event.name) {
                        current.name = event.name;
                    }

                    if (event.argumentsDelta) {
                        current.arguments += event.argumentsDelta;
                    }

                    toolCalls.set(event.index, current);

                    break;
                }
                case "usage":
                    usage = event.usage;

                    break;
                case "completed":
                    finishReason = event.finishReason;

                    break;
                case "error":
                    throw event.error instanceof Error
                        ? event.error
                        : new Error(String(event.error));
            }
        }

        const completedToolCalls: ModelToolCall[] = [];

        for (const toolCall of toolCalls.values()) {
            if (!toolCall.id || !toolCall.name) {
                throw new Error("Incomplete tool call received from provider");
            }

            completedToolCalls.push({
                id: toolCall.id,
                name: toolCall.name,
                arguments: toolCall.arguments || "{}"
            });
        }

        return {
            content,
            toolCalls: completedToolCalls,
            finishReason,
            usage
        };
    }

    private throwIfAborted(signal?: AbortSignal): void {
        if (signal?.aborted) {
            throw new Error("Agent execution was aborted");
        }
    }

    private getErrorMessage(error: unknown): string {
        return error instanceof Error
            ? error.message
            : String(error);
    }

    private extractAnswer(content: string | null): string {
        return content?.trim() || "Модель не вернула текстовый ответ";
    }
}
