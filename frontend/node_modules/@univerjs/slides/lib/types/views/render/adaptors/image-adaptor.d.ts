import { Injector, IPageElement, PageElementType } from '@univerjs/core';
import { Image } from '@univerjs/engine-render';
import { ObjectAdaptor } from '../adaptor';
export declare class ImageAdaptor extends ObjectAdaptor {
    zIndex: number;
    viewKey: PageElementType;
    check(type: PageElementType): this | undefined;
    convert(pageElement: IPageElement): Image;
}
export declare class ImageAdaptorFactory {
    readonly zIndex = 4;
    create(injector: Injector): ImageAdaptor;
}
