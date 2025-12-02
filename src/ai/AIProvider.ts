import { IAIProvider } from '../types';
import { ConfigManager } from '../core/ConfigManager';
import { Logger } from '../utils/logger';
import { HttpClient } from '../utils/httpClient';
import { SecretStorage } from '../storage/SecretStorage';

export class AIProvider implements IAIProvider {
    private configManager: ConfigManager;
    private httpClient: HttpClient;
    private static readonly AI_SECRET_KEY = 'bunnyai.aiApiKey';
    private static readonly MIN_REQUEST_INTERVAL_MS = 500; // simple rate limit: 2 req/sec
    private static lastRequestTimestamp = 0;

    constructor() {
        this.configManager = ConfigManager.getInstance();
        this.httpClient = new HttpClient();
    }

    async generateTests(code: string): Promise<string> {
        try {
            const provider = this.configManager.getAIProvider();
            const apiKey = await this.getApiKey();
            const model = this.configManager.getAIModel() || 'gpt-4';

            if (!apiKey) {
                throw new Error('AI API key not configured. Please set bunnyai.aiApiKey in settings.');
            }

            const prompt = this.buildTestGenerationPrompt(code);
            const response = await this.callAI(provider, apiKey, model, prompt);
            return response;
        } catch (error: any) {
            Logger.error('Failed to generate tests', error);
            throw new Error(`Failed to generate tests: ${error.message}`);
        }
    }

    async generateDocs(code: string): Promise<string> {
        try {
            const provider = this.configManager.getAIProvider();
            const apiKey = await this.getApiKey();
            const model = this.configManager.getAIModel() || 'gpt-4';

            if (!apiKey) {
                throw new Error('AI API key not configured. Please set bunnyai.aiApiKey in settings.');
            }

            const prompt = this.buildDocGenerationPrompt(code);
            const response = await this.callAI(provider, apiKey, model, prompt);
            return response;
        } catch (error: any) {
            Logger.error('Failed to generate documentation', error);
            throw new Error(`Failed to generate documentation: ${error.message}`);
        }
    }

    async analyzeError(error: string): Promise<string> {
        try {
            const provider = this.configManager.getAIProvider();
            const apiKey = await this.getApiKey();
            const model = this.configManager.getAIModel() || 'gpt-4';

            if (!apiKey) {
                throw new Error('AI API key not configured. Please set bunnyai.aiApiKey in settings.');
            }

            const prompt = this.buildErrorAnalysisPrompt(error);
            const response = await this.callAI(provider, apiKey, model, prompt);
            return response;
        } catch (error: any) {
            Logger.error('Failed to analyze error', error);
            throw new Error(`Failed to analyze error: ${error.message}`);
        }
    }

    private async callAI(provider: string, apiKey: string, model: string, prompt: string): Promise<string> {
        switch (provider) {
            case 'openai':
                return this.callOpenAI(apiKey, model, prompt);
            case 'anthropic':
                return this.callAnthropic(apiKey, model, prompt);
            case 'custom':
                return this.callCustom(apiKey, model, prompt);
            default:
                throw new Error(`Unsupported AI provider: ${provider}`);
        }
    }

    private async callOpenAI(apiKey: string, model: string, prompt: string): Promise<string> {
        try {
            await this.enforceRateLimit();
            const response = await this.httpClient.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: model,
                    messages: [
                        { role: 'system', content: 'You are a helpful coding assistant.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 2000
                },
                {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            );

            if (response.status !== 200) {
                throw new Error(`OpenAI API error: ${response.statusText}`);
            }

            const data = response.data;
            if (data.choices && data.choices.length > 0) {
                return data.choices[0].message.content;
            }

            throw new Error('No response from OpenAI API');
        } catch (error: any) {
            Logger.error('OpenAI API call failed', error);
            throw error;
        }
    }

    private async callAnthropic(apiKey: string, model: string, prompt: string): Promise<string> {
        try {
            await this.enforceRateLimit();
            const response = await this.httpClient.post(
                'https://api.anthropic.com/v1/messages',
                {
                    model: model || 'claude-3-opus-20240229',
                    max_tokens: 2000,
                    messages: [
                        { role: 'user', content: prompt }
                    ]
                },
                {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                }
            );

            if (response.status !== 200) {
                throw new Error(`Anthropic API error: ${response.statusText}`);
            }

            const data = response.data;
            if (data.content && data.content.length > 0) {
                return data.content[0].text;
            }

            throw new Error('No response from Anthropic API');
        } catch (error: any) {
            Logger.error('Anthropic API call failed', error);
            throw error;
        }
    }

    private async callCustom(apiKey: string, model: string, prompt: string): Promise<string> {
        // For custom providers, user needs to configure the endpoint
        const customEndpoint = this.configManager.get<string>('customAIEndpoint');
        if (!customEndpoint) {
            throw new Error('Custom AI endpoint not configured');
        }

        try {
            await this.enforceRateLimit();
            const response = await this.httpClient.post(
                customEndpoint,
                {
                    model: model,
                    prompt: prompt
                },
                {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            );

            if (response.status !== 200) {
                throw new Error(`Custom AI API error: ${response.statusText}`);
            }

            return response.data.response || response.data.text || JSON.stringify(response.data);
        } catch (error: any) {
            Logger.error('Custom AI API call failed', error);
            throw error;
        }
    }

    /**
     * Retrieve the AI API key from SecretStorage, falling back to the
     * legacy configuration value and migrating it into SecretStorage.
     */
    private async getApiKey(): Promise<string> {
        const secretStorage = SecretStorage.getInstance();

        // 1) Try secret storage first
        const secret = (await secretStorage.get(AIProvider.AI_SECRET_KEY))?.trim();
        if (secret) {
            return secret;
        }

        // 2) Fallback: legacy configuration value, then migrate
        const configKey = this.configManager.getAIApiKey()?.trim();
        if (configKey) {
            try {
                await secretStorage.set(AIProvider.AI_SECRET_KEY, configKey);
                await this.configManager.update('aiApiKey', '');
                Logger.log('Migrated AI API key from configuration to SecretStorage.');
            } catch (error) {
                Logger.error('Failed to migrate AI API key to SecretStorage', error);
            }
            return configKey;
        }

        throw new Error(
            'AI API key not configured. Use the "BunnyAI: Configure AI API Key" command or set bunnyai.aiApiKey in settings.'
        );
    }

    /**
     * Very small in-memory rate limiter to avoid accidental rapid-fire
     * AI requests. This is intentionally simple and per-session only.
     */
    private async enforceRateLimit(): Promise<void> {
        const now = Date.now();
        const elapsed = now - AIProvider.lastRequestTimestamp;
        if (elapsed < AIProvider.MIN_REQUEST_INTERVAL_MS) {
            const delay = AIProvider.MIN_REQUEST_INTERVAL_MS - elapsed;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        AIProvider.lastRequestTimestamp = Date.now();
    }

    private buildTestGenerationPrompt(code: string): string {
        return `Generate comprehensive unit tests for the following code. Include:
1. Test cases for all functions/methods
2. Edge cases and error handling
3. Mock data where appropriate
4. Clear test descriptions

Code:
\`\`\`
${code}
\`\`\`

Generate the tests in the same language and testing framework commonly used for this code type.`;
    }

    private buildDocGenerationPrompt(code: string): string {
        return `Generate comprehensive documentation for the following code. Include:
1. Function/method descriptions
2. Parameter documentation
3. Return value documentation
4. Usage examples
5. Any important notes or warnings

Code:
\`\`\`
${code}
\`\`\`

Generate documentation in a format appropriate for the code language (JSDoc for JavaScript/TypeScript, docstrings for Python, etc.).`;
    }

    private buildErrorAnalysisPrompt(error: string): string {
        return `Analyze the following error and provide:
1. A clear explanation of what the error means
2. Common causes for this type of error
3. Step-by-step solutions to fix it
4. Prevention tips

Error:
\`\`\`
${error}
\`\`\`

Provide a detailed analysis with actionable solutions.`;
    }
}

