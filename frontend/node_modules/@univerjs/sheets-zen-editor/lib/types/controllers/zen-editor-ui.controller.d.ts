import { Disposable, ICommandService } from '@univerjs/core';
import { IMenuManagerService, IShortcutService, IZenZoneService } from '@univerjs/ui';
export declare class ZenEditorUIController extends Disposable {
    private readonly _zenZoneService;
    private readonly _commandService;
    private readonly _menuManagerService;
    private readonly _shortcutService;
    constructor(_zenZoneService: IZenZoneService, _commandService: ICommandService, _menuManagerService: IMenuManagerService, _shortcutService: IShortcutService);
    private _initialize;
    private _initCustomComponents;
    private _initCommands;
    private _initMenus;
    private _initShortcuts;
}
