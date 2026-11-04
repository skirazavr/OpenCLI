import type { ModelProvider } from "./ModelProvider.js";
import type { ProviderConfig } from "./ProviderConfig.js";
import { Config } from "../config/Config.js";
import { OpenAICompatibleAdapter } from "./adapters/OpenAICompatibleAdapter.js";

export class ProviderFactory {
    static create(providerId: string = Config.providerName): ModelProvider {
        const id = providerId
            .trim()
            .toLowerCase()
            .replace(/[-_]+/g, " ")
            .replace(/\s+/g, " ");

        const config = this.createConfig(id, providerId);

        switch (config.protocol) {
            case "openai-compatible":
                return new OpenAICompatibleAdapter(config);
            case "anthropic":
                throw new Error("Anthropic adapter is not implemented yet");
            case "gemini":
                throw new Error("Gemini adapter is not implemented yet");
            case "ollama":
                throw new Error("Ollama adapter is not implemented yet");
            default:
                throw new Error(`Unsupported AI provider: ${providerId}`);
        }
    }

    private static createConfig(id: string, name: string): ProviderConfig {
        switch (id) {
            case "anymodel":
            case "openai":
            case "openrouter":
            case "custom api":
            case "local api":
                return {
                    id,
                    name,
                    protocol: "openai-compatible",
                    apiKey: Config.apiKey,
                    baseURL: Config.baseURL,
                    defaultModel: Config.model,
                    timeout: 60_000
                };
            default:
                throw new Error(`Unsupported AI provider: ${name}`);
        }
    }
}