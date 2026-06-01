import { LocaleService, PageElementType, Injector, IPageElement } from '@univerjs/core';
import { Scene, SceneViewer } from '@univerjs/engine-render';
import { ObjectAdaptor } from '../adaptor';
export declare enum DOCS_VIEW_KEY {
    MAIN = "__DocsRender__",
    SCENE_VIEWER = "__DocsViewer__",
    SCENE = "__DocsScene__",
    VIEWPORT = "__DocsViewPort_"
}
export declare class DocsAdaptor extends ObjectAdaptor {
    private readonly _localeService;
    zIndex: number;
    viewKey: PageElementType;
    private _liquid;
    constructor(_localeService: LocaleService);
    check(type: PageElementType): this | undefined;
    convert(pageElement: IPageElement, mainScene: Scene): SceneViewer | undefined;
    private _recalculateSizeBySkeleton;
    private _calculatePagePosition;
}
export declare class DocsAdaptorFactory {
    readonly zIndex = 5;
    create(injector: Injector): DocsAdaptor;
}
