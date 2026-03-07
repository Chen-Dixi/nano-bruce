import { registerApiProvide, clearApiProviders } from '../api-registry.js';
import { streamOpenAICompletions } from './openai-provider.js';

/**
 * 内置api provider
 */
export function registerBuiltInApiProviders(): void {
    registerApiProvide({
        api: "openai-completions",
        stream: streamOpenAICompletions,
    });

    registerApiProvide({
        api: "moonshot-completions",
        stream: streamOpenAICompletions,
    });

    registerApiProvide({
        api: "deepseek-completions",
        stream: streamOpenAICompletions,
    });
}

export function resetApiProviders(): void {
	clearApiProviders();
	registerBuiltInApiProviders();
}

registerBuiltInApiProviders();