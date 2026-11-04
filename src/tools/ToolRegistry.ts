import type { Tool } from "./Tool.js";
import type { ModelToolDefinition } from "../protocol/ModelTool.js";

export type ApprovalHandler = (toolName: string, args: unknown) => Promise<boolean>;

export interface ToolExecutionCallbacks {
    onStarted?: (name: string, args: unknown) => void;
    onRejected?: (name: string, args: unknown) => void;
}

export class ToolRegistry {
    private readonly tools = new Map<string, Tool>();

    register(tool: Tool): void {
        if (!tool.name.trim()) {
            throw new Error("Tool name cannot be empty");
        }

        if (this.has(tool.name)) {
            throw new Error(`Tool already registered: ${tool.name}`);
        }

        this.tools.set(tool.name, tool);
    }

    getDefinitions(): ModelToolDefinition[] {
        return Array.from(this.tools.values()).map(tool => tool.getDefinition());
    }

    async execute(name: string, rawArguments: string, approve: ApprovalHandler, callbacks: ToolExecutionCallbacks = {}): Promise<string> {
        const tool = this.tools.get(name);

        if (!tool) {
            throw new Error(`Unknown tool "${name}".`);
        }

        let args: unknown;

        try {
            args = JSON.parse(rawArguments);
        } catch {
            throw new Error("Tool arguments contain invalid JSON");
        }

        const validation = tool.parameters.safeParse(args);

        if (!validation.success) {
            throw new Error(`Invalid tool arguments:\n${validation.error.message}`);
        }

        const validatedArgs = validation.data;

        if (tool.requiresApproval) {
            const approved = await approve(name, validatedArgs);

            if (!approved) {
                callbacks.onRejected?.(name, validatedArgs);

                return "Operation rejected by user";
            }
        }

        callbacks.onStarted?.(name, validatedArgs);

        return await tool.execute(validatedArgs);
    }

    getToolNames(): string[] {
        return Array.from(this.tools.keys());
    }

    has(name: string): boolean {
        return this.tools.has(name);
    }
}
