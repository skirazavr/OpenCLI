import type { ModelToolCall } from "./ModelMessage.js";

export interface ModelUsage {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    cachedInputTokens?: number;
}

export interface ModelResponse {
    content: string | null;
    toolCalls: ModelToolCall[];
    finishReason?: string;
    usage?: ModelUsage;
    providerMetadata?: Record<string, unknown>;
}