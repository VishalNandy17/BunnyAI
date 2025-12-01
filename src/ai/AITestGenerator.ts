import { IAIProvider } from '../types';
import { AIProvider } from './AIProvider';

export class AITestGenerator implements IAIProvider {
    private aiProvider: AIProvider;

    constructor() {
        this.aiProvider = new AIProvider();
    }

    async generateTests(code: string): Promise<string> {
        return this.aiProvider.generateTests(code);
    }

    async generateDocs(code: string): Promise<string> {
        return this.aiProvider.generateDocs(code);
    }

    async analyzeError(error: string): Promise<string> {
        return this.aiProvider.analyzeError(error);
    }
}
