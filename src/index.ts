import * as debug from 'debug';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'ts-simple-ast';
import Project from 'ts-simple-ast';
const log = debug('typeworx');
import { DecoratorType } from './decoratorType';
import { State } from './interfaces/baseState';
import { ResolvedFunctions } from './interfaces/resolvedFunctions';
import { TypeWorxOptions } from './interfaces/typeWorxOptions';
import * as utils from './utilities';
export * from './decorators';

export const Utilities = utils;
export {
    TypeWorxOptions,
    DecoratorType,
    State,
};

export async function execute<T extends State = any>(sourceFileGlob: string, state?: T) {
    if (!state) {
        (state as any) = {};
    }
    if (!state.namespaces || !state.namespaces.length) {
        state.namespaces = ['*'];
    }
    state.outputs = state.outputs || {};
    const project = new Project();
    project.addExistingSourceFiles(sourceFileGlob);
    const sourceFiles = project.getSourceFiles();
    if (!sourceFiles || sourceFiles.length === 0) {
        throw new Error(`Unable to find file(s) at path '${sourceFileGlob}'.`);
    }
    let resolvedFunctions: ResolvedFunctions;
    for (const sourceFile of sourceFiles) {
        resolvedFunctions = iterateClasses(sourceFile, state, resolvedFunctions);
    }
    for (const item of resolvedFunctions.beforeAll) {
        const data = item;
        if (state.namespaces.some((n) => isNamespaceMatch(data.namespace, n))) {
            const promise = data.func.apply(this, [state].concat(data.args));
            if (promise) {
                await promise;
            }
        }
    }
    for (const data of resolvedFunctions.functions) {
        if (state.namespaces.some((n) => isNamespaceMatch(data.namespace, n))) {
            const promise = data.func.apply(this, [state].concat(data.args));
            if (promise) {
                await promise;
            }
        }
    }
    for (const item of resolvedFunctions.afterAll) {
        const data = item;
        if (state.namespaces.some((n) => isNamespaceMatch(data.namespace, n))) {
            const promise = data.func.apply(this, [state].concat(data.args));
            if (promise) {
                await promise;
            }
        }
    }
    return state as T;
}

const sourceFileCache = new Map<string, ResolvedFunctions>();

function processDecoratable(decoratorType: DecoratorType, node: ts.DecoratableNode, resolvedFunctions: ResolvedFunctions, afterMain?: () => void) {
    const decorators = node.getDecorators();
    if (decorators) {
        let data: [string, TypeWorxOptions<any>, ts.Decorator][] = [];
        for (const decorator of decorators) {
            const sourceMethod = utils.getSourceMethodFromDecorator(decorator);
            if (sourceMethod) {
                const info = utils.getTypeWorxDecoratorMethodInfoFromDecorator(decorator);
                if (info) {
                    // tslint:disable-next-line:no-bitwise
                    if (!(info.decoratorType & decoratorType)) {
                        throw new Error(`Invalid use of ${decorator.getName()} decorator on ${DecoratorType[decoratorType]}`);
                    }
                    const fqn = sourceMethod.getSymbol().getFullyQualifiedName();
                    data.push([fqn, info, decorator]);
                }
            }
        }
        if (data.length) {
            data = data.sort((a, b) => {
                return a[1].order - b[1].order;
            });
            for (const nameAndInfo of data) {
                const fqn = nameAndInfo[0];
                const info = nameAndInfo[1];
                const namespace = info.namespace;
                const decorator = nameAndInfo[2];
                if (info.beforeAll) {
                    resolvedFunctions.beforeAll.push({ namespace, fqn, func: info.beforeAll, args: [node, decorator, decoratorType] });
                }
                if (info.afterAll) {
                    resolvedFunctions.afterAll.push({ namespace, fqn, func: info.afterAll, args: [node, decorator, decoratorType] });
                }
                if (info.before) {
                    resolvedFunctions.functions.push({ namespace, func: info.before, args: [node, decorator, decoratorType] });
                }
                resolvedFunctions.functions.push({ namespace, func: (info as any).func(), args: [node, decorator, decoratorType] });
            }
            if (afterMain) {
                afterMain();
            }
            for (const nameAndInfo of data) {
                const fqn = nameAndInfo[0];
                const info = nameAndInfo[1];
                const namespace = info.namespace;
                const decorator = nameAndInfo[2];
                if (info.after) {
                    resolvedFunctions.functions.push({ namespace, func: info.after, args: [node, decorator] });
                }
            }

        } else {
            if (afterMain) {
                afterMain();
            }
        }
    } else {
        if (afterMain) {
            afterMain();
        }
    }
}

function iterateClasses(
    sourceFile: ts.SourceFile,
    state?: any,
    resolvedFunctions?: ResolvedFunctions,
) {
    if (!state) {
        state = {};
    }
    if (!resolvedFunctions) {
        resolvedFunctions = {
            beforeAll: [],
            afterAll: [],
            functions: [],
        };
    }
    const filePath = sourceFile.getFilePath();
    if (sourceFileCache.has(filePath)) {
        return sourceFileCache.get(filePath);
    }
    const classes = sourceFile.getClasses();
    for (const typeClass of classes) {
        processDecoratable(DecoratorType.Class, typeClass, resolvedFunctions, () => {
            const methods = typeClass.getMethods();
            for (const method of methods) {
                processDecoratable(DecoratorType.Method, method, resolvedFunctions, () => {
                    const parameters = method.getParameters();
                    for (const parameter of parameters) {
                        processDecoratable(DecoratorType.Parameter, parameter, resolvedFunctions);
                    }
                });
            }
        });
    }
    sourceFileCache.set(filePath, resolvedFunctions);
    const exported = sourceFile.getExportedDeclarations();
    for (const declaration of exported) {
        const innerSourceFile = declaration.getSourceFile();
        const innerPath = innerSourceFile.getFilePath();
        if (!sourceFileCache.has(innerPath)) {
            const result = iterateClasses(declaration.getSourceFile());
            resolvedFunctions.beforeAll = resolvedFunctions.beforeAll.concat(result.beforeAll);
            resolvedFunctions.afterAll = resolvedFunctions.afterAll.concat(result.afterAll);
            resolvedFunctions.functions = resolvedFunctions.functions.concat(result.functions);
        }
    }
    const imported = sourceFile.getImportDeclarations();
    for (const declaration of imported) {
        const innerSourceFile = declaration.getSourceFile();
        const innerPath = innerSourceFile.getFilePath();
        if (!sourceFileCache.has(innerPath)) {
            const result = iterateClasses(declaration.getSourceFile());
            resolvedFunctions.beforeAll = resolvedFunctions.beforeAll.concat(result.beforeAll);
            resolvedFunctions.afterAll = resolvedFunctions.afterAll.concat(result.afterAll);
            resolvedFunctions.functions = resolvedFunctions.functions.concat(result.functions);
        }
    }
    return resolvedFunctions;
}

function isNamespaceMatch(decoratorNamespace: string, targetNamespace: string) {
    if (targetNamespace === '*') {
        return true;
    }
    if (decoratorNamespace === '*') {
        return true;
    }
    const decoratorSplit = decoratorNamespace.toLowerCase().split('.');
    const targetSplit = targetNamespace.toLowerCase().split('.');
    // target: blah.*
    // decorator: swagger
    for (let i = 0; i < targetSplit.length; i++) {
        const target = targetSplit[i];
        const decoratorItem = decoratorSplit[i];
        if (target !== '*' && (decoratorItem !== undefined && decoratorItem !== target && decoratorItem !== '*')) {
            return false;
        }
    }
    return true;
}
