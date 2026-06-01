import { ICommandService, IContextService, IUniverInstanceService, RxDisposable } from '@univerjs/core';
import { IRenderManagerService } from '@univerjs/engine-render';
import { ISidebarService } from '@univerjs/ui';
import { SlideCanvasPopMangerService } from '../services/slide-popup-manager.service';
import { CanvasView } from './canvas-view';
export declare class SlidePopupMenuController extends RxDisposable {
    private readonly _canvasPopManagerService;
    private readonly _renderManagerService;
    private readonly _univerInstanceService;
    private readonly _contextService;
    private readonly _canvasView;
    private readonly _sidebarService;
    private readonly _commandService;
    private _initImagePopupMenu;
    constructor(_canvasPopManagerService: SlideCanvasPopMangerService, _renderManagerService: IRenderManagerService, _univerInstanceService: IUniverInstanceService, _contextService: IContextService, _canvasView: CanvasView, _sidebarService: ISidebarService, _commandService: ICommandService);
    private _init;
    private _create;
    private _hasCropObject;
    private _popupMenuListener;
    private _getMenuItemsByObjectType;
}
