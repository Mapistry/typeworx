import * as path from 'path';
import * as ts from 'ts-simple-ast';
import { State } from './interfaces/baseState';
import { TypeWorxOptions } from './interfaces/typeWorxOptions';

const typeWorxInfoCache = new Map<string, any>();
const sourceMethodCache = new Map<string, any>();

export function getLiteralDecoratorParameters(decorator: ts.Decorator) {
    const args = decorator.getArguments().map((a: any) => a.getLiteralValue ? a.getLiteralValue() : a);
    return args;
}

export function getSourceFileJsFromNode(sourceNode: ts.Node) {
    const sourceFile = sourceNode.getSourceFile();
    return path.join(sourceFile.getDirectoryPath(), sourceFile.getBaseNameWithoutExtension() + '.js');
}

export function getSourceMethodFromDecorator(decorator: ts.Decorator) {
    const symbol = decorator.getCallExpression().getExpression().getSymbol();
    if (symbol) {
        const fqn = symbol.getFullyQualifiedName();
        let sourceMethod: ts.MethodDeclaration = sourceMethodCache.get(fqn);
        if (sourceMethod === undefined) {
            sourceMethod = symbol.getDeclarations()[0] as ts.MethodDeclaration;
            sourceMethodCache.set(fqn, sourceMethod);
        }
        return sourceMethod;
    }
    return null;
}

export function parseObjectLiteralExpression(expression: ts.ObjectLiteralExpression) {
    // tslint:disable-next-line:no-eval
    return eval(`( function () { return ${expression.getText()}; })()`);
}

export function getTypeWorxInfoFromMethod(sourceMethod: ts.MethodDeclaration) {
    const sourceMethodParent = sourceMethod.getParent();
    const symbol = sourceMethodParent.getSymbol();
    let obj = null;
    if (symbol) {
        const fqn = symbol.getFullyQualifiedName();
        obj = typeWorxInfoCache.get(fqn);
        if (obj === undefined) {
            const sourcePath = getSourceFileJsFromNode(sourceMethodParent);
            const result = require(sourcePath);
            if (result) {
                const parent = result[(sourceMethod.getParent() as ts.ClassDeclaration).getName()];
                if (parent) {
                    obj = parent[Symbol.for('TypeWorx')];
                    typeWorxInfoCache.set(fqn, obj);
                }
            }
        }
    }
    return obj;
}

export function getTypeWorxDecoratorMethodInfoFromDecorator<T extends State = any>(decorator: ts.Decorator): TypeWorxOptions<T> {
    const sourceMethod = getSourceMethodFromDecorator(decorator);
    if (sourceMethod) {
        const typeWorxObject = getTypeWorxInfoFromMethod(sourceMethod);
        if (typeWorxObject) {
            const info = typeWorxObject[sourceMethod.getName()];
            if (info) {
                return info;
            }
        }
    }
    return null;
}

export function unpackGeneric(type: ts.Type) {
    const typeArgs = type.getTypeArguments();
    if (typeArgs.length) {
        return unpackGeneric(typeArgs[0]);
    }
    return type;
}
