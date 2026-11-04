import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
    apiKey: z.string().default(""),
    baseURL: z.url(),
    model: z.string().min(1),
    provider: z.string().optional(),
    maxIterations: z.coerce.number().int().min(1).max(1000).default(100)
});

const result = configSchema.safeParse({
    apiKey: process.env.OPENCLI_API_KEY ?? "",
    baseURL: process.env.OPENCLI_BASE_URL,
    model: process.env.OPENCLI_MODEL,
    provider: process.env.OPENCLI_PROVIDER,
    maxIterations: process.env.OPENCLI_MAX_ITERATIONS
});

if (!result.success) {
    throw new Error(`Invalid configuration:\n${z.prettifyError(result.error)}`);
}

export const Config = Object.freeze({
    apiKey: result.data.apiKey,
    baseURL: result.data.baseURL,
    model: result.data.model,
    providerName: result.data.provider?.trim() || detectProviderName(result.data.baseURL),
    maxIterations: result.data.maxIterations
});

function detectProviderName(baseURL: string): string {
    let hostname: string;

    try {
        hostname = new URL(baseURL).hostname.toLowerCase();
    } catch {
        return "Custom API";
    }

    if (hostname.includes("anymodel")) {
        return "AnyModel";
    }

    if (hostname === "api.openai.com" || hostname.endsWith(".openai.com")) {
        return "OpenAI";
    }

    if (hostname.includes("openrouter")) {
        return "OpenRouter";
    }

    if (hostname.includes("anthropic")) {
        return "Anthropic";
    }

    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
        return "Local API";
    }

    return hostname;
}
