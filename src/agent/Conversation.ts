import type { ModelMessage } from "../protocol/ModelMessage.js";

export class Conversation {
    private readonly messages: ModelMessage[];

    constructor(systemPrompt: string) {
        this.messages = [
            {
                role: "system",
                content: systemPrompt
            }
        ];
    }

    add(message: ModelMessage): void {
        this.messages.push(message);
    }

    getMessages(): ModelMessage[] {
        return [...this.messages];
    }

    clear(systemPrompt: string): void {
        this.messages.length = 0;

        this.messages.push({
            role: "system",
            content: systemPrompt
        });
    }

    get size(): number {
        return this.messages.length;
    }
}
