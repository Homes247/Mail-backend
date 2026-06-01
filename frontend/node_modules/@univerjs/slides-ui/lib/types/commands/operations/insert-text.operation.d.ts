import { ICommand } from '@univerjs/core';
export interface ISlideAddTextParam {
    text: string;
    unitId: string;
}
export declare const SlideAddTextCommand: ICommand;
export declare const SlideAddTextOperation: ICommand<ISlideAddTextParam>;
