import { DependencyOverride } from '@univerjs/core';
import { MenuConfig } from '@univerjs/ui';
export declare const SLIDES_UI_PLUGIN_CONFIG_KEY = "slides-ui.config";
export declare const configSymbol: unique symbol;
export interface IUniverSlidesUIConfig {
    override?: DependencyOverride;
    menu?: MenuConfig;
}
export declare const defaultPluginConfig: IUniverSlidesUIConfig;
