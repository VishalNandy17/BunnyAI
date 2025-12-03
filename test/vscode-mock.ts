// Mock vscode module for unit tests
const registeredCommands: Record<string, (...args: any[]) => any> = {};

export const window = {
    showInformationMessage: (message: string) => {
        console.log(`[MOCK] showInformationMessage: ${message}`);
        return Promise.resolve(undefined);
    },
    showErrorMessage: (message: string) => {
        console.log(`[MOCK] showErrorMessage: ${message}`);
        return Promise.resolve(undefined);
    },
    showWarningMessage: (message: string) => {
        console.log(`[MOCK] showWarningMessage: ${message}`);
        return Promise.resolve(undefined);
    },
    createOutputChannel: (name: string) => {
        return {
            appendLine: (value: string) => console.log(`[${name}] ${value}`),
            show: () => {},
            hide: () => {},
            dispose: () => {}
        };
    },
    createStatusBarItem: () => ({
        text: '',
        tooltip: '',
        command: '',
        show: () => {},
        hide: () => {},
        dispose: () => {}
    }),
    createTreeView: () => ({
        onDidChangeSelection: { dispose: () => {} },
        reveal: () => {},
        dispose: () => {}
    }),
    showInputBox: () => Promise.resolve(undefined),
    activeTextEditor: undefined,
    createWebviewPanel: () => ({
        webview: { postMessage: () => {}, html: '', onDidReceiveMessage: { dispose: () => {} }, cspSource: '' },
        reveal: () => {},
        dispose: () => {},
        onDidDispose: { dispose: () => {} }
    }),
    withProgress: (_options: any, task: (progress: any, token: any) => Thenable<any>) => {
        const progress = { report: (_value: any) => {} };
        const token = { isCancellationRequested: false };
        return task(progress, token);
    },
    showQuickPick: (items: string[] | Thenable<string[]>, _options?: any) => {
        if (Array.isArray(items) && items.length > 0) {
            return Promise.resolve(items[0]);
        }
        return Promise.resolve(undefined);
    }
};

export const commands = {
    registerCommand: (command: string, callback: (...args: any[]) => any) => {
        registeredCommands[command] = callback;
        return {
            dispose: () => {
                delete registeredCommands[command];
            }
        };
    },
    executeCommand: (command: string, ...args: any[]) => {
        const handler = registeredCommands[command];
        if (handler) {
            return Promise.resolve(handler(...args));
        }
        return Promise.resolve(undefined);
    },
    getCommands: () => Promise.resolve(Object.keys(registeredCommands))
};

export const languages = {
    registerCodeLensProvider: (selector: any, provider: any) => {
        return { dispose: () => {} };
    }
};

export const ViewColumn = {
    One: 1,
    Two: 2,
    Three: 3
};

export const Uri = {
    joinPath: (...paths: any[]) => {
        return { fsPath: paths.join('/') };
    }
};

export const workspace = {
    workspaceFolders: [],
    getConfiguration: (section?: string) => ({
        get: (key: string, defaultValue?: any) => {
            // Return defaults for common config keys
            const defaults: Record<string, any> = {
                'baseUrl': '',
                'defaultTimeout': 30000,
                'enableCache': true,
                'cacheTTL': 300000,
                'maxRetries': 3,
                'retryDelay': 1000,
                'aiProvider': 'openai',
                'aiApiKey': undefined,
                'aiModel': 'gpt-4',
                'autoDetectFramework': true,
                'enableCodeLens': true,
                'maxRequestBodySize': 1024 * 1024,
                'maxResponseSize': 10 * 1024 * 1024
            };
            return defaults[key] !== undefined ? defaults[key] : defaultValue;
        },
        update: () => Promise.resolve()
    }),
    onDidChangeConfiguration: (callback: (e: any) => void) => {
        return { dispose: () => {} };
    },
    openTextDocument: () => Promise.resolve({
        getText: () => '',
        languageId: 'typescript'
    })
};

export const ExtensionContext = class {
    subscriptions: any[] = [];
    extensionUri: any = { fsPath: '' };
    workspaceState: any = {
        get: () => Promise.resolve(undefined),
        update: () => Promise.resolve()
    };
    globalState: any = {
        get: () => Promise.resolve(undefined),
        update: () => Promise.resolve()
    };
    secrets: any = {
        get: () => Promise.resolve(undefined),
        store: () => Promise.resolve(),
        delete: () => Promise.resolve()
    };
};

export const ProgressLocation = {
    Notification: 1,
    SourceControl: 2,
    Window: 3
};

export const ConfigurationTarget = {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3
};

export const StatusBarAlignment = {
    Left: 1,
    Right: 2
};

export class TreeItem {
    label: string;
    collapsibleState: any;
    contextValue?: string;

    constructor(label: string, collapsibleState: any) {
        this.label = label;
        this.collapsibleState = collapsibleState;
    }
}

export class EventEmitter {
    private listeners: Array<() => void> = [];
    
    fire() {
        this.listeners.forEach(listener => listener());
    }
    
    event(listener: () => void) {
        this.listeners.push(listener);
        return {
            dispose: () => {
                const index = this.listeners.indexOf(listener);
                if (index > -1) {
                    this.listeners.splice(index, 1);
                }
            }
        };
    }
    
    dispose() {
        this.listeners = [];
    }
}
