import * as path from 'path';

// Use require for CommonJS modules
const Mocha = require('mocha');
const glob = require('glob');

// Mock vscode module before any imports
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id: string) {
    if (id === 'vscode') {
        return require('./vscode-mock');
    }
    return originalRequire.apply(this, arguments);
};

// Initialize Logger and WorkspaceStorage before tests
try {
    const { Logger } = require('../src/utils/logger');
    Logger.initialize('BunnyAI Pro Tests');
    
    // Mock ExtensionContext for WorkspaceStorage
    const mockContext = {
        workspaceState: {
            get: () => Promise.resolve(undefined),
            update: () => Promise.resolve()
        }
    };
    const { WorkspaceStorage } = require('../src/storage/WorkspaceStorage');
    WorkspaceStorage.initialize(mockContext);
} catch (e) {
    // Logger might not be available, continue
    console.log('Test setup warning:', e);
}

export function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true
    });

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise((resolve, reject) => {
        glob('**/**.test.js', { cwd: testsRoot }, (err: Error | null, files: string[]) => {
            if (err) {
                return reject(err);
            }

            // Add files to the test suite
            files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

            try {
                // Run the mocha test
                mocha.run((failures: number) => {
                    if (failures > 0) {
                        reject(new Error(`${failures} tests failed.`));
                    } else {
                        resolve();
                    }
                });
            } catch (err) {
                console.error(err);
                reject(err);
            }
        });
    });
}

// If this file is run directly, execute the tests
if (require.main === module) {
    run().then(
        () => {
            console.log('All tests passed!');
            process.exit(0);
        },
        (err) => {
            console.error('Tests failed:', err);
            process.exit(1);
        }
    );
}
