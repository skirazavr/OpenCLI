export type ActivityStatus =
    | "pending"
    | "running"
    | "completed"
    | "failed"
    | "waiting_approval"
    | "rejected";

export type ActivityKind =
    | "model"
    | "analysis"
    | "tool"
    | "file"
    | "terminal"
    | "system";

export type AgentRunStatus =
    | "idle"
    | "running"
    | "waiting_approval"
    | "completed"
    | "failed";

export interface AgentActivityItem {
    id: string;
    kind: ActivityKind;
    title: string;
    description?: string;
    status: ActivityStatus;
    toolName?: string;
    arguments?: unknown;
    result?: string;
    error?: string;
    iteration?: number;
    startedAt?: number;
    completedAt?: number;
}

export interface AgentActivityState {
    items: AgentActivityItem[];
    response: string;
    provider?: string;
    model?: string;
    iteration: number;
    status: AgentRunStatus;
    startedAt?: number;
    completedAt?: number;
}