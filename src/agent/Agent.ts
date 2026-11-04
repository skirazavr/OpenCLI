import { ProviderFactory } from "../providers/ProviderFactory.js";
import { ProviderRegistry } from "../providers/ProviderRegistry.js";
import type { ModelProvider } from "../providers/ModelProvider.js";
import type { ApprovalHandler } from "../tools/ToolRegistry.js";
import type { AgentEvent } from "../protocol/ProviderEvent.js";
import { ToolRegistry } from "../tools/ToolRegistry.js";
import { WriteFileTool, EditFileTool } from "../tools/FileTools.js";
import { TerminalTool } from "../tools/TerminalTool.js";
import { ProjectContext } from "../context/ProjectContext.js";
import { GetProjectOverviewTool, ListDirectoryTool, ReadProjectFileTool, SearchProjectFilesTool } from "../tools/ProjectContextTool.js";
import { AgentLoop, type AgentResult } from "./AgentLoop.js";
import { Conversation } from "./Conversation.js";

const SYSTEM_PROMPT = `
You are OpenCLI, an autonomous AI coding agent.

You work inside the current project directory.

Your responsibilities:
- Analyze source code and project architecture.
- Understand existing files and project configuration.
- Find bugs and explain their causes.
- Create and modify source files.
- Execute builds and tests.
- Analyze command output.
- Verify your changes after modifying them.

PROJECT CONTEXT:

Project information is available on demand.

Do not assume the project structure.
Do not invent file contents, dependencies or configuration.

When you need project information:
1. Call get_project_overview to understand the project.
2. Call list_directory to inspect relevant directories.
3. Call read_file to inspect specific source files.
4. Call search_files to locate classes, methods, symbols or text.

Do not inspect the entire project unless the task requires it.
Prefer targeted inspection of relevant files.

TOOL RULES:

- read_file: read files inside the project.
- search_files: search source files.
- get_project_overview: inspect project metadata.
- list_directory: inspect directory contents.
- write_file: create or overwrite files.
- edit_file: modify existing files.
- run_terminal: execute PowerShell commands.

SECURITY:

1. Never access files outside the project root.
2. Never attempt to read environment files or private keys.
3. Never execute destructive commands without user approval.
4. Never modify or delete files without user approval.
5. Always inspect relevant files before modifying them.
6. Never overwrite existing code without understanding its contents.
7. Prefer edit_file for precise changes to existing files.
8. Use write_file when creating new files or when a complete rewrite is necessary.
9. Never claim that a command succeeded without checking its output.
10. After modifying code, run relevant tests or builds when appropriate.

GENERAL RULES:

- Prefer minimal and precise modifications.
- Preserve the existing project architecture and coding conventions.
- Do not introduce unnecessary dependencies.
- Explain important changes in your final response.
- Answer in Russian unless the user requests another language.

When a task requires multiple operations, perform them sequentially.
`;

export class Agent {
    private readonly registry: ToolRegistry;
    private readonly providerRegistry: ProviderRegistry;
    private readonly conversation: Conversation;
    private readonly approve: ApprovalHandler;
    private running = false;
    private loop: AgentLoop | null = null;

    constructor(approve: ApprovalHandler) {
        this.approve = approve;

        this.conversation = new Conversation(SYSTEM_PROMPT);
        this.registry = new ToolRegistry();
        this.providerRegistry = new ProviderRegistry();

        const projectContext = new ProjectContext();
        const provider = ProviderFactory.create();

        this.registry.register(new GetProjectOverviewTool(projectContext));
        this.registry.register(new ListDirectoryTool(projectContext));
        this.registry.register(new ReadProjectFileTool(projectContext));
        this.registry.register(new SearchProjectFilesTool(projectContext));
        this.registry.register(new WriteFileTool());
        this.registry.register(new EditFileTool());
        this.registry.register(new TerminalTool());

        this.providerRegistry.register(provider);

        this.refreshLoop();
    }

    async run(message: string, signal?: AbortSignal, onEvent?: (event: AgentEvent) => void): Promise<AgentResult> {
        this.ensureActiveProvider();

        if (this.running) {
            throw new Error("Agent is already running");
        }

        this.running = true;

        try {
            const previousSize = this.conversation.size;
            const result = await this.loop!.run(this.conversation.getMessages(), message, signal, onEvent);

            for (const item of result.messages.slice(previousSize)) {
                this.conversation.add(item);
            }

            return result;
        } finally {
            this.running = false;
        }
    }

    clearConversation(): void {
        this.ensureNotRunning();

        this.conversation.clear(SYSTEM_PROMPT);
    }

    getAvailableTools(): string[] {
        return this.registry.getToolNames();
    }

    getAvailableProviders(): string[] {
        return this.providerRegistry.list();
    }

    getAllProviders(): ModelProvider[] {
        return this.providerRegistry.getAll();
    }

    hasProvider(id: string): boolean {
        return this.providerRegistry.has(id);
    }

    hasActiveProvider(): boolean {
        return this.providerRegistry.hasActive();
    }

    getActiveProvider(): string {
        if (!this.providerRegistry.hasActive()) {
            return "none";
        }

        return this.providerRegistry.getActive().displayName;
    }

    getActiveProviderId(): string {
        return this.providerRegistry.getActiveId() ?? "none";
    }

    registerProvider(id: string): ModelProvider {
        this.ensureNotRunning();

        if (this.providerRegistry.has(id)) {
            throw new Error(`Provider already registered: ${id}`);
        }

        const provider = ProviderFactory.create(id);

        this.providerRegistry.register(provider);

        this.refreshLoop();

        return provider;
    }

    setActiveProvider(id: string): void {
        this.ensureNotRunning();

        this.providerRegistry.setActive(id);

        this.refreshLoop();
    }

    removeProvider(id: string): boolean {
        this.ensureNotRunning();

        const removed = this.providerRegistry.remove(id);

        if (removed) {
            this.refreshLoop();
        }

        return removed;
    }

    clearProviders(): void {
        this.ensureNotRunning();

        this.providerRegistry.clear();

        this.loop = null;
    }

    private refreshLoop(): void {
        if (!this.providerRegistry.hasActive()) {
            this.loop = null;

            return;
        }

        const provider = this.providerRegistry.getActive();

        this.loop = new AgentLoop(
            provider,
            this.registry,
            this.approve,
            provider.model
        );
    }

    private ensureActiveProvider(): void {
        if (!this.providerRegistry.hasActive()) {
            throw new Error("Cannot run agent: no active AI provider configured");
        }

        if (!this.loop) {
            this.refreshLoop();
        }

        if (!this.loop) {
            throw new Error("Failed to initialize AgentLoop");
        }
    }

    private ensureNotRunning(): void {
        if (this.running) {
            throw new Error(
                "Cannot modify providers while the agent is running"
            );
        }
    }
}