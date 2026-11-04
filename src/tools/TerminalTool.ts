import { spawn } from "node:child_process";
import { z } from "zod";
import type { ModelToolDefinition } from "../protocol/ModelTool.js";
import type { Tool } from "./Tool.js";

export class TerminalTool implements Tool {
    readonly name = "run_terminal";
    readonly description = "Execute a PowerShell command in the current project directory";
    readonly requiresApproval = true;
    readonly parameters = z.object({
        command: z.string().min(1)
    });

    getDefinition(): ModelToolDefinition {
        return {
            name: this.name,
            description: this.description,
            parameters: {
                type: "object",
                properties: {
                    command: {
                        type: "string",
                        description: "PowerShell command to execute"
                    }
                },
                required: ["command"],
                additionalProperties: false
            }
        };
    }

    async execute(args: unknown): Promise<string> {
        const { command } = this.parameters.parse(args);
        const shell = process.env.OPENCLI_POWERSHELL || "powershell.exe";

        return new Promise((resolve, reject) => {
            const child = spawn(
                shell,
                [
                    "-NoLogo",
                    "-NoProfile",
                    "-NonInteractive",
                    "-Command",
                    command
                ],
                {
                    cwd: process.cwd(),
                    windowsHide: true,
                    stdio: ["ignore", "pipe", "pipe"]
                }
            );

            let stdout = "";
            let stderr = "";
            let settled = false;

            const maxOutput = 2 * 1024 * 1024;
            const timeout = setTimeout(() => {
                if (settled) {
                    return;
                }

                settled = true;

                child.kill();

                resolve(
                    "Command timed out after 60 seconds"
                );
            }, 60_000);

            child.stdout.on("data", (chunk: Buffer) => {
                if (stdout.length < maxOutput) {
                    stdout += chunk.toString();
                }
            });

            child.stderr.on("data", (chunk: Buffer) => {
                if (stderr.length < maxOutput) {
                    stderr += chunk.toString();
                }
            });

            child.on("error", (error: Error) => {
                clearTimeout(timeout);

                if (settled) {
                    return;
                }

                settled = true;

                reject(error);
            });

            child.on("close", (code: number | null) => {
                clearTimeout(timeout);

                if (settled) {
                    return;
                }

                settled = true;

                resolve([
                    `EXIT CODE: ${code ?? "unknown"}`,
                    stdout ? `STDOUT:\n${stdout}` : "",
                    stderr ? `STDERR:\n${stderr}` : ""
                ].filter(Boolean).join("\n"));
            });
        });
    }
}
