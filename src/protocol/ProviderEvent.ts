import type { ModelUsage } from "./ModelResponse.js";

export type ProviderEvent =
    | {
    type: "text_delta";
    text: string;
}
    | {
    type: "reasoning_summary_delta";
    text: string;
}
    | {
    type: "tool_call_delta";
    index: number;
    id?: string;
    name?: string;
    argumentsDelta?: string;
}
    | {
    type: "usage";
    usage: ModelUsage;
}
    | {
    type: "completed";
    finishReason?: string;
}
    | {
    type: "error";
    error: unknown;
};

export type AgentEvent =
    | {
    type: "request_started";
    model?: string;
    provider: string;
    iteration: number;
}
    | {
    type: "request_completed";
    finishReason?: string;
}
    | {
    type: "response_delta";
    text: string;
}
    | {
    type: "thinking_started";
}
    | {
    type: "tool_requested";
    name: string;
    arguments: unknown;
}
    | {
    type: "approval_required";
    name: string;
    arguments: unknown;
}
    | {
    type: "tool_started";
    name: string;
    arguments: unknown;
}
    | {
    type: "tool_completed";
    name: string;
    result: string;
}
    | {
    type: "tool_rejected";
    name: string;
}
    | {
    type: "tool_failed";
    name: string;
    error: string;
}
    | {
    type: "file_read";
    path: string;
}
    | {
    type: "file_changed";
    path: string;
}
    | {
    type: "iteration_limit";
    limit: number;
}
    | {
    type: "completed";
    iterations: number;
}
    | {
    type: "error";
    error: unknown;
};
