import { z } from "zod";
import type { JsonSchema, ModelToolDefinition } from "../protocol/ModelTool.js";
import type { Tool } from "./Tool.js";
import { ProjectContext } from "../context/ProjectContext.js";

function definition(name: string, description: string, properties: Record<string, JsonSchema>, required: string[] = []): ModelToolDefinition {
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

const overviewSchema = z.object({}).strict();
const listDirectorySchema = z.object({
    path: z.string().min(1).max(1000).optional()
}).strict();
const readFileSchema = z.object({
    path: z.string().trim().min(1).max(1000),
    maxCharacters: z.number()
        .int()
        .positive()
        .max(100_000)
        .optional()
}).strict();
const searchFilesSchema = z.object({
    query: z.string().trim().min(1).max(500),
    extensions: z.array(
        z.string().trim().min(1).max(20)
    ).max(30).optional(),
    maxResults: z.number()
        .int()
        .positive()
        .max(100)
        .optional(),
    maxFiles: z.number()
        .int()
        .positive()
        .max(5000)
        .optional()
}).strict();
const overviewDefinition = definition(
    "get_project_overview",
    "Get an overview of the current project, including its root directory, top-level files and known project configuration files",
    {}
);
const listDirectoryDefinition = definition(
    "list_directory",
    "List files and subdirectories in a specific project directory. Uses the project root by default",
    {
        path: {
            type: "string",
            description: "Project-relative directory path. Use '.' for the project root"
        }
    }
);
const readFileDefinition = definition(
    "read_file",
    "Read a text file inside the current project. Paths must be relative to the project root. Environment files are not accessible",
    {
        path: {
            type: "string",
            description: "Project-relative path to the file"
        },
        maxCharacters: {
            type: "integer",
            minimum: 1,
            maximum: 100000,
            description: "Maximum number of characters to read"
        }
    },
    ["path"]
);
const searchFilesDefinition = definition(
    "search_files",
    "Search for text in project files. The search is case-insensitive and skips ignored directories, environment files and symbolic links",
    {
        query: {
            type: "string",
            description: "Text to search for. Search is case-insensitive"
        },
        extensions: {
            type: "array",
            items: {
                type: "string"
            },
            description: "Optional file extensions, for example ['.ts', '.tsx', '.java']"
        },
        maxResults: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            description: "Maximum number of matching lines"
        },
        maxFiles: {
            type: "integer",
            minimum: 1,
            maximum: 5000,
            description: "Maximum number of files to inspect"
        }
    },
    ["query"]
);
export class GetProjectOverviewTool implements Tool {
    readonly name = "get_project_overview";
    readonly description = overviewDefinition.description;
    readonly requiresApproval = false;
    readonly parameters = overviewSchema;

    constructor(private readonly context: ProjectContext) {
    }

    getDefinition(): ModelToolDefinition {
        return overviewDefinition;
    }

    async execute(args: unknown): Promise<string> {
        this.parameters.parse(args);

        return this.context.getProjectOverview();
    }
}

export class ListDirectoryTool implements Tool {
    readonly name = "list_directory";
    readonly description = listDirectoryDefinition.description;
    readonly requiresApproval = false;
    readonly parameters = listDirectorySchema;

    constructor(private readonly context: ProjectContext) {
    }

    getDefinition(): ModelToolDefinition {
        return listDirectoryDefinition;
    }

    async execute(args: unknown): Promise<string> {
        const { path } = this.parameters.parse(args);

        return this.context.listDirectory(path ?? ".");
    }
}

export class ReadProjectFileTool implements Tool {
    readonly name = "read_file";
    readonly description = readFileDefinition.description;
    readonly requiresApproval = false;
    readonly parameters = readFileSchema;

    constructor(private readonly context: ProjectContext) {
    }

    getDefinition(): ModelToolDefinition {
        return readFileDefinition;
    }

    async execute(args: unknown): Promise<string> {
        const {
            path,
            maxCharacters
        } = this.parameters.parse(args);

        return this.context.readFile(
            path,
            maxCharacters
        );
    }
}

export class SearchProjectFilesTool implements Tool {
    readonly name = "search_files";
    readonly description = searchFilesDefinition.description;
    readonly requiresApproval = false;
    readonly parameters = searchFilesSchema;

    constructor(private readonly context: ProjectContext) {
    }

    getDefinition(): ModelToolDefinition {
        return searchFilesDefinition;
    }

    async execute(args: unknown): Promise<string> {
        const {
            query,
            extensions,
            maxResults,
            maxFiles
        } = this.parameters.parse(args);
        const normalizedExtensions = extensions?.map(extension => {
            const value = extension.toLowerCase();

            return value.startsWith(".")
                ? value
                : `.${value}`;
        });

        return this.context.searchFiles(query, {
            extensions: normalizedExtensions,
            maxResults,
            maxFiles
        });
    }
}
