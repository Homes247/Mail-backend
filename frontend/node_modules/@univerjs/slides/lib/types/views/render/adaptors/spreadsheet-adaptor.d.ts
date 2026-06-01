import { IPageElement, IConfigService, IContextService, Injector, LocaleService, PageElementType } from '@univerjs/core';
import { Scene, SceneViewer } from '@univerjs/engine-render';
import { ObjectAdaptor } from '../adaptor';
export declare class SpreadsheetAdaptor extends ObjectAdaptor {
    private readonly _localeService;
    private readonly _contextService;
    private readonly _configService;
    private readonly _injector;
    zIndex: number;
    viewKey: PageElementType;
    constructor(_localeService: LocaleService, _contextService: IContextService, _configService: IConfigService, _injector: Injector);
    check(type: PageElementType): this | undefined;
    convert(pageElement: IPageElement, mainScene: Scene): SceneViewer | undefined;
    private _updateViewport;
}
export declare class SpreadsheetAdaptorFactory {
    readonly zIndex = 4;
    create(injector: Injector): SpreadsheetAdaptor;
}
