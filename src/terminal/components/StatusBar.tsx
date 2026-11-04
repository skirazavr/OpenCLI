import { Box, Text } from "ink";
import { Config } from "../../config/Config.js";

export function StatusBar() {
    return (
        <Box justifyContent="space-between" marginTop={1}>
            <Text color="gray" dimColor>
                Provider: {Config.providerName}
            </Text>
            <Text color="gray" dimColor>
                ENTER Send  ·  CTRL+C Exit
            </Text>
        </Box>
    );
}
