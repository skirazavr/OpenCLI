import type { AgentEvent } from "../../protocol/ProviderEvent.js";
import type { ActivityKind, ActivityStatus, AgentActivityItem, AgentActivityState } from "./ActivityTypes.js";

const MAX_ACTIVITIES = 100;

export class ActivityManager {
    private state: AgentActivityState = this.createInitialState();
    private sequence = 0;
    private readonly toolActivities = new Map<string, string>();

    private createInitialState(): AgentActivityState {
        return {
            items: [],
            response: "",
            iteration: 0,
            status: "idle"
        };
    }

    getSnapshot(): AgentActivityState {
        return {
            ...this.state,
            items: this.state.items.map(item => ({ ...item }))
        };
    }

    reset(): AgentActivityState {
        this.state = this.createInitialState();
        this.sequence = 0;
        this.toolActivities.clear();

        return this.getSnapshot();
    }

    handle(event: AgentEvent): AgentActivityState {
        switch (event.type) {
            case "request_started":
                this.handleRequestStarted(event);

                break;
            case "request_completed":
                this.handleRequestCompleted();

                break;
            case "response_delta":
                this.state.response += event.text;

                break;
            case "thinking_started":
                this.addActivity({
                    kind: "analysis",
                    title: "Model is processing the request",
                    status: "running",
                    iteration: this.state.iteration
                });

                break;
            case "tool_requested":
                this.handleToolRequested(event.name, event.arguments);

                break;
            case "approval_required":
                this.updateToolActivity(event.name, {
                    status: "waiting_approval",
                    description: "Waiting for user approval"
                });

                this.state.status = "waiting_approval";

                break;
            case "tool_started":
                this.updateToolActivity(event.name, {
                    status: "running",
                    description: "Executing tool",
                    startedAt: Date.now()
                });

                this.state.status = "running";

                break;
            case "tool_completed":
                this.updateToolActivity(event.name, {
                    status: "completed",
                    description: "Execution completed",
                    result: event.result,
                    completedAt: Date.now()
                });

                this.state.status = "running";
                break;
            case "tool_rejected":
                this.updateToolActivity(event.name, {
                    status: "rejected",
                    description: "Operation rejected by user",
                    completedAt: Date.now()
                });

                this.state.status = "running";

                break;
            case "tool_failed":
                this.updateToolActivity(event.name, {
                    status: "failed",
                    description: "Execution failed",
                    error: event.error,
                    completedAt: Date.now()
                });

                break;
            case "file_read":
                this.addActivity({
                    kind: "file",
                    title: "Reading file",
                    description: event.path,
                    status: "completed",
                    completedAt: Date.now()
                });

                break;
            case "file_changed":
                this.addActivity({
                    kind: "file",
                    title: "Modifying file",
                    description: event.path,
                    status: "completed",
                    completedAt: Date.now()
                });

                break;
            case "iteration_limit":
                this.addActivity({
                    kind: "system",
                    title: "Iteration limit reached",
                    description: `Maximum: ${event.limit}`,
                    status: "failed",
                    completedAt: Date.now()
                });

                this.state.status = "failed";
                this.state.completedAt = Date.now();

                break;
            case "completed":
                this.state.status = "completed";
                this.state.completedAt = Date.now();
                this.completeRunningActivities();

                break;
            case "error":
                this.addActivity({
                    kind: "system",
                    title: "Agent error",
                    description: this.getErrorMessage(event.error),
                    status: "failed",
                    completedAt: Date.now()
                });

                this.state.status = "failed";
                this.state.completedAt = Date.now();

                break;
        }

        return this.getSnapshot();
    }

    private handleRequestStarted(event: Extract<AgentEvent, { type: "request_started" }>): void {
        this.state.provider = event.provider;
        this.state.model = event.model;
        this.state.iteration = event.iteration;
        this.state.status = "running";

        if (!this.state.startedAt) {
            this.state.startedAt = Date.now();
        }

        this.addActivity({
            kind: "model",
            title: "Sending request to model",
            description: [
                event.provider,
                event.model,
                `Iteration ${event.iteration}`
            ].filter(Boolean).join(" · "),
            status: "running",
            iteration: event.iteration,
            startedAt: Date.now()
        });
    }

    private handleRequestCompleted(): void {
        const item = [...this.state.items]
            .reverse()
            .find(activity => activity.kind === "model" && activity.status === "running");

        if (item) {
            this.updateActivity(item.id, {
                status: "completed",
                description: item.description,
                completedAt: Date.now()
            });
        }
    }

    private handleToolRequested(name: string, args: unknown): void {
        const title = this.getToolTitle(name);
        const kind = this.getToolKind(name);

        const item = this.addActivity({
            kind,
            title,
            description: "Tool requested by model",
            status: "pending",
            toolName: name,
            arguments: args,
            iteration: this.state.iteration
        });

        this.toolActivities.set(name, item.id);
    }

    private updateToolActivity(name: string, updates: Partial<AgentActivityItem>): void {
        const id = this.toolActivities.get(name);

        if (!id) {
            this.addActivity({
                kind: this.getToolKind(name),
                title: this.getToolTitle(name),
                toolName: name,
                status: updates.status ?? "running",
                ...updates
            });

            return;
        }

        this.updateActivity(id, updates);
    }

    private addActivity(activity: Omit<AgentActivityItem, "id">): AgentActivityItem {
        const item: AgentActivityItem = {
            id: `activity-${++this.sequence}`,
            ...activity
        };

        this.state.items = [
            ...this.state.items,
            item
        ].slice(-MAX_ACTIVITIES);

        return item;
    }

    private updateActivity(id: string, updates: Partial<AgentActivityItem>): void {
        const current = this.state.items.find(item => item.id === id);

        if (!current) {
            return;
        }

        if (this.isFinalStatus(current.status) && updates.status !== undefined && !this.isFinalStatus(updates.status)) {
            return;
        }

        this.state.items = this.state.items.map(item => item.id === id ? { ...item, ...updates } : item);
    }

    private isFinalStatus(status: ActivityStatus): boolean {
        return (status === "completed" || status === "failed" || status === "rejected");
    }

    private completeRunningActivities(): void {
        const now = Date.now();

        this.state.items = this.state.items.map(item => {
            if (item.status !== "running") {
                return item;
            }

            return {
                ...item,
                status: "completed",
                completedAt: now
            };
        });
    }

    private getToolTitle(name: string): string {
        const titles: Record<string, string> = {
            get_project_overview: "Inspecting project structure",
            list_directory: "Browsing files and directories",
            read_file: "Reading file",
            search_files: "Searching project files",
            write_file: "Creating file",
            edit_file: "Modifying file",
            run_terminal: "Executing terminal command",
            execute_command: "Executing command"
        };

        return titles[name] ?? `Executing tool: ${name}`;
    }

    private getToolKind(name: string): ActivityKind {
        if (name.includes("terminal") || name.includes("command") || name.includes("shell")) {
            return "terminal";
        }

        if (name.includes("file") || name.includes("directory") || name.includes("search")) {
            return "file";
        }

        return "tool";
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }

        return String(error);
    }
}