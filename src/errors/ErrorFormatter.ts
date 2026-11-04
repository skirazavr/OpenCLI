import type { ErrorAnalysis } from "./types.js";

export function formatError(analysis: ErrorAnalysis): string {
    const status = analysis.status !== null
        ? `HTTP ${analysis.status}`
        : "NO HTTP STATUS";

    const lines = [
        `ERROR ${status} · ${analysis.title}`,
        "",
        `Provider: ${analysis.provider}`,
        `Model: ${analysis.model}`,
        `Category: ${analysis.category}`
    ];

    if (analysis.code) {
        lines.push(`Code: ${analysis.code}`);
    }

    if (analysis.type) {
        lines.push(`Type: ${analysis.type}`);
    }

    lines.push(
        "",
        "Description:",
        analysis.description,
        "",
        "Provider message:",
        analysis.providerMessage ?? analysis.message,
        "",
        "Recommendation:",
        analysis.recommendation,
        "",
        `Retryable: ${analysis.retryable ? "Yes" : "No"}`
    );

    if (analysis.requestId) {
        lines.push(`Request ID: ${analysis.requestId}`);
    }

    return lines.join("\n");
}