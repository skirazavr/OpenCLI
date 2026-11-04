import { Box, Text } from "ink";

interface InputProps {
    value: string;
    loading: boolean;
}

export function Input({ value, loading }: InputProps) {
    return (
        <Box flexDirection="column" borderStyle="round" borderColor={loading ? "#FFFF55" : "cyan"} paddingX={2} paddingY={1} marginTop={1}>
            <Box gap={1}>
                <Text color="cyan" bold>
                    ❯
                </Text>
                <Text color="white">
                    {value || (loading ? "Waiting for model response..." : "Enter your prompt...")}
                </Text>
                {!loading && (
                    <Text color="cyan">▌</Text>
                )}
            </Box>
            {loading && (
                <Text color="#FFFF55" dimColor>
                    AI is processing your request...
                </Text>
            )}
        </Box>
    );
}