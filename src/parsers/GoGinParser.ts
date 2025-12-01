import { BaseParser } from './BaseParser';
import { IRoute } from '../types';

export class GoGinParser extends BaseParser {
    supports(languageId: string): boolean {
        return languageId === 'go';
    }

    async parse(content: string): Promise<IRoute[]> {
        return [];
    }
}
