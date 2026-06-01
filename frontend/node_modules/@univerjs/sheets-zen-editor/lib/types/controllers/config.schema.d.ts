import { MenuConfig } from '@univerjs/ui';
export declare const SHEETS_ZEN_EDITOR_PLUGIN_CONFIG_KEY = "sheets-zen-editor.config";
export declare const configSymbol: unique symbol;
export interface IUniverSheetsZenEditorConfig {
    menu?: MenuConfig;
}
export declare const defaultPluginConfig: IUniverSheetsZenEditorConfig;
