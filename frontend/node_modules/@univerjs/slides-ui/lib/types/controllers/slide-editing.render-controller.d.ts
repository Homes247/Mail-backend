import { Nullable, UnitModel, Disposable, ICommandService, IContextService, IUndoRedoService, IUniverInstanceService, LocaleService } from '@univerjs/core';
import { IDocObjectParam, IEditorService } from '@univerjs/docs-ui';
import { IRenderContext, IRenderModule, IRenderManagerService } from '@univerjs/engine-render';
import { DocSelectionManagerService } from '@univerjs/docs';
import { ILayoutService } from '@univerjs/ui';
import { ISlideEditorBridgeService } from '../services/slide-editor-bridge.service';
import { ISlideEditorManagerService } from '../services/slide-editor-manager.service';
export declare class SlideEditingRenderController extends Disposable implements IRenderModule {
    private readonly _renderContext;
    private readonly _layoutService;
    private readonly _undoRedoService;
    private readonly _contextService;
    private readonly _instanceSrv;
    private readonly _renderManagerService;
    private readonly _editorBridgeService;
    private readonly _cellEditorManagerService;
    private readonly _textSelectionManagerService;
    private readonly _commandService;
    protected readonly _localService: LocaleService;
    private readonly _editorService;
    /**
     * It is used to distinguish whether the user has actively moved the cursor in the editor, mainly through mouse clicks.
     */
    private _cursorChange;
    /** If the corresponding unit is active and prepared for editing. */
    private _isUnitEditing;
    private _d;
    constructor(_renderContext: IRenderContext<UnitModel>, _layoutService: ILayoutService, _undoRedoService: IUndoRedoService, _contextService: IContextService, _instanceSrv: IUniverInstanceService, _renderManagerService: IRenderManagerService, _editorBridgeService: ISlideEditorBridgeService, _cellEditorManagerService: ISlideEditorManagerService, _textSelectionManagerService: DocSelectionManagerService, _commandService: ICommandService, _localService: LocaleService, _editorService: IEditorService);
    dispose(): void;
    private _disposeCurrent;
    private _init;
    private _initEditorVisibilityListener;
    private _listenEditorFocus;
    private _getEditorSkeleton;
    private _getEditorViewModel;
    private _initialCursorSync;
    /**
     * Set editorUnitId to curr doc.
     * @param d DisposableCollection
     */
    private _subscribeToCurrentCell;
    /**
     * Set size and pos of editing area.
     * @param positionFromEditRectState
     * @param canvasOffset
     * @param documentSkeleton
     * @param documentLayoutObject
     * @param scaleX
     * @param scaleY
     */
    private _fitTextSize;
    /**
     * Mainly used to pre-calculate the width of the editor,
     * to determine whether it needs to be automatically widened.
     */
    private _predictingSize;
    /**
     * control the size of editing area
     */
    private _editAreaProcessing;
    /**
     * Since the document does not support cell background color, an additional rect needs to be added.
     */
    private _addBackground;
    /**
     * Show input area, resize input area and then place input to right place.
     * @TODO why do resize in show input area?
     * @param param
     */
    private _handleEditorVisible;
    private _resetBodyStyle;
    /**
     * Should activate the editor when the user inputs text.
     * @param d DisposableCollection
     */
    private _initialKeyboardListener;
    private _showEditorByKeyboard;
    private _commandExecutedListener;
    private _moveCursorCmdHandler;
    private _editingChangedHandler;
    private _getEditorObject;
    private _handleEditorInvisible;
    private _exitInput;
    private _moveCursor;
    /**
     * The user's operations follow the sequence of opening the editor and then moving the cursor.
     * The logic here predicts the user's first cursor movement behavior based on this rule
     */
    private _cursorStateListener;
    private _moveInEditor;
}
export declare function getEditorObject(unitId: Nullable<string>, renderManagerService: IRenderManagerService): Nullable<IDocObjectParam>;
