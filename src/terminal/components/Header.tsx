import { Box, Text } from "ink";

interface HeaderProps {
    model: string;
    provider: string;
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

export function Header({ model, provider }: HeaderProps) {
    return (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1} marginBottom={1}>
            <Box justifyContent="space-between">
                <Text bold>
                    {"OpenCLI".split("").map((char, index) => (
                        <Text key={index} color={rainbow[index]}>
                            {char}
                        </Text>
                    ))}
                </Text>
                <Text color="#55FF55">
                    READY
                </Text>
            </Box>
            <Box gap={2}>
                <Text color="gray">AI CODING AGENT</Text>
                <Text color="gray">│</Text>
                <Text color="white">{provider}</Text>
                <Text color="gray">│</Text>
                <Text color="#FF5555">{model}</Text>
            </Box>
        </Box>
    );
}
