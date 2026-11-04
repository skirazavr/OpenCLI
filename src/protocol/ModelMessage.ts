export type ModelRole = "system" | "user" | "assistant" | "tool";

export interface TextContentPart {
    type: "text";
    text: string;
}

export interface ImageContentPart {
    type: "image";
    source:
        | {
        type: "url";
        url: string;
    }
        | {
        type: "base64";
        mediaType: string;
        data: string;
    };
}

export interface FileContentPart {
    type: "file";
    name: string;
    mediaType: string;
    data: string;
}

export type ModelContentPart =
    | TextContentPart
    | ImageContentPart
    | FileContentPart;

export type ModelContent = string | ModelContentPart[];

export interface ModelToolCall {
    id: string;
    name: string;
    arguments: string;
}

export interface ModelMessage {
    role: ModelRole;
    content: ModelContent;
    name?: string;
    toolCallId?: string;
    toolCalls?: ModelToolCall[];
    metadata?: Record<string, unknown>;
}