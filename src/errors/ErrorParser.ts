import type { ParsedError } from "./types.js";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }

    return value as UnknownRecord;
}

function asString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : null;
}

function asNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isInteger(value)) {
        return value;
    }

    if (typeof value === "string" && /^\d{3}$/.test(value)) {
        return Number(value);
    }

    return null;
}

export function parseError(error: unknown): ParsedError {
    const root = asRecord(error);

    if (!root) {
        return {
            status: null,
            code: null,
            type: null,
            message: String(error),
            providerMessage: null,
            requestId: null
        };
    }

    const response = asRecord(root.response);
    const data = asRecord(response?.data);
    const body = asRecord(root.error);
    const nestedError = asRecord(data?.error);
    const status = asNumber(root.status) ?? asNumber(response?.status) ?? asNumber(root.statusCode);
    const providerMessage = asString(body?.message) ?? asString(nestedError?.message) ?? asString(data?.message) ?? asString(root.message);
    const message = asString(root.message) ?? providerMessage ?? "Unknown error";

    const headers = asRecord(response?.headers);

    return {
        status,
        code: asString(body?.code) ?? asString(nestedError?.code) ?? asString(data?.code) ?? asString(root.code),
        type: asString(body?.type) ?? asString(nestedError?.type) ?? asString(root.type) ?? asString(root.name),
        message,
        providerMessage,
        requestId: asString(root.request_id) ?? asString(root.requestId) ?? asString(headers?.["x-request-id"])
    };
}