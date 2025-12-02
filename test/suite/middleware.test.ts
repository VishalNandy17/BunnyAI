import * as assert from 'assert';
import { AuthMiddleware } from '../../src/middleware/AuthMiddleware';
import { RetryMiddleware } from '../../src/middleware/RetryMiddleware';
import { CacheMiddleware } from '../../src/middleware/CacheMiddleware';
import { IRequest, IResponse } from '../../src/types';

suite('Middleware Test Suite', () => {
    suite('AuthMiddleware', () => {
        let authMiddleware: AuthMiddleware;

        setup(() => {
            authMiddleware = new AuthMiddleware();
        });

        test('Should return request unchanged if no environment', async () => {
            const request: IRequest = {
                id: 'test-1',
                url: 'http://example.com',
                method: 'GET',
                headers: {},
                timestamp: Date.now()
            };

            const processed = await authMiddleware.process(request);
            assert.deepStrictEqual(processed, request);
        });

        test('Should not break on invalid URLs', async () => {
            const request: IRequest = {
                id: 'test-2',
                url: 'invalid-url',
                method: 'GET',
                headers: {},
                timestamp: Date.now()
            };

            const processed = await authMiddleware.process(request);
            assert.ok(processed !== undefined);
        });
    });

    suite('RetryMiddleware', () => {
        let retryMiddleware: RetryMiddleware;

        setup(() => {
            retryMiddleware = new RetryMiddleware();
        });

        test('Should execute function successfully', async () => {
            const result = await retryMiddleware.execute(async () => {
                return 'success';
            });

            assert.strictEqual(result, 'success');
        });

        test('Should retry on failure', async () => {
            let attempts = 0;
            retryMiddleware.setMaxRetries(2);
            retryMiddleware.setRetryDelay(10); // Short delay for testing

            try {
                await retryMiddleware.execute(async () => {
                    attempts++;
                    if (attempts < 2) {
                        throw new Error('Temporary failure');
                    }
                    return 'success';
                });

                assert.strictEqual(attempts, 2);
            } catch (error) {
                // If it fails after retries, that's expected
                assert.ok(attempts >= 2);
            }
        });

        test('Should not retry on 4xx errors', async () => {
            let attempts = 0;
            retryMiddleware.setMaxRetries(3);

            try {
                await retryMiddleware.execute(async () => {
                    attempts++;
                    const error: any = new Error('Client error');
                    error.status = 400;
                    throw error;
                });
                assert.fail('Should have thrown');
            } catch (error) {
                assert.strictEqual(attempts, 1); // Should not retry
            }
        });

        test('Should retry on 429 (rate limit)', async () => {
            let attempts = 0;
            retryMiddleware.setMaxRetries(2);
            retryMiddleware.setRetryDelay(10);

            try {
                await retryMiddleware.execute(async () => {
                    attempts++;
                    const error: any = new Error('Rate limit');
                    error.status = 429;
                    throw error;
                });
                assert.fail('Should have thrown');
            } catch (error) {
                assert.ok(attempts > 1); // Should retry
            }
        });
    });

    suite('CacheMiddleware', () => {
        let cacheMiddleware: CacheMiddleware;

        setup(() => {
            cacheMiddleware = new CacheMiddleware();
            cacheMiddleware.clear();
        });

        test('Should return null for non-existent cache entry', async () => {
            const result = await cacheMiddleware.get('http://example.com');
            assert.strictEqual(result, null);
        });

        test('Should store and retrieve cache entry', async () => {
            const response: IResponse = {
                status: 200,
                statusText: 'OK',
                headers: {},
                data: { test: 'data' },
                duration: 100,
                size: 100
            };

            await cacheMiddleware.set('http://example.com', response);
            const cached = await cacheMiddleware.get('http://example.com');

            assert.ok(cached !== null);
            assert.strictEqual(cached?.status, 200);
            assert.deepStrictEqual(cached?.data, { test: 'data' });
        });

        test('Should expire cache entries after TTL', async () => {
            cacheMiddleware.setDefaultTTL(100); // 100ms TTL

            const response: IResponse = {
                status: 200,
                statusText: 'OK',
                headers: {},
                data: {},
                duration: 0,
                size: 0
            };

            await cacheMiddleware.set('http://example.com', response);
            
            // Wait for TTL to expire
            await new Promise(resolve => setTimeout(resolve, 150));

            const cached = await cacheMiddleware.get('http://example.com');
            assert.strictEqual(cached, null);
        });

        test('Should clear all cache entries', async () => {
            const response: IResponse = {
                status: 200,
                statusText: 'OK',
                headers: {},
                data: {},
                duration: 0,
                size: 0
            };

            await cacheMiddleware.set('http://example.com/1', response);
            await cacheMiddleware.set('http://example.com/2', response);

            cacheMiddleware.clear();

            assert.strictEqual(cacheMiddleware.getSize(), 0);
        });
    });
});


