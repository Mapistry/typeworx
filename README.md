# typeworx

A framework for creating and executing compile-time decorators that allow code generation or even code manipulation.

## Installation
`npm i @mapistry/typeworx` or `npm i -g @mapistry/typeworx`


## API

### Decorators
Any decorators created to be used with typeworx must adhere to certain requirements currently:
1. The decorator being created MUST be a method contained in a class.
2. The decorator being created MUST be a static method.
3. The decorator being created MUST be decorated itself with the "TypeWorxDecorator" decorator.
4. The decorator being created MUST return a function that returns void/nothing.
5. The decorator library MUST build successfully.
6. The library requires a peer-dependency of typeworx.

This function will receive the following parameters:
- state: State / The current state - this can be used to communicate changes across decorators.
- node: ts.Node / A ts-simple-ast Node that may be a Class, Method, or Parameter depending on the type of decorator. (A decorator can specify that it supports any combination of different uses using the DecoratorType enum (see below).
- decorator: The current decorator instance.
- decoratorSourceType: A DecoratorType enum value denoting what type of node we are executing the decorator on e.g. Class, Method, Parameter.

A typing for this function definition called "DecoratorReturnFunction" can be imported and used to help remember the arguments.


## Example Custom Decorator and Usage
`/myCustomDecoratorLibrary/index.ts`
```ts
import {TypeWorxDecorator,DecoratorType, Utilities} from '@mapistry/typeworx';

export class MyDecorators {

    @TypeWorxDecorator({decoratorType: DecoratorType.Class | DecoratorType.Method})
    public static MyCustomDecorator(someValue : string) {
        return (state : State, node : ts.Node, decorator : ts.Decorator, decoratorSourceType : DecoratorType) => {
            const parameters = Utilities.getLiteralDecoratorParameters(decorator);
            if(decoratorSourceType === DecoratorType.Class) {
                console.log(parameters[0]); // Whatever 'someValue' was.
            } else {
                const value = parameters[0]; // Whatever 'someValue' was.                
                if(state.myCustomStateValue) {
                    value += state.myCustomStateValue; // 'there GitHub User!'
                } else {
                    value += 'anybody!';
                }
            }
            
        };
    }

}
```
`/myApp/index.ts`
```ts
import {MyDecorators} from 'mycustomdecoratorlibrary';

@MyDecorator('Hello ')
export class FooClass {
    @MyDecorator('there ');
    public myMethod() {
        // ...
    }
}
```

`CLI`
```
$ typeworx /myApp/index.ts --myCustomStateValue "GitHub User!"
Hello there GitHub User!
```

`API`
```ts
import {execute} from '@mapistry/typeworx';

execute('/myApp/index.ts', { myCustomStateValue: 'GitHub User!'}).then((state)=>{
    // console would show 'Hello there GitHub User!'
});
```

## State

The state object is passed to all decorator functions at execution-time. It is **NOT** immutable and is intended be modified by your decorator logic. There is only one relevant, system-provided special property on the state object called `outputs` which is initialized to an empty object at execution start. The `outputs` property can be useful for circumstances where you want your decorator library to output textual data to stdout automatically - maybe you intended your library to be used with the typeworx CLI. Any keys present on the `outputs` property will enumerated at the end of processing and sent to stdout.

## TypeWorxDecorator Options

```ts
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
```



