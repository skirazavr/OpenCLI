import { useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { Agent } from "../agent/Agent.js";
import { AgentActivity } from "./components/AgentActivity.js";
import type { AgentEvent } from "../protocol/ProviderEvent.js";
import { ActivityManager } from "./activity/ActivityManager.js";
import type { AgentActivityState } from "./activity/ActivityTypes.js";
import { Header } from "./components/Header.js";
import { ChatMessage, type ChatEntry } from "./components/ChatMessage.js";
import { Input } from "./components/Input.js";
import { StatusBar } from "./components/StatusBar.js";
import { analyzeError } from "../errors/ErrorAnalyzer.js";
import { formatError } from "../errors/ErrorFormatter.js";
import { Config } from "../config/Config.js";

interface PendingApproval {
    toolName: string;
    args: unknown;
}

const rainbow = [
    "#FF5555",
    "#FFAA00",
    "#FFFF55",
    "#55FF55",
    "#55FFFF",
    "#5555FF",
    "#FF55FF"
];

export function App() {
    const { exit } = useApp();
    const [draft, setDraft] = useState("");
    const [loading, setLoading] = useState(false);
    const [, setProviderRevision] = useState(0);
    const [entries, setEntries] = useState<ChatEntry[]>([]);
    const activityManager = useMemo(() => new ActivityManager(), []);
    const [activityState, setActivityState] = useState<AgentActivityState>(() => activityManager.getSnapshot());
    const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
    const approvalResolver = useRef<((approved: boolean) => void) | null>(null);
    const agent = useMemo(() => {
        return new Agent((toolName, args) => {
            return new Promise<boolean>(resolve => {
                approvalResolver.current = resolve;

                setPendingApproval({
                    toolName,
                    args
                });
            });
        });
    }, []);

    function refreshProviders(): void {
        setProviderRevision(revision => revision + 1);
    }

    function handleAgentEvent(event: AgentEvent): void {
        const nextState = activityManager.handle(event);

        setActivityState(nextState);
    }

    async function sendMessage(content: string): Promise<void> {
        const command = content.trim();

        if (!command) {
            return;
        }

        if (command === "/clear") {
            agent.clearConversation();

            setEntries([]);

            activityManager.reset();
            setActivityState(activityManager.getSnapshot());

            return;
        }

        if (handleProviderCommand(command)) {
            return;
        }

        if (!agent.hasActiveProvider()) {
            setEntries(previous => [
                ...previous,
                {
                    role: "error",
                    content: "Нет активного AI-провайдера. Используй /provider add <id>"
                }
            ]);

            return;
        }

        setLoading(true);

        activityManager.reset();
        setActivityState(activityManager.getSnapshot());

        setEntries(previous => [
            ...previous,
            {
                role: "user",
                content
            }
        ]);

        try {
            const result = await agent.run(content, undefined, handleAgentEvent);

            setEntries(previous => [
                ...previous,
                {
                    role: "assistant",
                    content: result.answer
                }
            ]);
        } catch (error: unknown) {
            const analysis = analyzeError(error, {
                provider: agent.getActiveProvider(),
                model: Config.model
            });

            setEntries(previous => [
                ...previous,
                {
                    role: "error",
                    content: formatError(analysis)
                }
            ]);
        } finally {
            setLoading(false);
        }
    }

    function resolveApproval(approved: boolean): void {
        const resolver = approvalResolver.current;

        approvalResolver.current = null;

        setPendingApproval(null);

        resolver?.(approved);
    }

    function handleProviderCommand(command: string): boolean {
        const parts = command.trim().split(/\s+/);
        const subcommand = parts[1]?.toLowerCase();

        try {
            if (parts[0] === "/providers") {
                const availableProviders = agent.getAvailableProviders();
                const allProviders = agent.getAllProviders();
                const activeId = agent.getActiveProviderId();

                if (allProviders.length === 0) {
                    setEntries(previous => [
                        ...previous,
                        {
                            role: "assistant",
                            content: "Нет зарегистрированных провайдеров"
                        }
                    ]);

                    return true;
                }

                const providerList = allProviders.map(provider => {
                    const active = provider.id === activeId
                        ? " [ACTIVE]"
                        : "";

                    return `- ${provider.displayName} (${provider.id})${active}`;
                });

                setEntries(previous => [
                    ...previous,
                    {
                        role: "assistant",
                        content: [
                            "Зарегистрированные провайдеры:",
                            ...providerList,
                            "",
                            `Всего: ${availableProviders.length}`,
                            `Активный: ${agent.getActiveProvider()}`
                        ].join("\n")
                    }
                ]);

                return true;
            }

            if (parts[0] !== "/provider") {
                return false;
            }

            if (!subcommand) {
                const activeProvider = agent.getActiveProvider();
                const activeProviderId = agent.getActiveProviderId();

                setEntries(previous => [
                    ...previous,
                    {
                        role: "assistant",
                        content: `Активный провайдер: ${activeProvider} (${activeProviderId})`
                    }
                ]);

                return true;
            }

            if (subcommand === "add") {
                const id = parts.slice(2).join(" ");

                if (!id) {
                    throw new Error("Укажи идентификатор провайдера. Пример: /provider add openrouter");
                }

                if (agent.hasProvider(id)) {
                    throw new Error(`Провайдер ${id} уже зарегистрирован.`);
                }

                const provider = agent.registerProvider(id);

                refreshProviders();

                setEntries(previous => [
                    ...previous,
                    {
                        role: "assistant",
                        content: `Провайдер ${provider.displayName} (${provider.id}) зарегистрирован.`
                    }
                ]);

                return true;
            }

            if (subcommand === "use") {
                const id = parts.slice(2).join(" ");

                if (!id) {
                    throw new Error("Укажи идентификатор провайдера. Пример: /provider use openrouter");
                }

                agent.setActiveProvider(id);

                refreshProviders();

                setEntries(previous => [
                    ...previous,
                    {
                        role: "assistant",
                        content: `Активный провайдер изменён на ${agent.getActiveProvider()} (${agent.getActiveProviderId()}).`
                    }
                ]);

                return true;
            }

            if (subcommand === "remove") {
                const id = parts.slice(2).join(" ");

                if (!id) {
                    throw new Error("Укажи идентификатор провайдера для удаления");
                }

                if (!agent.hasProvider(id)) {
                    throw new Error(`Провайдер ${id} не зарегистрирован.`);
                }

                agent.removeProvider(id);

                refreshProviders();

                const activeProvider = agent.hasActiveProvider()
                    ? agent.getActiveProvider()
                    : "none";

                setEntries(previous => [
                    ...previous,
                    {
                        role: "assistant",
                        content: [
                            `Провайдер ${id} удалён.`,
                            `Текущий активный провайдер: ${activeProvider}.`
                        ].join("\n")
                    }
                ]);

                return true;
            }

            if (subcommand === "clear") {
                agent.clearProviders();

                refreshProviders();

                setEntries(previous => [
                    ...previous,
                    {
                        role: "assistant",
                        content: "Все провайдеры удалены. Для продолжения работы зарегистрируй провайдера"
                    }
                ]);

                return true;
            }

            throw new Error(
                [
                    "Неизвестная команда управления провайдерами",
                    "",
                    "/providers",
                    "/provider",
                    "/provider add <id>",
                    "/provider use <id>",
                    "/provider remove <id>",
                    "/provider clear"
                ].join("\n")
            );
        } catch (error: unknown) {
            setEntries(previous => [
                ...previous,
                {
                    role: "error",
                    content: error instanceof Error
                        ? error.message
                        : String(error)
                }
            ]);

            return true;
        }
    }

    useInput((input, key) => {
        if (key.ctrl && input === "c") {
            resolveApproval(false);

            exit();

            return;
        }

        if (pendingApproval) {
            if (input.toLowerCase() === "y") {
                resolveApproval(true);
            } else if (input.toLowerCase() === "n") {
                resolveApproval(false);
            }

            return;
        }

        if (loading) {
            return;
        }

        if (key.return) {
            const message = draft.trim();

            if (message.length > 0) {
                setDraft("");
                void sendMessage(message);
            }

            return;
        }

        if (key.backspace || key.delete) {
            setDraft(value => value.slice(0, -1));

            return;
        }

        if (input && !key.ctrl && !key.meta) {
            setDraft(value => value + input);
        }
    });

    return (
        <Box flexDirection="column" padding={1}>
            <Header
                provider={
                    agent.hasActiveProvider()
                        ? agent.getActiveProvider()
                        : "No provider"
                }
                model={Config.model}
            />
            <Box flexDirection="column" marginY={1}>
                {entries.length === 0 ? (
                    <Box flexDirection="column" paddingX={2} paddingY={1}>
                        <Text bold>
                            <Text color="white">Welcome to </Text>
                            {"OpenCLI".split("").map((char, index) => (
                                <Text key={index} color={rainbow[index % rainbow.length]}>
                                    {char}
                                </Text>
                            ))}
                        </Text>
                        <Text color="gray">
                            AI Coding Agent
                        </Text>
                        <Text color="gray">
                            Project: {process.cwd()}
                        </Text>
                        <Text color="gray">
                            Available tools: {agent.getAvailableTools().join(", ")}
                        </Text>
                    </Box>
                ) : (
                    entries.map((entry, index) => (
                        <ChatMessage key={index} message={entry}/>
                    ))
                )}
            </Box>
            <AgentActivity state={activityState} />
            {loading && (
                <Box marginY={1}>
                    <Text>
                        🤔 <Text color="white" bold>AI</Text>
                        <Text color="gray"> is thinking...</Text>
                    </Text>
                </Box>
            )}
            {pendingApproval && (
                <Box flexDirection="column" borderStyle="round" borderColor="#FFFF55" padding={1} marginY={1}>
                    <Text bold color="#FFFF55">
                        TOOL EXECUTION APPROVAL
                    </Text>
                    <Text color="white">
                        Tool: {pendingApproval.toolName}
                    </Text>
                    <Text color="gray">
                        Arguments:
                    </Text>
                    <Text wrap="wrap">
                        {JSON.stringify(
                            pendingApproval.args,
                            null,
                            2
                        )}
                    </Text>
                    <Text color="#FFFF55" bold>
                        Press Y to approve or N to reject.
                    </Text>
                </Box>
            )}
            <Input value={draft} loading={loading}/>
            <StatusBar />
        </Box>
    );
}
