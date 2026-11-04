import type { ModelRequest } from "../protocol/ModelRequest.js";
import type { ModelResponse } from "../protocol/ModelResponse.js";
import type { ProviderEvent } from "../protocol/ProviderEvent.js";
import type { ModelCapabilities } from "../capabilities/ModelCapabilities.js";

export interface ModelProvider {
    readonly id: string;
    readonly displayName: string;
    readonly model: string;
    readonly capabilities: ModelCapabilities;

    chat(request: ModelRequest, signal?: AbortSignal): Promise<ModelResponse>;

    stream?(request: ModelRequest, signal?: AbortSignal): AsyncIterable<ProviderEvent>;
}