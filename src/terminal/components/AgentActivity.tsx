import { Box, Text } from "ink";
import type { AgentActivityItem, AgentActivityState, ActivityStatus } from "../activity/ActivityTypes.js";

interface AgentActivityProps {
    state: AgentActivityState;
}

function getStatusIcon(status: ActivityStatus): string {
    switch (status) {
        case "pending":
            return "○";
        case "running":
            return "●";
        case "completed":
            return "✓";
        case "failed":
            return "✗";
        case "waiting_approval":
            return "◷";
        case "rejected":
            return "⊘";
    }
}

function getStatusColor(status: ActivityStatus): string {
    switch (status) {
        case "pending":
            return "gray";
        case "running":
            return "cyan";
        case "completed":
            return "#55FF55";
        case "failed":
            return "#FF5555";
        case "waiting_approval":
            return "#FFFF55";
        case "rejected":
            return "gray";
    }
}

function getStatusLabel(status: ActivityStatus): string {
    switch (status) {
        case "pending":
            return "Pending";
        case "running":
            return "Running";
        case "completed":
            return "Completed";
        case "failed":
            return "Failed";
        case "waiting_approval":
            return "Awaiting approval";
        case "rejected":
            return "Rejected";
    }
}

function getRunStatusLabel(status: AgentActivityState["status"]): string {
    switch (status) {
        case "idle":
            return "Idle";
        case "running":
            return "Working";
        case "waiting_approval":
            return "Approval required";
        case "completed":
            return "Completed";
        case "failed":
            return "Failed";
    }
}

function formatDuration(item: AgentActivityItem): string | undefined {
    if (!item.startedAt || !item.completedAt) {
        return undefined;
    }

    const duration = Math.max(0, item.completedAt - item.startedAt);

    if (duration < 1000) {
        return `${duration} ms`;
    }

    return `${(duration / 1000).toFixed(1)} s`;
}

function formatArguments(args: unknown): string | undefined {
    if (args === undefined) {
        return undefined;
    }

    try {
        const value = JSON.stringify(args);

        if (!value) {
            return undefined;
        }

        return value.length > 500
            ? `${value.slice(0, 500)}…`
            : value;
    } catch {
        return String(args);
    }
}

function ActivityRow({ item }: { item: AgentActivityItem }) {
    const icon = getStatusIcon(item.status);
    const color = getStatusColor(item.status);
    const duration = formatDuration(item);

    return (
        <Box flexDirection="column" marginBottom={1}>
            <Box>
                <Text color={color} bold>
                    {icon}{" "}
                </Text>
                <Text color={item.status === "running" ? "cyan" : "white"} bold={item.status === "running"}>
                    {item.title}
                </Text>
                {item.status === "running" && (
                    <Text color="cyan">  Running...</Text>
                )}
                {item.status === "waiting_approval" && (
                    <Text color="#FFFF55">  Approval required</Text>
                )}
                {item.status === "failed" && (
                    <Text color="#FF5555">  Failed</Text>
                )}
                {item.status === "rejected" && (
                    <Text color="gray">  Rejected</Text>
                )}
            </Box>
            {item.description && (
                <Box marginLeft={2}>
                    <Text color="gray" wrap="truncate-end">
                        {item.description}
                    </Text>
                </Box>
            )}
            {item.toolName && (
                <Box marginLeft={2}>
                    <Text color="gray">
                        Tool: {item.toolName}
                    </Text>
                </Box>
            )}
            {item.arguments !== undefined && (
                <Box marginLeft={2}>
                    <Text color="gray" wrap="wrap">
                        Arguments: {formatArguments(item.arguments)}
                    </Text>
                </Box>
            )}
            {item.result && item.status === "completed" && (
                <Box marginLeft={2}>
                    <Text color="gray" wrap="truncate-end">
                        Result: {item.result.slice(0, 300)}
                    </Text>
                </Box>
            )}
            {item.error && (
                <Box marginLeft={2}>
                    <Text color="#FF5555" wrap="wrap">
                        {item.error}
                    </Text>
                </Box>
            )}
            {duration && (
                <Box marginLeft={2}>
                    <Text color="gray" dimColor>
                        {duration}
                    </Text>
                </Box>
            )}
        </Box>
    );
}

export function AgentActivity({ state }: AgentActivityProps) {
    const visibleItems = state.items.slice(-12);

    if (state.status === "idle" && state.items.length === 0) {
        return null;
    }

    return (
        <Box flexDirection="column" borderStyle="round" borderColor={state.status === "failed" ? "#FF5555" : "gray"} paddingX={1} paddingY={0} marginY={1}>
            <Box justifyContent="space-between">
                <Text bold color="cyan">
                    Agent Activity
                </Text>
                <Text
                    color={
                        state.status === "failed"
                            ? "#FF5555"
                            : state.status === "completed"
                                ? "green"
                                : state.status === "waiting_approval"
                                    ? "#FFFF55"
                                    : "cyan"
                    }
                    bold
                >
                    {getRunStatusLabel(state.status)}
                </Text>
            </Box>
            <Box>
                <Text color="gray">
                    {state.provider ?? "Provider"}
                    {state.model ? ` · ${state.model}` : ""}
                    {state.iteration > 0
                        ? ` · Iteration ${state.iteration}`
                        : ""}
                </Text>
            </Box>
            {visibleItems.length > 0 && (
                <Box flexDirection="column" marginTop={1}>
                    {visibleItems.map(item => (
                        <ActivityRow key={item.id} item={item} />
                    ))}
                </Box>
            )}
            {state.response.length > 0 && (
                <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} marginTop={1}>
                    <Text color="cyan" bold>
                        Model Response
                    </Text>
                    <Text wrap="wrap">
                        {state.response.slice(-3000)}
                    </Text>
                </Box>
            )}
            {state.status === "waiting_approval" && (
                <Text color="#FFFF55" bold>
                    Waiting for user approval
                </Text>
            )}
        </Box>
    );
}