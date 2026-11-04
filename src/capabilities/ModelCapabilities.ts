import type { ReasoningEffort } from "../protocol/ModelRequest.js";

export interface ModelCapabilities {
    streaming: boolean;
    toolCalling: boolean;
    vision: boolean;
    imageGeneration: boolean;
    reasoning: boolean;
    structuredOutput: boolean;
    multimodal: boolean;
    cancellation: boolean;
    reasoningEfforts: ReasoningEffort[];
    maxContextTokens?: number;
    maxOutputTokens?: number;
}

export const DEFAULT_CAPABILITIES: ModelCapabilities = {
    streaming: false,
    toolCalling: false,
    vision: false,
    imageGeneration: false,
    reasoning: false,
    structuredOutput: false,
    multimodal: false,
    cancellation: true,
    reasoningEfforts: []
};

export const OPENAI_COMPATIBLE_DEFAULTS: ModelCapabilities = {
    streaming: true,
    toolCalling: true,
    vision: false,
    imageGeneration: false,
    reasoning: false,
    structuredOutput: false,
    multimodal: false,
    cancellation: true,
    reasoningEfforts: []
};