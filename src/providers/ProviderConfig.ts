export type ProviderProtocol =
    | "openai-compatible"
    | "anthropic"
    | "gemini"
    | "ollama";

export interface ProviderConfig {
    id: string;
    name: string;
    protocol: ProviderProtocol;
    baseURL: string;
    apiKey?: string;
    defaultModel: string;
    organization?: string;
    project?: string;
    timeout?: number;
    headers?: Record<string, string>;
}