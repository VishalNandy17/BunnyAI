import { BaseParser } from './BaseParser';
import { IRoute } from '../types';

export class FastAPIParser extends BaseParser {
    supports(languageId: string): boolean {
        return languageId === 'python';
    }

    async parse(content: string): Promise<IRoute[]> {
        return [];
    }
}
