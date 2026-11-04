import OpenAI from "openai";
import { OPENAI_COMPATIBLE_DEFAULTS } from "../../capabilities/ModelCapabilities.js";
import type { ModelProvider } from "../ModelProvider.js";
import type { ProviderConfig } from "../ProviderConfig.js";
import type { ModelMessage, ModelContent, ModelContentPart } from "../../protocol/ModelMessage.js";
import type { ModelRequest } from "../../protocol/ModelRequest.js";
import type { ModelResponse } from "../../protocol/ModelResponse.js";
import type { ModelToolDefinition } from "../../protocol/ModelTool.js";
import type { ProviderEvent } from "../../protocol/ProviderEvent.js";

export class OpenAICompatibleAdapter implements ModelProvider {
    readonly id: string;
    readonly displayName: string;
    readonly capabilities = OPENAI_COMPATIBLE_DEFAULTS;
    private readonly client: OpenAI;
    private readonly config: ProviderConfig;

    constructor(config: ProviderConfig) {
        this.config = config;
        this.id = config.id;
        this.displayName = config.name;
        this.client = new OpenAI({
            apiKey: config.apiKey ?? "no-api-key",
            baseURL: config.baseURL,
            organization: config.organization,
            project: config.project,
            timeout: config.timeout,
            defaultHeaders: config.headers
        });
    }

    async chat(request: ModelRequest, signal?: AbortSignal): Promise<ModelResponse> {
        const messages = request.messages.map(message =>
            this.toOpenAIMessage(message)
        );

        const tools = request.tools?.map(tool =>
            this.toOpenAITool(tool)
        );

        const payload = {
            model: request.model || this.config.defaultModel,
            messages,
            ...(tools && tools.length > 0
                ? {
                    tools,
                    tool_choice: "auto" as const
                }
                : {}),
            ...(request.temperature !== undefined
                ? { temperature: request.temperature }
                : {}),
            ...(request.maxOutputTokens !== undefined
                ? {
                    max_completion_tokens:
                    request.maxOutputTokens
                }
                : {}),
            ...(request.reasoningEffort &&
            request.reasoningEffort !== "auto" &&
            request.reasoningEffort !== "none"
                ? {
                    reasoning_effort:
                    request.reasoningEffort
                }
                : {})
        } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming;

        const completion =
            await this.client.chat.completions.create(
                payload,
                { signal }
            );

        const choice = completion.choices[0];

        if (!choice) {
            throw new Error("The provider returned an empty completion");
        }

        const message = choice.message;

        return {
            content: message.content,
            toolCalls: (message.tool_calls ?? [])
                .filter(call => call.type === "function")
                .map(call => ({
                    id: call.id,
                    name: call.function.name,
                    arguments: call.function.arguments
                })),
            finishReason: choice.finish_reason ?? undefined,

            usage: completion.usage
                ? {
                    inputTokens:
                    completion.usage.prompt_tokens,
                    outputTokens:
                    completion.usage.completion_tokens,
                    totalTokens:
                    completion.usage.total_tokens,
                    cachedInputTokens:
                    completion.usage.prompt_tokens_details
                        ?.cached_tokens
                }
                : undefined,
            providerMetadata: {
                id: completion.id,
                model: completion.model,
                provider: this.displayName
            }
        };
    }

    async *stream(request: ModelRequest, signal?: AbortSignal): AsyncIterable<ProviderEvent> {
        try {
            const messages = request.messages.map(message =>
                this.toOpenAIMessage(message)
            );
            const tools = request.tools?.map(tool =>
                this.toOpenAITool(tool)
            );
            const payload = {
                model: request.model || this.config.defaultModel,
                messages,
                stream: true as const,
                stream_options: {
                    include_usage: true
                },
                ...(tools && tools.length > 0
                    ? {
                        tools,
                        tool_choice: "auto" as const
                    }
                    : {}),
                ...(request.temperature !== undefined
                    ? { temperature: request.temperature }
                    : {}),
                ...(request.maxOutputTokens !== undefined
                    ? {
                        max_completion_tokens:
                        request.maxOutputTokens
                    }
                    : {}),
                ...(request.reasoningEffort &&
                request.reasoningEffort !== "auto" &&
                request.reasoningEffort !== "none"
                    ? {
                        reasoning_effort:
                        request.reasoningEffort
                    }
                    : {})
            } as OpenAI.Chat.ChatCompletionCreateParamsStreaming;
            const stream =
                await this.client.chat.completions.create(payload, { signal });
            for await (const chunk of stream) {
                if (signal?.aborted) {
                    throw signal.reason ??

                    new DOMException("Request aborted", "AbortError");
                }

                const choice = chunk.choices[0];

                if (choice) {
                    const delta = choice.delta;

                    if (delta.content) {
                        yield {
                            type: "text_delta",
                            text: delta.content
                        };
                    }

                    for (const toolCall of delta.tool_calls ?? []) {
                        yield {
                            type: "tool_call_delta",
                            index: toolCall.index,
                            ...(toolCall.id
                                ? { id: toolCall.id }
                                : {}),
                            ...(toolCall.function?.name
                                ? { name: toolCall.function.name }
                                : {}),
                            ...(toolCall.function?.arguments
                                ? {
                                    argumentsDelta:
                                    toolCall.function.arguments
                                }
                                : {})
                        };
                    }

                    if (choice.finish_reason) {
                        yield {
                            type: "completed",
                            finishReason: choice.finish_reason
                        };
                    }
                }

                if (chunk.usage) {
                    yield {
                        type: "usage",
                        usage: {
                            inputTokens: chunk.usage.prompt_tokens,
                            outputTokens: chunk.usage.completion_tokens,
                            totalTokens: chunk.usage.total_tokens,
                            cachedInputTokens:
                            chunk.usage.prompt_tokens_details
                                ?.cached_tokens
                        }
                    };
                }
            }
        } catch (error: unknown) {
            yield {
                type: "error",
                error
            };
        }
    }

    private toOpenAIMessage(message: ModelMessage): OpenAI.Chat.ChatCompletionMessageParam {
        const content = this.toOpenAIContent(message.content);

        switch (message.role) {
            case "system":
                if (typeof content !== "string") {
                    throw new Error(
                        "System messages must contain text"
                    );
                }

                return {
                    role: "system",
                    content
                };
            case "user":
                return {
                    role: "user",
                    content
                };
            case "assistant":
                if (typeof content !== "string") {
                    throw new Error(
                        "Assistant messages must contain text"
                    );
                }

                return {
                    role: "assistant",
                    content,
                    ...(message.toolCalls?.length
                        ? {
                            tool_calls: message.toolCalls.map(call => ({
                                id: call.id,
                                type: "function" as const,
                                function: {
                                    name: call.name,
                                    arguments: call.arguments
                                }
                            }))
                        }
                        : {})
                };
            case "tool":
                if (!message.toolCallId) {
                    throw new Error(
                        "Tool message must contain toolCallId"
                    );
                }

                if (typeof content !== "string") {
                    throw new Error(
                        "Tool messages must contain text"
                    );
                }

                return {
                    role: "tool",
                    tool_call_id: message.toolCallId,
                    content
                };
            default:
                throw new Error(`Unsupported message role: ${String(message.role)}`);
        }
    }

    private toOpenAIContent(content: ModelContent): string | OpenAI.Chat.ChatCompletionContentPart[] {
        if (typeof content === "string") {
            return content;
        }

        return content.map(part =>
            this.toOpenAIContentPart(part)
        );
    }

    private toOpenAIContentPart(part: ModelContentPart): OpenAI.Chat.ChatCompletionContentPart {
        switch (part.type) {
            case "text":
                return {
                    type: "text",
                    text: part.text
                };
            case "image":
                if (part.source.type === "url") {
                    return {
                        type: "image_url",
                        image_url: {
                            url: part.source.url
                        }
                    };
                }

                return {
                    type: "image_url",
                    image_url: {
                        url: `data:${part.source.mediaType};base64,${part.source.data}`
                    }
                };
            case "file":
                throw new Error("File content parts are not supported by this adapter");
        }
    }

    private toOpenAITool(tool: ModelToolDefinition): OpenAI.Chat.ChatCompletionTool {
        return {
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters
            }
        };
    }
}
