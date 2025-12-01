import * as assert from 'assert';
import * as vscode from '../vscode-mock';

suite('Extension Test Suite', () => {
    test('Start all tests', () => {
        vscode.window.showInformationMessage('Start all tests.');
        assert.ok(true, 'Tests started');
    });

    test('Sample test', () => {
        assert.strictEqual(-1, [1, 2, 3].indexOf(5));
        assert.strictEqual(-1, [1, 2, 3].indexOf(0));
    });
});
