import { Injector, PageElementType, IPageElement } from '@univerjs/core';
import { Scene, Slide } from '@univerjs/engine-render';
import { ObjectAdaptor } from '../adaptor';
export declare enum SLIDE_VIEW_KEY {
    MAIN = "__SLIDERender__",
    SCENE_VIEWER = "__SLIDEViewer__",
    SCENE = "__SLIDEScene__",
    VIEWPORT = "__SLIDEViewPort_"
}
export declare class SlideAdaptor extends ObjectAdaptor {
    private _injector;
    zIndex: number;
    viewKey: PageElementType;
    private _ObjectProvider;
    constructor(_injector: Injector);
    check(type: PageElementType): this | undefined;
    convert(pageElement: IPageElement, mainScene: Scene): Slide | undefined;
    private _createScene;
    private _addBackgroundRect;
}
export declare class SlideAdaptorFactory {
    readonly zIndex = 6;
    create(injector: Injector): SlideAdaptor;
}
