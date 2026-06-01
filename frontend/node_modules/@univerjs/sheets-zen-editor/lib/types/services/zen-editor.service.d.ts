import { IDisposable, Nullable } from '@univerjs/core';
import { Observable } from 'rxjs';
export interface IZenEditorManagerService {
    position$: Observable<Nullable<DOMRect>>;
    dispose(): void;
    setPosition(param: DOMRect): void;
    getPosition(): Readonly<Nullable<DOMRect>>;
}
export declare class ZenEditorManagerService implements IDisposable {
    private _position;
    private readonly _position$;
    readonly position$: Observable<Nullable<DOMRect>>;
    dispose(): void;
    setPosition(param: DOMRect): void;
    getPosition(): Readonly<Nullable<DOMRect>>;
    private _refresh;
}
export declare const IZenEditorManagerService: import('@wendellhu/redi').IdentifierDecorator<ZenEditorManagerService>;
