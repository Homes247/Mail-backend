import { ICellDataForSheetInterceptor, IScale } from '@univerjs/core';
import { SpreadsheetSkeleton, UniverRenderingContext, SheetExtension } from '@univerjs/engine-render';
import { ICellPermission } from '@univerjs/sheets';
export declare const RANGE_PROTECTION_CAN_VIEW_RENDER_EXTENSION_KEY = "RANGE_PROTECTION_CAN_VIEW_RENDER_EXTENSION_KEY";
export declare const RANGE_PROTECTION_CAN_NOT_VIEW_RENDER_EXTENSION_KEY = "RANGE_PROTECTION_CAN_NOT_VIEW_RENDER_EXTENSION_KEY";
export type IRangeProtectionRenderCellData = ICellDataForSheetInterceptor & {
    selectionProtection: ICellPermission[];
};
export declare abstract class RangeProtectionRenderExtension extends SheetExtension {
    abstract uKey: string;
    abstract Z_INDEX: number;
    protected _pattern: CanvasPattern | null;
    protected _img: HTMLImageElement;
    renderCache: Set<string>;
    constructor();
    clearCache(): void;
    protected abstract shouldRender(config: ICellPermission): boolean;
    draw(ctx: UniverRenderingContext, _parentScale: IScale, spreadsheetSkeleton: SpreadsheetSkeleton): void;
}
export declare class RangeProtectionCanViewRenderExtension extends RangeProtectionRenderExtension {
    uKey: string;
    Z_INDEX: number;
    constructor();
    protected shouldRender(config: ICellPermission): boolean;
}
export declare class RangeProtectionCanNotViewRenderExtension extends RangeProtectionRenderExtension {
    uKey: string;
    Z_INDEX: number;
    constructor();
    protected shouldRender(config: ICellPermission): boolean;
}
