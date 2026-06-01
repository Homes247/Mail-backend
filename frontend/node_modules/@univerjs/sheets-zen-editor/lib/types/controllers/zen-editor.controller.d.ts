import { RxDisposable } from '@univerjs/core';
import { IRenderManagerService } from '@univerjs/engine-render';
import { IZenEditorManagerService } from '../services/zen-editor.service';
export declare class ZenEditorController extends RxDisposable {
    private readonly _zenEditorManagerService;
    private readonly _renderManagerService;
    constructor(_zenEditorManagerService: IZenEditorManagerService, _renderManagerService: IRenderManagerService);
    private _initialize;
    private _syncZenEditorSize;
    private _calculatePagePosition;
    private _scrollToTop;
}
