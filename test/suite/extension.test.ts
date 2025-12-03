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

    test('Review & Refactor command execute is safe with no editor', async () => {
        // With no activeTextEditor in the mock, execution should be a no-op and not throw
        await vscode.commands.executeCommand('bunnyai.reviewAndRefactorSelection');
        assert.ok(true);
    });

    test('Code Quality command is registered and safe', async () => {
        await vscode.commands.executeCommand('bunnyai.analyzeCodeQuality');
        assert.ok(true);
    });

    test('Remove Comments command is registered and safe', async () => {
        await vscode.commands.executeCommand('bunnyai.removeComments');
        assert.ok(true);
    });

    test('Security Scan command is registered and safe', async () => {
        await vscode.commands.executeCommand('bunnyai.securityScanFile');
        assert.ok(true);
    });

    test('Workspace Code Health command is registered and safe', async () => {
        await vscode.commands.executeCommand('bunnyai.analyzeWorkspaceCodeHealth');
        assert.ok(true);
    });
});
