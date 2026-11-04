import type { ErrorCategory } from "./types.js";

export interface ErrorDefinition {
    title: string;
    category: ErrorCategory;
    description: string;
    recommendation: string;
    retryable: boolean;
}

export const ErrorCatalog: Record<number, ErrorDefinition> = {
    400: {
        title: "BAD REQUEST",
        category: "request",
        description: "The server rejected the request due to invalid parameters",
        recommendation: "Check the request format, model parameters, and submitted messages",
        retryable: false
    },
    401: {
        title: "UNAUTHORIZED",
        category: "authentication",
        description: "The server was unable to authenticate the request",
        recommendation: "Check the API key, its expiration status, and authentication settings",
        retryable: false
    },
    402: {
        title: "PAYMENT REQUIRED",
        category: "payment",
        description: "The provider rejected the request due to a payment-related issue or subscription restrictions",
        recommendation: "Check your balance, subscription, plan limits, and API usage terms",
        retryable: false
    },
    403: {
        title: "FORBIDDEN",
        category: "permission",
        description: "The API key or account does not have sufficient permissions to perform this operation",
        recommendation: "Check API key permissions, model availability, and account restrictions",
        retryable: false
    },
    404: {
        title: "NOT FOUND",
        category: "request",
        description: "The requested endpoint, resource, or model could not be found",
        recommendation: "Check the API base URL, endpoint, and exact model identifier",
        retryable: false
    },
    408: {
        title: "REQUEST TIMEOUT",
        category: "timeout",
        description: "The server did not receive the complete request within the allotted time",
        recommendation: "Check your network connection and try submitting the request again",
        retryable: true
    },
    409: {
        title: "CONFLICT",
        category: "request",
        description: "The request conflicts with the current state of the resource",
        recommendation: "Check the operation state and retry the request after resolving the conflict",
        retryable: false
    },
    413: {
        title: "PAYLOAD TOO LARGE",
        category: "request",
        description: "The request payload exceeds the allowed size limit",
        recommendation: "Reduce the context size, number of messages, or amount of submitted data",
        retryable: false
    },
    422: {
        title: "UNPROCESSABLE ENTITY",
        category: "request",
        description: "The server understood the request but could not process the submitted data",
        recommendation: "Check the parameters, message format, and restrictions of the selected model",
        retryable: false
    },
    429: {
        title: "RATE LIMIT EXCEEDED",
        category: "rate_limit",
        description: "The API request rate limit or resource usage quota has been exceeded",
        recommendation: "Wait before retrying. Check your limits, quotas, and Retry-After headers",
        retryable: true
    },
    500: {
        title: "INTERNAL SERVER ERROR",
        category: "server",
        description: "An internal error occurred on the provider's server",
        recommendation: "Retry the request later. If the error persists, check the provider's API status",
        retryable: true
    },
    501: {
        title: "NOT IMPLEMENTED",
        category: "server",
        description: "The server does not support the requested operation",
        recommendation: "Check whether the provider supports the requested endpoint and parameters",
        retryable: false
    },
    502: {
        title: "BAD GATEWAY",
        category: "server",
        description: "The gateway received an invalid response from an upstream server",
        recommendation: "Retry the request later. A temporary issue with the provider's infrastructure may be occurring",
        retryable: true
    },
    503: {
        title: "SERVICE UNAVAILABLE",
        category: "server",
        description: "The service is temporarily unavailable",
        recommendation: "Wait and retry the request. Check the provider's service availability",
        retryable: true
    },
    504: {
        title: "GATEWAY TIMEOUT",
        category: "timeout",
        description: "The gateway did not receive a response from the upstream server within the allotted time",
        recommendation: "Retry the request later. If the error persists, check the API status",
        retryable: true
    }
};

export function getErrorDefinition(status: number | null): ErrorDefinition {
    if (status !== null && ErrorCatalog[status]) {
        return ErrorCatalog[status];
    }

    return {
        title: "UNKNOWN ERROR",
        category: "unknown",
        description: "OpenCLI was unable to determine the error type from its HTTP status code",
        recommendation: "Inspect the provider's error message and the response diagnostic data",
        retryable: false
    };
}