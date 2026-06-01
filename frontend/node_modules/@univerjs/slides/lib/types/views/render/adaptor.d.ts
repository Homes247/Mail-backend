import { Injector, IPageElement, Nullable, PageElementType, Registry } from '@univerjs/core';
import { BaseObject, Scene } from '@univerjs/engine-render';
export declare abstract class ObjectAdaptor {
    zIndex: number;
    viewKey: PageElementType | null;
    check(type: PageElementType): this | undefined;
    abstract convert(pageElement: IPageElement, mainScene: Scene): Nullable<BaseObject>;
    create(injector: Injector): void;
}
export declare const CanvasObjectProviderRegistry: Registry<any>;
