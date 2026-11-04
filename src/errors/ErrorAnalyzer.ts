import { getErrorDefinition } from "./ErrorCatalog.js";
import { parseError } from "./ErrorParser.js";
import type { ErrorAnalysis } from "./types.js";

interface ErrorAnalyzerOptions {
    provider?: string;
    model?: string;
}

export function analyzeError(error: unknown, options: ErrorAnalyzerOptions = {}): ErrorAnalysis {
    const parsed = parseError(error);
    const definition = getErrorDefinition(parsed.status);
    const errorName = typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";

    let category = definition.category;
    let title = definition.title;
    let description = definition.description;
    let recommendation = definition.recommendation;
    let retryable = definition.retryable;

    if (parsed.status === null) {
        if (errorName.includes("Timeout") || errorName.includes("Abort")) {
            category = "timeout";
            title = "REQUEST TIMEOUT";
            description = "The request did not complete within the allotted time";
            recommendation = "Check your network connection, client timeout settings, and API availability";
            retryable = true;
        } else if (
            errorName.includes("Connection") ||
            errorName.includes("Network") ||
            errorName.includes("Fetch")
        ) {
            category = "network";
            title = "CONNECTION ERROR";
            description = "Unable to establish or maintain a connection to the API";
            recommendation = "Check your internet connection, DNS settings, proxy configuration, and provider base URL";
            retryable = true;
        }
    }

    return {
        category,
        title,
        description,
        recommendation,
        status: parsed.status,
        code: parsed.code,
        type: parsed.type,
        message: parsed.message,
        providerMessage: parsed.providerMessage,
        provider: options.provider ?? "Unknown provider",
        model: options.model ?? "Unknown model",
        requestId: parsed.requestId,
        retryable
    };
}