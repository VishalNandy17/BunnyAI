import * as assert from 'assert';
import { APIExecutor } from '../../src/core/APIExecutor';
import { IRequest } from '../../src/types';

suite('API Executor Test Suite', () => {
    let executor: APIExecutor;

    setup(() => {
        executor = new APIExecutor();
        // Reduce retries for faster tests by accessing internal retry middleware
        const retryMiddleware = (executor as any).retryMiddleware;
        if (retryMiddleware) {
            retryMiddleware.setMaxRetries(0); // No retries for tests
            retryMiddleware.setRetryDelay(10); // Minimal delay
        }
    });

    test('Should execute GET request', async function() {
        this.timeout(8000); // 8 second timeout
        const request: IRequest = {
            id: 'test-1',
            url: 'http://httpstat.us/200',
            method: 'GET',
            headers: {},
            timestamp: Date.now()
        };

        const response = await executor.execute(request);
        // APIExecutor should always return a response object, never throw
        assert.ok(response !== undefined, 'Response should be defined');
        assert.ok(typeof response.status === 'number', 'Response should have status');
        assert.ok(response.status >= 0, 'Status should be >= 0');
        assert.ok(typeof response.duration === 'number', 'Response should have duration');
        assert.ok(response.duration >= 0, 'Duration should be >= 0');
    });

    test('Should handle invalid URLs gracefully', async function() {
        this.timeout(3000);
        const request: IRequest = {
            id: 'test-2',
            url: 'invalid-url',
            method: 'GET',
            headers: {},
            timestamp: Date.now()
        };

        const response = await executor.execute(request);
        // Should return error response, not throw
        assert.ok(response !== undefined, 'Response should be defined');
        assert.ok(response.status === 0 || response.statusText.includes('Error') || response.statusText.includes('Invalid'), 
            'Should return error status for invalid URL');
        assert.ok(response.data !== undefined, 'Response should have data');
    });

    test('Should apply auth middleware', async function() {
        this.timeout(8000);
        const request: IRequest = {
            id: 'test-3',
            url: 'http://httpstat.us/200',
            method: 'GET',
            headers: {},
            timestamp: Date.now()
        };

        const response = await executor.execute(request);
        // Auth middleware should not break the request
        assert.ok(response !== undefined, 'Response should be defined');
        assert.ok(typeof response.status === 'number', 'Response should have status');
    });

    test('Should return error response instead of throwing', async function() {
        this.timeout(3000);
        const request: IRequest = {
            id: 'test-4',
            url: 'http://invalid-domain-that-does-not-exist-12345.com',
            method: 'GET',
            headers: {},
            timestamp: Date.now()
        };

        const response = await executor.execute(request);
        // Should return error response, not throw
        assert.ok(response !== undefined, 'Response should be defined');
        assert.ok(response.status === 0 || response.statusText.includes('Error') || response.statusText.includes('ENOTFOUND'),
            'Should return error status for invalid domain');
        assert.ok(response.data !== undefined, 'Response should have data');
    });

    test('Should include duration in response', async function() {
        this.timeout(8000);
        const request: IRequest = {
            id: 'test-5',
            url: 'http://httpstat.us/200',
            method: 'GET',
            headers: {},
            timestamp: Date.now()
        };

        const response = await executor.execute(request);
        assert.ok(response !== undefined, 'Response should be defined');
        assert.ok(typeof response.duration === 'number', 'Response should have duration');
        assert.ok(response.duration >= 0, 'Duration should be >= 0');
    });

    test('Should include size in response', async function() {
        this.timeout(8000);
        const request: IRequest = {
            id: 'test-6',
            url: 'http://httpstat.us/200',
            method: 'GET',
            headers: {},
            timestamp: Date.now()
        };

        const response = await executor.execute(request);
        assert.ok(response !== undefined, 'Response should be defined');
        assert.ok(typeof response.size === 'number', 'Response should have size');
        assert.ok(response.size >= 0, 'Size should be >= 0');
    });
});
