import type { ModelProvider } from "./ModelProvider.js";

export class ProviderRegistry {
    private readonly providers = new Map<string, ModelProvider>();
    private activeProviderId: string | null = null;

    register(provider: ModelProvider): void {
        if (this.has(provider.id)) {
            throw new Error(`Provider already registered: ${provider.id}`);
        }

        this.providers.set(provider.id, provider);

        if (!this.hasActive()) {
            this.activeProviderId = provider.id;
        }
    }

    get(id: string): ModelProvider {
        const provider = this.providers.get(id);

        if (!provider) {
            throw new Error(`Unknown provider: ${id}. ` + `Available: ${this.list().join(", ") || "none"}`);
        }

        return provider;
    }

    getActive(): ModelProvider {
        if (!this.hasActive()) {
            throw new Error("No active AI provider configured");
        }

        return this.get(this.activeProviderId!);
    }

    getActiveId(): string | null {
        return this.activeProviderId;
    }

    setActive(id: string): void {
        if (!this.has(id)) {
            throw new Error(`Cannot activate unknown provider: ${id}. ` + `Available: ${this.list().join(", ") || "none"}`);
        }

        this.activeProviderId = id;
    }

    has(id: string): boolean {
        return this.providers.has(id);
    }

    hasActive(): boolean {
        return (this.activeProviderId !== null && this.providers.has(this.activeProviderId));
    }

    list(): string[] {
        return [...this.providers.keys()];
    }

    getAll(): ModelProvider[] {
        return [...this.providers.values()];
    }

    remove(id: string): boolean {
        if (!this.providers.delete(id)) {
            return false;
        }

        if (this.activeProviderId === id) {
            const nextProvider = this.providers.keys().next();

            this.activeProviderId = nextProvider.done
                ? null
                : nextProvider.value;
        }

        return true;
    }

    clear(): void {
        this.providers.clear();
        this.activeProviderId = null;
    }
}