import { IParser, IRoute } from '../types';

export abstract class BaseParser implements IParser {
    abstract parse(content: string): Promise<IRoute[]>;
    abstract supports(languageId: string): boolean;
}
