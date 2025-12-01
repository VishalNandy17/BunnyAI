// Mock vscode module for unit tests
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
    }
};

export const commands = {
    registerCommand: (command: string, callback: (...args: any[]) => any) => {
        return { dispose: () => {} };
    }
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
    getConfiguration: () => ({
        get: () => undefined
    })
};

export const ExtensionContext = class {
    subscriptions: any[] = [];
    extensionUri: any = { fsPath: '' };
    workspaceState: any = {};
    globalState: any = {};
};

