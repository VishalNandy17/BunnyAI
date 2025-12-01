import { BaseParser } from './BaseParser';
import { IRoute } from '../types';

export class DjangoParser extends BaseParser {
    supports(languageId: string): boolean {
        return languageId === 'python';
    }

    async parse(content: string): Promise<IRoute[]> {
        return [];
    }
}
