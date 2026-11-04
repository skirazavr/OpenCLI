import type { ZodType } from "zod";
import type { ModelToolDefinition } from "../protocol/ModelTool.js";

export interface Tool {
    readonly name: string;
    readonly description: string;
    readonly parameters: ZodType;
    readonly requiresApproval: boolean;

    execute(args: unknown): Promise<string>;

    getDefinition(): ModelToolDefinition;
}
