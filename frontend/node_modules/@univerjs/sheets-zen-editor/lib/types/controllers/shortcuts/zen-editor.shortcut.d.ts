import { IContextService } from '@univerjs/core';
import { IShortcutItem } from '@univerjs/ui';
export declare const ZenEditorConfirmShortcut: IShortcutItem;
export declare const ZenEditorCancelShortcut: IShortcutItem;
/**
 * Requires the currently focused unit to be Doc and the zen editor is activated.
 * @param contextService
 * @returns
 */
export declare function whenZenEditorActivated(contextService: IContextService): boolean;
