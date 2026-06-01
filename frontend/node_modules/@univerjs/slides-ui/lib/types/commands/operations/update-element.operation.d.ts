import { ICommand } from '@univerjs/core';
export interface IUpdateElementOperationParams {
    unitId: string;
    oKey: string;
    props: Record<string, any>;
}
export declare const UpdateSlideElementOperation: ICommand<IUpdateElementOperationParams>;
