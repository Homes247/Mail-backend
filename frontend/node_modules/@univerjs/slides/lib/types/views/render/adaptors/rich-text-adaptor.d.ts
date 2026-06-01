import { Injector, IPageElement, LocaleService, PageElementType } from '@univerjs/core';
import { Scene, RichText } from '@univerjs/engine-render';
import { ObjectAdaptor } from '../adaptor';
export declare class RichTextAdaptor extends ObjectAdaptor {
    private readonly _localeService;
    zIndex: number;
    viewKey: PageElementType;
    constructor(_localeService: LocaleService);
    check(type: PageElementType): this | undefined;
    convert(pageElement: IPageElement, _mainScene: Scene): RichText | undefined;
}
export declare class RichTextAdaptorFactory {
    readonly zIndex = 0;
    create(injector: Injector): RichTextAdaptor;
}
