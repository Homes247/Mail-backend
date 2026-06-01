import { IPageElement, Nullable, RxDisposable } from '@univerjs/core';
import { BaseObject, IRenderModule, IRenderManagerService } from '@univerjs/engine-render';
import { PageID } from '../type';
export declare class CanvasView extends RxDisposable implements IRenderModule {
    private readonly _renderManagerService;
    constructor(_renderManagerService: IRenderManagerService);
    private _getSlideRenderControllerFromRenderUnit;
    createThumbs(unitId: string): void;
    activePage(pageId: string, unitId: string): void;
    getRenderUnitByPageId(pageId: PageID, unitId: string): {
        scene: import('@univerjs/engine-render').Scene;
        engine: import('@univerjs/engine-render').Engine;
        unit: import('@univerjs/core').UnitModel<object, number>;
    };
    createObjectToPage(element: IPageElement, pageID: PageID, unitId: string): Nullable<BaseObject>;
    setObjectActiveByPage(obj: BaseObject, pageID: PageID, unitId: string): void;
    removeObjectById(id: string, pageID: PageID, unitId: string): void;
    /**
     * append blank page
     */
    appendPage(unitId: string): void;
}
