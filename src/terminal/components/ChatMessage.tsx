import { Box, Text } from "ink";

export interface ChatEntry {
    role: "user" | "assistant" | "error";
    content: string;
}

interface ChatMessageProps {
    message: ChatEntry;
}

export function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.role === "user";
    const isError = message.role === "error";

    const title = isUser
        ? "YOU"
        : isError
            ? "ERROR"
            : "OPENCLI";

    const color = isUser
        ? "#FFAA00"
        : isError
            ? "#FF5555"
            : "#FFFF55";

    return (
        <Box flexDirection="column" marginBottom={1}>
            <Box gap={1}>
                <Text bold color={color}>
                    {isUser ? "👤" : isError ? "!" : "🤖"}
                </Text>
                <Text bold color={color}>
                    {title}
                </Text>
            </Box>
            <Box paddingLeft={2}>
                <Text wrap="wrap">
                    {message.content}
                </Text>
            </Box>
        </Box>
    );
}
