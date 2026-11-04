import type { ModelMessage } from "./ModelMessage.js";
import type { ModelToolDefinition } from "./ModelTool.js";

export type ReasoningEffort =
    | "none"
    | "low"
    | "medium"
    | "high"
    | "xhigh"
    | "auto";

export interface ModelRequest {
    model: string;
    messages: ModelMessage[];
    tools?: ModelToolDefinition[];
    temperature?: number;
    maxOutputTokens?: number;
    reasoningEffort?: ReasoningEffort;
    metadata?: Record<string, unknown>;
}