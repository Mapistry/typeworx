import * as ts from 'ts-simple-ast';
import { DecoratorType } from './decoratorType';
import { State } from './interfaces/baseState';
import { TypeWorxOptions } from './interfaces/typeWorxOptions';

export type DecoratorReturnFunction = (state?: State, node?: ts.Node, decorator?: ts.Decorator, decoratorSourceType?: DecoratorType) => void | Promise<void>;

export function TypeWorxDecorator<TState = any>(options?: TypeWorxOptions<TState>): any {
    return (target, key, descriptor) => {
        if (descriptor === undefined) {
            descriptor = Object.getOwnPropertyDescriptor(target, key);
        }
        const symbol = Symbol.for('TypeWorx');
        let container = target[symbol];
        if (!container) {
            container = {};
            Object.defineProperty(target, symbol, { enumerable: false, value: container, configurable: false, writable: false });
        }
        options = options || {};
        if (!options.options) {
            options.options = {};
        }
        if (options.decoratorType == null) {
            options.decoratorType = DecoratorType.Any;
        }
        if (options.order == null) {
            options.order = 0;
        }
        if (!options.namespace) {
            options.namespace = '*';
        }
        container[key] = Object.assign({}, options, { func: descriptor.value });
        // tslint:disable-next-line:no-empty
        descriptor.value = () => () => { };
        return descriptor;
    };
}
