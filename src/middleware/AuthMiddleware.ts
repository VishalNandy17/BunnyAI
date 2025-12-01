import { IRequest } from '../types';
import { EnvironmentManager } from '../core/EnvironmentManager';
import { ConfigManager } from '../core/ConfigManager';
import { Logger } from '../utils/logger';

export class AuthMiddleware {
    private environmentManager: EnvironmentManager;
    private configManager: ConfigManager;

    constructor() {
        this.environmentManager = EnvironmentManager.getInstance();
        this.configManager = ConfigManager.getInstance();
    }

    async process(request: IRequest): Promise<IRequest> {
        try {
            const env = await this.environmentManager.getActiveEnvironment();
            if (!env) {
                return request;
            }

            const processedRequest = { ...request };
            
            // Add API key from environment if present
            if (env.apiKey) {
                processedRequest.headers = {
                    ...processedRequest.headers,
                    'Authorization': `Bearer ${env.apiKey}`
                };
            }

            // Add custom headers from environment
            if (env.headers) {
                processedRequest.headers = {
                    ...processedRequest.headers,
                    ...env.headers
                };
            }

            // Replace environment variables in URL
            let baseUrl = env.baseUrl || this.configManager.getBaseUrl();
            if (baseUrl) {
                try {
                    const url = new URL(processedRequest.url);
                    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || !url.hostname) {
                        const baseUrlObj = new URL(baseUrl);
                        processedRequest.url = `${baseUrlObj.origin}${url.pathname}${url.search}`;
                    }
                } catch (e) {
                    Logger.log('Could not replace base URL: ' + e);
                }
            }

            return processedRequest;
        } catch (error) {
            Logger.error('AuthMiddleware error', error);
            return request;
        }
    }
}
