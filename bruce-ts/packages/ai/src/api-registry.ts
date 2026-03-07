import type { Api, AssistantMessageEventStream, ChatMessage, ChatOptions, Model, Provider } from './types.js';

export type ApiStreamFunction = (
    messages: ChatMessage[],
    options: ChatOptions,
) => AssistantMessageEventStream;

interface ApiProvider {
    api: Api;
    stream: ApiStreamFunction
}

const apiProviderRegistry = new Map<string, ApiProvider>();

export function registerApiProvide(
    provider: ApiProvider) {
    apiProviderRegistry.set(provider.api, provider);
}

export function getApiProvider<Tapi extends Api>(
    api: Tapi
): ApiProvider | undefined {
    return apiProviderRegistry.get(api);
}

export function clearApiProviders(): void {
	apiProviderRegistry.clear();
}

