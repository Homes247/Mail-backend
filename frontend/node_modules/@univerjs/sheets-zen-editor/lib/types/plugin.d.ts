import { IUniverSheetsZenEditorConfig } from './controllers/config.schema';
import { IConfigService, Injector, Plugin, UniverInstanceType } from '@univerjs/core';
export declare class UniverSheetsZenEditorPlugin extends Plugin {
    private readonly _config;
    readonly _injector: Injector;
    private readonly _configService;
    static pluginName: string;
    static type: UniverInstanceType;
    constructor(_config: Partial<IUniverSheetsZenEditorConfig> | undefined, _injector: Injector, _configService: IConfigService);
    private _initializeDependencies;
    onReady(): void;
    onSteady(): void;
}
