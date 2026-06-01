import { IContextService, IUniverInstanceService, RxDisposable } from '@univerjs/core';
import { IRenderManagerService } from '@univerjs/engine-render';
/**
 * This controller is responsible for managing units of a specific kind to be rendered on the canvas.
 */
export declare class SlideRenderService extends RxDisposable {
    private readonly _contextService;
    private readonly _instanceSrv;
    private readonly _renderManagerService;
    constructor(_contextService: IContextService, _instanceSrv: IUniverInstanceService, _renderManagerService: IRenderManagerService);
    private _init;
    private _initSlideDataListener;
    private _createRenderer;
    private _disposeRenderer;
    private _initContextListener;
}
