import { BaseParser } from './BaseParser';
import { IRoute } from '../types';

export class SpringBootParser extends BaseParser {
    supports(languageId: string): boolean {
        return languageId === 'java';
    }

    async parse(content: string): Promise<IRoute[]> {
        return [];
    }
}
