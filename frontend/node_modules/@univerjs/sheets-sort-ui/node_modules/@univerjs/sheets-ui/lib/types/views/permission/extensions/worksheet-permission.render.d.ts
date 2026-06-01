import { IScale } from '@univerjs/core';
import { SpreadsheetSkeleton, UniverRenderingContext, SheetExtension } from '@univerjs/engine-render';
export declare const worksheetProtectionKey = "worksheet-protection";
export declare class WorksheetProtectionRenderExtension extends SheetExtension {
    uKey: string;
    Z_INDEX: number;
    private _pattern;
    private _img;
    constructor();
    draw(ctx: UniverRenderingContext, _parentScale: IScale, spreadsheetSkeleton: SpreadsheetSkeleton): false | undefined;
    setZIndex(zIndex: number): void;
}
