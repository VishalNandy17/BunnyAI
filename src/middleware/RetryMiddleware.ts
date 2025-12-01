import { Logger } from '../utils/logger';

export class RetryMiddleware {
    private maxRetries: number = 3;
    private retryDelay: number = 1000; // 1 second

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        let lastError: any;
        
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error: any) {
                lastError = error;
                
                // Don't retry on client errors (4xx) except 429 (rate limit)
                if (error.status >= 400 && error.status < 500 && error.status !== 429) {
                    throw error;
                }

                // Don't retry on last attempt
                if (attempt === this.maxRetries) {
                    break;
                }

                // Calculate exponential backoff delay
                const delay = this.retryDelay * Math.pow(2, attempt);
                Logger.log(`Retry attempt ${attempt + 1}/${this.maxRetries} after ${delay}ms`);
                
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError;
    }

    setMaxRetries(retries: number): void {
        this.maxRetries = retries;
    }

    setRetryDelay(delay: number): void {
        this.retryDelay = delay;
    }
}
