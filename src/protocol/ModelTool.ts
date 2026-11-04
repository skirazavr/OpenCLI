export interface JsonSchema {
    type?: string;
    description?: string;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    items?: JsonSchema;
    enum?: Array<string | number | boolean | null>;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    additionalProperties?: boolean;
    [key: string]: unknown;
}

export interface ModelToolDefinition {
    name: string;
    description: string;
    parameters: JsonSchema;
}