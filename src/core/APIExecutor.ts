import { IRequest, IResponse } from '../types';
import { HttpClient } from '../utils/httpClient';
import { Logger } from '../utils/logger';
import { AuthMiddleware } from '../middleware/AuthMiddleware';
import { RetryMiddleware } from '../middleware/RetryMiddleware';
import { CacheMiddleware } from '../middleware/CacheMiddleware';
import { ConfigManager } from './ConfigManager';

export class APIExecutor {
    private httpClient: HttpClient;
    private authMiddleware: AuthMiddleware;
    private retryMiddleware: RetryMiddleware;
    private cacheMiddleware: CacheMiddleware;
    private configManager: ConfigManager;

    constructor() {
        this.httpClient = new HttpClient();
        this.authMiddleware = new AuthMiddleware();
        this.retryMiddleware = new RetryMiddleware();
        this.cacheMiddleware = new CacheMiddleware();
        this.configManager = ConfigManager.getInstance();

        // Configure middleware from settings
        this.retryMiddleware.setMaxRetries(this.configManager.getMaxRetries());
        this.retryMiddleware.setRetryDelay(this.configManager.getRetryDelay());
        this.cacheMiddleware.setDefaultTTL(this.configManager.getCacheTTL());
    }

    async execute(request: IRequest): Promise<IResponse> {
        try {
            Logger.log(`Executing ${request.method} ${request.url}`);

            // Apply middleware chain
            const processedRequest = await this.authMiddleware.process(request);
            
            // Execute with retry logic
            const response = await this.retryMiddleware.execute(
                async () => {
                    // Check cache first for GET requests (if enabled)
                    if (request.method === 'GET' && this.configManager.isCacheEnabled()) {
                        const cached = await this.cacheMiddleware.get(request.url);
                        if (cached) {
                            Logger.log(`Cache hit for ${request.url}`);
                            return cached;
                        }
                    }

                    // Make actual HTTP request
                    const httpResponse = await this.httpClient.request({
                        method: processedRequest.method,
                        url: processedRequest.url,
                        headers: processedRequest.headers,
                        body: processedRequest.body,
                        timeout: this.configManager.getDefaultTimeout(),
                        maxRequestBodyBytes: this.configManager.getMaxRequestBodySize(),
                        maxResponseBytes: this.configManager.getMaxResponseSize()
                    });

                    // Cache GET responses (if enabled)
                    if (request.method === 'GET' && httpResponse.status === 200 && this.configManager.isCacheEnabled()) {
                        await this.cacheMiddleware.set(request.url, httpResponse);
                    }

                    return {
                        status: httpResponse.status,
                        statusText: httpResponse.statusText,
                        headers: httpResponse.headers,
                        data: httpResponse.data,
                        duration: httpResponse.duration,
                        size: httpResponse.size
                    } as IResponse;
                }
            );

            Logger.log(`Request completed: ${request.method} ${request.url} - ${response.status} (${response.duration}ms)`);
            return response;

        } catch (error: any) {
            Logger.error(`Request failed: ${request.method} ${request.url}`, error);
            
            // Return error response instead of throwing
            return {
                status: error.status || 0,
                statusText: error.statusText || 'Error',
                headers: error.headers || {},
                data: error.data || { error: error.message || 'Unknown error occurred' },
                duration: error.duration || 0,
                size: error.size || 0
            };
        }
    }
}
