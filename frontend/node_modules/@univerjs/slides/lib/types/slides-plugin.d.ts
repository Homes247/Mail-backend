import { Engine, IRenderManagerService } from '@univerjs/engine-render';
import { IConfigService, Injector, Plugin, UniverInstanceType } from '@univerjs/core';
export interface IUniverSlidesConfig {
}
export declare class UniverSlidesPlugin extends Plugin {
    private readonly _config;
    readonly _injector: Injector;
    private readonly _renderManagerService;
    private readonly _configService;
    static pluginName: string;
    static type: UniverInstanceType;
    private _canvasEngine;
    constructor(_config: Partial<IUniverSlidesConfig> | undefined, _injector: Injector, _renderManagerService: IRenderManagerService, _configService: IConfigService);
    initialize(): void;
    onReady(): void;
    getConfig(): Partial<IUniverSlidesConfig>;
    initCanvasEngine(): void;
    onRendered(): void;
    getCanvasEngine(): Engine | null;
    private _initializeDependencies;
}
