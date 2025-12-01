import { AIProvider } from './AIProvider';

export class AIDocGenerator {
    private aiProvider: AIProvider;

    constructor() {
        this.aiProvider = new AIProvider();
    }

    async generateDocs(code: string): Promise<string> {
        return this.aiProvider.generateDocs(code);
    }
}
