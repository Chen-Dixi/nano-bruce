import { getApiProvider } from './api-registry.js';
import type {
    Api,
    AssistantMessageEventStream,
    ChatMessage,
    ChatOptions,
    Model
} from './types.js';

function resolveApiProvider(api: Api) {
    const apiProvider = getApiProvider(api);
    if (!apiProvider) {
        throw new Error(`No API provider found for api ${api}`);
    }
    return apiProvider;
}

export function stream<TApi extends Api>(
    messages: ChatMessage[],
    options: ChatOptions,
): AssistantMessageEventStream {
    const model = options.model;
    if (!model) {
        throw new Error("Model is required");
    }
    const apiProvider = resolveApiProvider(model.api);
    return apiProvider.stream(messages, options);
}