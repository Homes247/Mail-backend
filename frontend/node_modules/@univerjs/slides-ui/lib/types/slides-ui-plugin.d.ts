import { IUniverSlidesUIConfig } from './controllers/config.schema';
import { IConfigService, Injector, IUniverInstanceService, Plugin, UniverInstanceType } from '@univerjs/core';
import { IRenderManagerService } from '@univerjs/engine-render';
export declare const SLIDE_UI_PLUGIN_NAME = "SLIDE_UI";
export declare class UniverSlidesUIPlugin extends Plugin {
    private readonly _config;
    readonly _injector: Injector;
    private readonly _renderManagerService;
    private readonly _univerInstanceService;
    private readonly _configService;
    static pluginName: string;
    static type: UniverInstanceType;
    constructor(_config: Partial<IUniverSlidesUIConfig> | undefined, _injector: Injector, _renderManagerService: IRenderManagerService, _univerInstanceService: IUniverInstanceService, _configService: IConfigService);
    onStarting(): void;
    onReady(): void;
    onRendered(): void;
    onSteady(): void;
    private _markSlideAsFocused;
}
