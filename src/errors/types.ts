export type ErrorCategory =
    | "authentication"
    | "permission"
    | "payment"
    | "request"
    | "rate_limit"
    | "timeout"
    | "server"
    | "network"
    | "unknown";

export interface ParsedError {
    status: number | null;
    code: string | null;
    type: string | null;
    message: string;
    providerMessage: string | null;
    requestId: string | null;
}

export interface ErrorAnalysis {
    category: ErrorCategory;
    title: string;
    description: string;
    recommendation: string;
    status: number | null;
    code: string | null;
    type: string | null;
    message: string;
    providerMessage: string | null;
    provider: string;
    model: string;
    requestId: string | null;
    retryable: boolean;
}