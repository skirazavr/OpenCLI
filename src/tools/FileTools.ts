import { lstat, readFile, writeFile, mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import type { JsonSchema, ModelToolDefinition } from "../protocol/ModelTool.js";
import type { Tool } from "./Tool.js";

const PROJECT_ROOT = process.cwd();

function isInsideProject(root: string, target: string): boolean {
    const relative = path.relative(root, target);

    return (relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)));
}

async function getProjectRoot(): Promise<string> {
    return realpath(PROJECT_ROOT);
}

function validateRelativePath(filePath: string): void {
    if (!filePath || filePath.trim().length === 0) {
        throw new Error("File path cannot be empty");
    }

    if (path.isAbsolute(filePath)) {
        throw new Error("Absolute paths are not allowed. Use a project-relative path");
    }

    if (filePath.includes("\0")) {
        throw new Error("Invalid file path");
    }
}

function isMissingError(error: unknown): boolean {
    return (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT");
}

async function resolveProjectPath(filePath: string, allowMissing = false): Promise<string> {
    validateRelativePath(filePath);

    const root = await getProjectRoot();
    const target = path.resolve(root, filePath);

    if (!isInsideProject(root, target)) {
        throw new Error("Access outside the project directory is prohibited");
    }

    const relative = path.relative(root, target);
    const segments = relative.split(path.sep).filter(Boolean);

    let current = root;

    for (let index = 0; index < segments.length; index++) {
        current = path.join(current, segments[index]);

        let stats;

        try {
            stats = await lstat(current);
        } catch (error: unknown) {
            if (isMissingError(error) && allowMissing) {
                return target;
            }

            throw error;
        }

        if (stats.isSymbolicLink()) {
            throw new Error(`Symbolic links are not allowed: ${filePath}`);
        }

        const isLast = index === segments.length - 1;

        if (!isLast && !stats.isDirectory()) {
            throw new Error(`Path component is not a directory: ${segments[index]}`);
        }

        if (isLast && !allowMissing && !stats.isFile()) {
            throw new Error(`Target is not a regular file: ${filePath}`);
        }
    }

    const resolved = await realpath(target);

    if (!isInsideProject(root, resolved)) {
        throw new Error("Access outside the project directory is prohibited");
    }

    return resolved;
}

async function ensureParentDirectories(filePath: string): Promise<void> {
    const root = await getProjectRoot();
    const parent = path.dirname(filePath);

    if (!isInsideProject(root, parent)) {
        throw new Error("Access outside the project directory is prohibited");
    }

    const relative = path.relative(root, parent);
    const segments = relative.split(path.sep).filter(Boolean);

    let current = root;

    for (const segment of segments) {
        current = path.join(current, segment);

        try {
            await mkdir(current);
        } catch (error: unknown) {
            if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "EEXIST") {
                throw error;
            }
        }

        const stats = await lstat(current);

        if (stats.isSymbolicLink() || !stats.isDirectory()) {
            throw new Error(`Unsafe directory encountered: ${current}`);
        }

        const resolved = await realpath(current);

        if (!isInsideProject(root, resolved)) {
            throw new Error("Directory escapes the project root");
        }
    }
}

function definition(name: string, description: string, properties: Record<string, JsonSchema>, required: string[]): ModelToolDefinition {
    return {
        name,
        description,
        parameters: {
            type: "object",
            properties,
            required,
            additionalProperties: false
        }
    };
}

export class WriteFileTool implements Tool {
    readonly name = "write_file";
    readonly description = "Create a new file or overwrite an existing file inside the project";
    readonly requiresApproval = true;
    readonly parameters = z.object({
        path: z.string().min(1).max(1000),
        content: z.string()
    });

    getDefinition(): ModelToolDefinition {
        return definition(
            this.name,
            this.description,
            {
                path: {
                    type: "string",
                    description: "Relative file path"
                },
                content: {
                    type: "string",
                    description: "Complete file contents"
                }
            },
            ["path", "content"]
        );
    }

    async execute(args: unknown): Promise<string> {
        const {
            path: filePath,
            content
        } = this.parameters.parse(args);

        const absolutePath =
            await resolveProjectPath(filePath, true);

        await ensureParentDirectories(absolutePath);

        const safePath =
            await resolveProjectPath(filePath, true);

        try {
            const stats = await lstat(safePath);

            if (stats.isSymbolicLink() || !stats.isFile()) {
                throw new Error(
                    "Target must be a regular file"
                );
            }
        } catch (error: unknown) {
            if (!isMissingError(error)) {
                throw error;
            }
        }

        await writeFile(safePath, content, "utf8");

        return `File successfully written: ${filePath}`;
    }
}

export class EditFileTool implements Tool {
    readonly name = "edit_file";
    readonly description = "Replace an exact text fragment in an existing project file";
    readonly requiresApproval = true;
    readonly parameters = z.object({
        path: z.string().min(1).max(1000),
        oldText: z.string().min(1),
        newText: z.string(),
        replaceAll: z.boolean().default(false)
    });

    getDefinition(): ModelToolDefinition {
        return definition(
            this.name,
            this.description,
            {
                path: {
                    type: "string",
                    description: "Relative path to the file"
                },
                oldText: {
                    type: "string",
                    description: "Exact text to find"
                },
                newText: {
                    type: "string",
                    description: "Replacement text"
                },
                replaceAll: {
                    type: "boolean",
                    description: "Replace every occurrence"
                }
            },
            ["path", "oldText", "newText"]
        );
    }

    async execute(args: unknown): Promise<string> {
        const {
            path: filePath,
            oldText,
            newText,
            replaceAll
        } = this.parameters.parse(args);

        const absolutePath = await resolveProjectPath(filePath);
        const original = await readFile(absolutePath, "utf8");

        if (!original.includes(oldText)) {
            return "Error: The requested text was not found";
        }

        const occurrences = original.split(oldText).length - 1;

        if (!replaceAll && occurrences > 1) {
            return (
                `Error: Found ${occurrences} occurrences. ` +
                "Specify a more unique oldText or set replaceAll=true"
            );
        }

        const updated = replaceAll
            ? original.split(oldText).join(newText)
            : original.replace(oldText, newText);

        const safePath = await resolveProjectPath(filePath);

        await writeFile(safePath, updated, "utf8");

        return `File successfully edited: ${filePath}`;
    }
}
