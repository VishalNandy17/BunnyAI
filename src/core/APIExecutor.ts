import { IRequest, IResponse } from '../types';

export class APIExecutor {
    async execute(request: IRequest): Promise<IResponse> {
        return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: {},
            duration: 0,
            size: 0
        };
    }
}
