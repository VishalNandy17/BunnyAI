import * as assert from 'assert';
import { ConfigManager } from '../../src/core/ConfigManager';

suite('Config Manager Test Suite', () => {
    test('Should get default timeout', () => {
        const config = ConfigManager.getInstance();
        const timeout = config.getDefaultTimeout();
        assert.ok(typeof timeout === 'number');
        assert.ok(timeout > 0);
    });

    test('Should get cache enabled status', () => {
        const config = ConfigManager.getInstance();
        const enabled = config.isCacheEnabled();
        assert.ok(typeof enabled === 'boolean');
    });

    test('Should get cache TTL', () => {
        const config = ConfigManager.getInstance();
        const ttl = config.getCacheTTL();
        assert.ok(typeof ttl === 'number');
        assert.ok(ttl > 0);
    });

    test('Should get max retries', () => {
        const config = ConfigManager.getInstance();
        const retries = config.getMaxRetries();
        assert.ok(typeof retries === 'number');
        assert.ok(retries >= 0);
    });

    test('Should get retry delay', () => {
        const config = ConfigManager.getInstance();
        const delay = config.getRetryDelay();
        assert.ok(typeof delay === 'number');
        assert.ok(delay >= 0);
    });

    test('Should get AI provider', () => {
        const config = ConfigManager.getInstance();
        const provider = config.getAIProvider();
        assert.ok(['openai', 'anthropic', 'custom'].includes(provider));
    });

    test('Should get max request body size', () => {
        const config = ConfigManager.getInstance();
        const size = config.getMaxRequestBodySize();
        assert.ok(typeof size === 'number');
        assert.ok(size > 0);
    });

    test('Should get max response size', () => {
        const config = ConfigManager.getInstance();
        const size = config.getMaxResponseSize();
        assert.ok(typeof size === 'number');
        assert.ok(size > 0);
    });
});


