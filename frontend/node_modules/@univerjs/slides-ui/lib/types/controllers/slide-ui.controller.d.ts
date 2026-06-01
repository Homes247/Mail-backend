import { Disposable, ICommandService, Injector } from '@univerjs/core';
import { ComponentManager, IMenuManagerService, IShortcutService, IUIPartsService } from '@univerjs/ui';
/**
 * This controller registers UI parts of slide workbench to the base-ui workbench.
 */
export declare class SlidesUIController extends Disposable {
    protected readonly _injector: Injector;
    protected readonly _menuManagerService: IMenuManagerService;
    protected readonly _componentManager: ComponentManager;
    protected readonly _uiPartsService: IUIPartsService;
    protected readonly _commandService: ICommandService;
    protected readonly _shortcutService: IShortcutService;
    constructor(_injector: Injector, _menuManagerService: IMenuManagerService, _componentManager: ComponentManager, _uiPartsService: IUIPartsService, _commandService: ICommandService, _shortcutService: IShortcutService);
    private _initMenus;
    private _initCustomComponents;
    private _initCommands;
    protected _initUIComponents(): void;
    private _initShortcuts;
}
