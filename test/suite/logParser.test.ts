import * as assert from 'assert';
import { LogParser } from '../../src/runtime/logParser';

suite('Log Parser Suite', () => {
    const parser = new LogParser();

    test('parses Node.js stack trace', () => {
        const log = `TypeError: Cannot read property 'foo' of undefined
    at Object.<anonymous> (/path/to/file.js:10:15)
    at Module._compile (internal/modules/cjs/loader.js:1063:30)
    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)
    at Module.load (internal/modules/cjs/loader.js:928:32)`;

        const result = parser.parseLogContent(log);
        assert.strictEqual(result.errors.length, 1);
        assert.strictEqual(result.errors[0].type, 'TypeError');
        assert.strictEqual(result.errors[0].message, "Cannot read property 'foo' of undefined");
        assert.strictEqual(result.errors[0].stackFrames.length, 4);
        assert.strictEqual(result.errors[0].stackFrames[0].file, '/path/to/file.js');
        assert.strictEqual(result.errors[0].stackFrames[0].line, 10);
        assert.strictEqual(result.errors[0].stackFrames[0].column, 15);
    });

    test('parses Python traceback', () => {
        const log = `Traceback (most recent call last):
  File "/path/to/script.py", line 5, in <module>
    result = divide(10, 0)
  File "/path/to/utils.py", line 12, in divide
    return a / b
ZeroDivisionError: division by zero`;

        const result = parser.parseLogContent(log);
        assert.strictEqual(result.errors.length, 1);
        assert.strictEqual(result.errors[0].type, 'ZeroDivisionError');
        assert.strictEqual(result.errors[0].message, 'division by zero');
        assert.strictEqual(result.errors[0].stackFrames.length, 2);
        assert.strictEqual(result.errors[0].stackFrames[0].file, '/path/to/script.py');
        assert.strictEqual(result.errors[0].stackFrames[0].line, 5);
        assert.strictEqual(result.errors[0].stackFrames[0].function, '<module>');
        assert.strictEqual(result.errors[0].stackFrames[1].file, '/path/to/utils.py');
        assert.strictEqual(result.errors[0].stackFrames[1].line, 12);
        assert.strictEqual(result.errors[0].stackFrames[1].function, 'divide');
    });

    test('parses Java exception', () => {
        const log = `java.lang.NullPointerException: Cannot invoke method on null
    at com.example.Service.process(Service.java:42)
    at com.example.Main.main(Main.java:15)`;

        const result = parser.parseLogContent(log);
        assert.strictEqual(result.errors.length, 1);
        assert.strictEqual(result.errors[0].type, 'java.lang.NullPointerException');
        assert.strictEqual(result.errors[0].message, 'Cannot invoke method on null');
        assert.strictEqual(result.errors[0].stackFrames.length, 2);
        assert.strictEqual(result.errors[0].stackFrames[0].file, 'Service.java');
        assert.strictEqual(result.errors[0].stackFrames[0].line, 42);
        assert.strictEqual(result.errors[0].stackFrames[0].function, 'com.example.Service.process');
    });

    test('parses Go panic', () => {
        const log = `panic: runtime error: index out of range [5] with length 3

goroutine 1 [running]:
main.processData(...)
        /path/to/main.go:25 +0x123
main.main()
        /path/to/main.go:10 +0x45`;

        const result = parser.parseLogContent(log);
        assert.strictEqual(result.errors.length, 1);
        assert.strictEqual(result.errors[0].type, 'panic');
        assert.ok(result.errors[0].message.includes('index out of range'));
        assert.strictEqual(result.errors[0].stackFrames.length, 2);
        assert.strictEqual(result.errors[0].stackFrames[0].file, '/path/to/main.go');
        assert.strictEqual(result.errors[0].stackFrames[0].line, 25);
        assert.strictEqual(result.errors[0].stackFrames[0].function, 'main.processData');
    });

    test('parses Docker logs', () => {
        const log = `2024-01-15T10:30:45Z error Database connection failed
2024-01-15T10:30:46Z warn Retrying connection...
2024-01-15T10:30:47Z info Connection established`;

        const result = parser.parseLogContent(log);
        assert.strictEqual(result.errors.length, 1);
        assert.strictEqual(result.warnings.length, 1);
        assert.strictEqual(result.info.length, 1);
        assert.strictEqual(result.errors[0].severity, 'error');
        assert.strictEqual(result.errors[0].message, 'Database connection failed');
        assert.ok(result.errors[0].timestamp?.includes('2024-01-15'));
        assert.strictEqual(result.warnings[0].severity, 'warning');
        assert.strictEqual(result.info[0].severity, 'info');
    });

    test('detects repeated patterns', () => {
        const log = `Error: Connection timeout
Error: Connection timeout
Error: Connection timeout
TypeError: Cannot read property`;

        const result = parser.parseLogContent(log);
        assert.strictEqual(result.errors.length, 4);
        const timeoutErrors = result.errors.filter(e => e.message === 'Connection timeout');
        assert.strictEqual(timeoutErrors.length, 3);
        assert.ok(timeoutErrors[0].repeatedPattern);
        assert.strictEqual(timeoutErrors[0].repeatedPattern?.count, 3);
    });

    test('handles empty log', () => {
        const result = parser.parseLogContent('');
        assert.strictEqual(result.errors.length, 0);
        assert.strictEqual(result.warnings.length, 0);
        assert.strictEqual(result.info.length, 0);
    });

    test('handles mixed log types', () => {
        const log = `2024-01-15T10:30:45Z error First error
TypeError: Cannot read property
2024-01-15T10:30:46Z warn Warning message
Traceback (most recent call last):
  File "test.py", line 1, in <module>
    raise ValueError("test")
ValueError: test`;

        const result = parser.parseLogContent(log);
        assert.ok(result.errors.length >= 3); // Docker error + Node error + Python error
        assert.strictEqual(result.warnings.length, 1);
    });

    test('extracts timestamps from Docker logs', () => {
        const log = `2024-01-15T10:30:45Z info Start
2024-01-15T10:35:20Z error End`;

        const result = parser.parseLogContent(log);
        assert.ok(result.summary.timeRange);
        assert.ok(result.summary.timeRange?.start.includes('2024-01-15'));
        assert.ok(result.summary.timeRange?.end.includes('2024-01-15'));
    });

    test('calculates unique errors correctly', () => {
        const log = `Error: Same error
Error: Same error
Error: Different error`;

        const result = parser.parseLogContent(log);
        assert.strictEqual(result.summary.totalErrors, 3);
        assert.strictEqual(result.summary.uniqueErrors, 2);
    });
});

