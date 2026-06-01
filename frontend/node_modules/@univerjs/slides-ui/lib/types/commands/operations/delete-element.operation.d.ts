import { ICommand } from '@univerjs/core';
export interface IDeleteElementOperationParams {
    unitId: string;
    id: string;
}
export declare const DeleteSlideElementOperation: ICommand<IDeleteElementOperationParams>;
