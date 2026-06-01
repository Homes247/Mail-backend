import { IDisposable, IDocumentData, IPosition, Nullable, Disposable, IContextService } from '@univerjs/core';
import { Engine, IDocumentLayoutObject, RichText, Scene, DeviceInputEventType, IRenderManagerService } from '@univerjs/engine-render';
import { KeyCode } from '@univerjs/ui';
import { Observable, Subject } from 'rxjs';
import { IEditorService } from '@univerjs/docs-ui';
export declare enum SLIDE_VIEW_KEY {
    MAIN = "__SLIDERender__",
    SCENE_VIEWER = "__SLIDEViewer__",
    SCENE = "__SLIDEScene__",
    VIEWPORT = "__SLIDEViewPort_"
}
export declare const ISlideEditorBridgeService: import('@wendellhu/redi').IdentifierDecorator<SlideEditorBridgeService>;
export interface IEditorBridgeServiceParam {
    unitId: string;
    /**
     * pos and size of editing area
     */
    position: IPosition;
    slideCardOffset: {
        left: number;
        top: number;
    };
    documentLayoutObject: IDocumentLayoutObject;
    scaleX: number;
    scaleY: number;
    editorUnitId: string;
}
export interface IEditorBridgeServiceVisibleParam {
    visible: boolean;
    eventType: DeviceInputEventType;
    unitId: string;
    keycode?: KeyCode;
}
export interface ISetEditorInfo {
    scene: Scene;
    engine: Engine;
    unitId: string;
    pageId: string;
    richTextObj: RichText;
}
export interface ISlideEditorBridgeService {
    currentEditRectState$: Observable<Nullable<IEditorBridgeServiceParam>>;
    visible$: Observable<IEditorBridgeServiceVisibleParam>;
    /**
     * @deprecated This is a temp solution only for demo purposes. We should have mutations to directly write
     * content to slides.
     */
    endEditing$: Subject<RichText>;
    dispose(): void;
    setEditorRect(param: ISetEditorInfo): void;
    getEditorRect(): ISetEditorInfo;
    getEditRectState(): Readonly<Nullable<IEditorBridgeServiceParam>>;
    changeVisible(param: IEditorBridgeServiceVisibleParam): void;
    changeEditorDirty(dirtyStatus: boolean): void;
    getEditorDirty(): boolean;
    isVisible(): boolean;
    getCurrentEditorId(): Nullable<string>;
}
export declare class SlideEditorBridgeService extends Disposable implements ISlideEditorBridgeService, IDisposable {
    private readonly _editorService;
    private readonly _contextService;
    private readonly _renderManagerService;
    private _editorUnitId;
    private _isForceKeepVisible;
    private _editorIsDirty;
    private _currentEditRectState;
    private readonly _currentEditRectState$;
    readonly currentEditRectState$: Observable<Nullable<IEditorBridgeServiceParam>>;
    private _visibleParam;
    private readonly _visible$;
    readonly visible$: Observable<IEditorBridgeServiceVisibleParam>;
    private readonly _afterVisible$;
    readonly afterVisible$: Observable<IEditorBridgeServiceVisibleParam>;
    readonly endEditing$: Subject<RichText>;
    private _currentEditRectInfo;
    constructor(_editorService: IEditorService, _contextService: IContextService, _renderManagerService: IRenderManagerService);
    dispose(): void;
    getEditorRect(): ISetEditorInfo;
    /**
     * 1st part of startEditing.
     * @editorInfo editorInfo
     */
    setEditorRect(editorInfo: ISetEditorInfo): void;
    changeVisible(param: IEditorBridgeServiceVisibleParam): void;
    /**
     * get info from _currentEditRectInfo
     *
     * invoked by slide-editing.render-controller.ts@_handleEditorVisible
     * && this@setEditorRect
     */
    getEditRectState(): Readonly<Nullable<IEditorBridgeServiceParam>>;
    changeEditorDirty(dirtyStatus: boolean): void;
    isVisible(): boolean;
    getEditorDirty(): boolean;
    getCurrentEditorId(): string;
    /**
     * @deprecated
     */
    genDocData(target: RichText): IDocumentData;
}
