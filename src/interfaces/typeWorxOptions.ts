import * as ts from 'ts-simple-ast';
import { DecoratorType } from '../decoratorType';
import { State } from './baseState';

export interface TypeWorxOptions<TState = any> {
    /**
     * Guarenteed to execute *before* any typeworx-decorator-functions on the children of this node
     * and only once for this type of decorator.
     * @memberof TypeWorxOptions
     */
    beforeAll?: (state: TState) => (void | Promise<void>);
    /**
     * Guarenteed to execute *aftere* any typeworx-decorator-functions on the children of this node
     * and only once for this type of decorator.
     * @memberof TypeWorxOptions
     */
    afterAll?: (state: TState) => (void | Promise<void>);
    /**
     * Guarenteed to execute *before* any typeworx-decorator-functions on the children of this node.
     * @memberof TypeWorxOptions
     */
    before?: (state: TState, node: ts.Node, decorator: ts.Decorator) => (void | Promise<void>);
    /**
     * Guarenteed to execute *after* any typeworx-decorator-functions on the children of this node.
     * @memberof TypeWorxOptions
     */
    after?: (state: TState, node: ts.Node, decorator: ts.Decorator) => (void | Promise<void>);
    /**
     * The order in which to execute decorator relative to its siblings. Use -1 for guarenteed first. Default is 0.
     * @memberof TypeWorxOptions
     */
    order?: number;
    /**
     * The type of node this decorator can be used with - if this does not match the type of node at execution-time an error will occur.
     * The default is DecoratorType.Any.
     * @memberof TypeWorxOptions
     */
    decoratorType?: DecoratorType;
    /**
     * Any additional options you want to embed in the TypeWorxInfo attached to the decorator at compile-time.
     * @memberof TypeWorxOptions
     */
    options?: any;
    /**
     * The namespace this decorator belongs to. Defaults to "*".
     * @memberof TypeWorxOptions
     */
    namespace?: string;
}
