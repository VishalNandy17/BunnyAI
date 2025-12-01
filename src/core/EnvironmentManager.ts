export class EnvironmentManager {
    private variables: Map<string, string> = new Map();

    get(key: string): string | undefined {
        return this.variables.get(key);
    }

    set(key: string, value: string): void {
        this.variables.set(key, value);
    }
}
