import * as assert from 'assert';
import { scanSecurity, SecurityScanResult } from '../../src/analysis/securityScanner';

suite('Security Scanner Suite', () => {
    test('detects hardcoded API key', () => {
        const code = `
const apiKey = "test_api_key_12345678901234567890abcdef";
function getData() {
    return fetch('/api/data');
}
`;
        const result = scanSecurity(code, 'typescript', 'test.ts');
        assert.strictEqual(result.issues.length, 1);
        assert.strictEqual(result.issues[0].ruleId, 'hardcoded-api-key');
        assert.strictEqual(result.issues[0].severity, 'high');
    });

    test('detects hardcoded password', () => {
        const code = `
const password = "mypassword123";
const user = "admin";
`;
        const result = scanSecurity(code, 'javascript', 'test.js');
        assert.strictEqual(result.issues.length, 1);
        assert.strictEqual(result.issues[0].ruleId, 'hardcoded-password');
        assert.strictEqual(result.issues[0].severity, 'high');
    });

    test('detects eval usage', () => {
        const code = `
function executeCode(code) {
    return eval(code);
}
`;
        const result = scanSecurity(code, 'javascript', 'test.js');
        assert.strictEqual(result.issues.length, 1);
        assert.strictEqual(result.issues[0].ruleId, 'eval-usage');
        assert.strictEqual(result.issues[0].severity, 'high');
    });

    test('detects SQL string concatenation', () => {
        const code = `
const query = "SELECT * FROM users WHERE id = " + userId;
db.query(query);
`;
        const result = scanSecurity(code, 'javascript', 'test.js');
        assert.strictEqual(result.issues.length, 1);
        assert.strictEqual(result.issues[0].ruleId, 'sql-string-concat');
        assert.strictEqual(result.issues[0].severity, 'high');
    });

    test('detects insecure HTTP', () => {
        const code = `
fetch('http://api.example.com/data');
`;
        const result = scanSecurity(code, 'javascript', 'test.js');
        assert.strictEqual(result.issues.length, 1);
        assert.strictEqual(result.issues[0].ruleId, 'http-insecure');
        assert.strictEqual(result.issues[0].severity, 'medium');
    });

    test('ignores HTTP for localhost', () => {
        const code = `
fetch('http://localhost:3000/api/data');
`;
        const result = scanSecurity(code, 'javascript', 'test.js');
        assert.strictEqual(result.issues.length, 0);
    });

    test('detects innerHTML assignment', () => {
        const code = `
document.getElementById('content').innerHTML = userInput;
`;
        const result = scanSecurity(code, 'javascript', 'test.js');
        assert.strictEqual(result.issues.length, 1);
        assert.strictEqual(result.issues[0].ruleId, 'innerhtml-usage');
        assert.strictEqual(result.issues[0].severity, 'medium');
    });

    test('does not flag comments containing keywords', () => {
        const code = `
// This is a comment about apiKey but not actual code
const data = "some value";
`;
        const result = scanSecurity(code, 'javascript', 'test.js');
        assert.strictEqual(result.issues.length, 0);
    });

    test('does not flag strings containing keywords', () => {
        const code = `
const message = "The apiKey variable should be set";
const description = "This uses eval() internally";
`;
        const result = scanSecurity(code, 'javascript', 'test.js');
        assert.strictEqual(result.issues.length, 0);
    });

    test('detects multiple issues', () => {
        const code = `
const apiKey = "test_api_key_12345678901234567890abcdef";
const password = "secret123";
eval("some code");
`;
        const result = scanSecurity(code, 'javascript', 'test.js');
        assert.ok(result.issues.length >= 3);
        const ruleIds = result.issues.map(i => i.ruleId);
        assert.ok(ruleIds.includes('hardcoded-api-key'));
        assert.ok(ruleIds.includes('hardcoded-password'));
        assert.ok(ruleIds.includes('eval-usage'));
    });

    test('detects MD5 usage', () => {
        const code = `
const hash = md5(password);
`;
        const result = scanSecurity(code, 'javascript', 'test.js');
        assert.strictEqual(result.issues.length, 1);
        assert.strictEqual(result.issues[0].ruleId, 'md5-usage');
        assert.strictEqual(result.issues[0].severity, 'medium');
    });

    test('detects Function constructor', () => {
        const code = `
const fn = new Function('x', 'return x * 2');
`;
        const result = scanSecurity(code, 'javascript', 'test.js');
        assert.strictEqual(result.issues.length, 1);
        assert.strictEqual(result.issues[0].ruleId, 'function-constructor');
        assert.strictEqual(result.issues[0].severity, 'high');
    });

    test('detects SQL template literal', () => {
        const code = `
const query = \`SELECT * FROM users WHERE id = \${userId}\`;
`;
        const result = scanSecurity(code, 'typescript', 'test.ts');
        assert.strictEqual(result.issues.length, 1);
        assert.strictEqual(result.issues[0].ruleId, 'sql-template-literal');
        assert.strictEqual(result.issues[0].severity, 'high');
    });

    test('returns empty issues for clean code', () => {
        const code = `
function add(a: number, b: number): number {
    return a + b;
}
`;
        const result = scanSecurity(code, 'typescript', 'test.ts');
        assert.strictEqual(result.issues.length, 0);
    });
});

