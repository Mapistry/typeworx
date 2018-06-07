import * as debug from 'debug';
import * as ts from 'ts-simple-ast';
import Project from 'ts-simple-ast';
const log = debug('typeworx');

export interface BuilderOptions {
    handleDuplicates?: boolean;
    ignoreCustomJsDocTags?: boolean;
}

export class TypeScriptJsonSchemaBuilder {
    private static defaultOptions: BuilderOptions = {
        handleDuplicates: true,
    };

    private options: BuilderOptions;
    private anonymousTypeCount = 1;
    private duplicateTypeCount: { [index: string]: number } = {};

    private generatedSchemas = {
        definitions: {} as any,
    };
    private anonymousTypeCache: Map<string, any> = new Map();

    constructor(options?: BuilderOptions) {
        this.options = Object.assign({}, TypeScriptJsonSchemaBuilder.defaultOptions, options || {});
    }

    public getSchemas() {
        const collection = { definitions: {} };
        const sorted = Object.keys(this.generatedSchemas.definitions).sort();
        for (const key of sorted) {
            collection.definitions[key] = this.generatedSchemas.definitions[key];
        }
        return collection;
    }

    public getUniqueTypeNameFromGenerics(type: ts.Type) {
        if (type == null) {
            return null;
        }
        const typeArgs = type.getTypeArguments();
        const hasTypeArgs = typeArgs && typeArgs.length;
        const symbol = type.getSymbol();
        const name = symbol ? symbol.getName() : type.getText();
        return `${name}${hasTypeArgs ? '_' + typeArgs.map((x) => this.getUniqueTypeNameFromGenerics(x)).join('_') : ''}`;
    }

    public quickCreateTS(str: string) {
        const p = new Project();
        return p.createSourceFile('temp.ts', str);
    }

    public addTypeInternal(type: ts.Type): { name: string, schema: any } {
        // tslint:disable-next-line:no-bitwise
        if (type.getFlags() & ts.TypeFlags.Void) {
            return null;
        }
        let schema: any = { type: 'object', properties: {} };
        const properties = type.getProperties();
        const requiredProperties = [];
        const typeIsAnonymous = type.isAnonymousType();
        let name = typeIsAnonymous ? `AnonymousType${this.anonymousTypeCount++}` : this.getUniqueTypeNameFromGenerics(type);
        log(`Resolving Type: ${name}`);
        const tempTypeArguments = type.getTypeArguments();
        const typeArgumentsMap = new Map<string, ts.Type>();
        if (tempTypeArguments && tempTypeArguments.length) {
            const targetTypeArguments = type.getTargetType().getTypeArguments();
            for (let i = 0; i < targetTypeArguments.length; i++) {
                const targetTypeArgument = targetTypeArguments[i];
                typeArgumentsMap.set(targetTypeArgument.getSymbol().getName(), tempTypeArguments[i]);
            }
        }
        const sortedProperties = properties.sort((a, b) => a.getName().localeCompare(b.getName()));
        for (const property of sortedProperties) {
            // tslint:disable-next-line:no-bitwise
            if (!(property.getFlags() & ts.SymbolFlags.Optional)) {
                requiredProperties.push(property.getName());
            }
            const valueDeclaration = property.getValueDeclaration();
            const valueDeclarationType = valueDeclaration.getType();
            let proposedType: ts.Type;
            let obj: any = {};
            // debugger;
            let isArray = false;
            if (valueDeclaration.getType().isArrayType()) {
                isArray = true;
                obj.type = 'array';
                proposedType = valueDeclarationType.getTypeArguments()[0];
            } else {
                proposedType = valueDeclarationType;
            }
            if (proposedType.isTypeParameter()) {
                proposedType = typeArgumentsMap.get(proposedType.getSymbol().getName());
                if (!proposedType) {
                    throw new Error('Unable to find corresponding type parameter.');
                }
            }
            const typeResult = this.getJsonType(proposedType);
            if (typeResult) {
                if (isArray) {
                    obj.items = typeResult;
                } else {
                    obj = typeResult;
                }
                if (!obj.$ref) {
                    obj = Object.assign({}, this.options.ignoreCustomJsDocTags ? {} : this.getJSDocTagsAndValues(property), obj);
                }
                schema.properties[property.getName()] = obj;
            }
        }
        const sortedRequiredProperties = requiredProperties.sort();
        schema.required = sortedRequiredProperties.length ? sortedRequiredProperties : undefined;
        if (typeIsAnonymous) {
            const result = this.getExistingAnonymousType(schema);
            if (result) {
                log(`Found existing anonymous type for: ${name}`);
                schema = result.schema;
                name = result.name;
                this.anonymousTypeCount--;
            } else {
                this.anonymousTypeCache.set(name, schema);
            }

        } else if (this.generatedSchemas.definitions[name]) {
            const cached = this.generatedSchemas.definitions[name];
            const newType = schema;
            log(`Found existing type for: ${name}`);
            if (!this.isSchemaIdentical(cached, newType)) {
                log(`Not identical type for: ${name}`);
                if (this.options.handleDuplicates) {
                    const currentJson = JSON.stringify(newType);
                    const keys = Object.keys(this.generatedSchemas.definitions).filter((v) => v.indexOf(name + '_') > -1);
                    let found = false;
                    for (const key of keys) {
                        const potentialJson = JSON.stringify(this.generatedSchemas.definitions[key]);
                        if (potentialJson === currentJson) {
                            log(`Found identical type for: ${name}, using ${key}`);
                            name = key;
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        const count = this.duplicateTypeCount[name] = this.duplicateTypeCount[name] ? this.duplicateTypeCount[name]++ : 1;
                        const newName = `${name}_${count}`;
                        log(`Did not find identical type for: ${name}, using ${newName}`);
                        name = newName;

                    }
                } else {
                    throw new Error(`Unidentical types found w/ same name ${name} please ensure unique type names.`);
                }
            } else {
                schema = cached;
            }
        }
        this.generatedSchemas.definitions[name] = schema;
        return { name, schema };
    }

    public getJsonType(type: ts.Type): any {
        const flags = type.getFlags();
        if (type.isStringType() || type.isStringLiteralType()) {
            return { type: 'string' };
        } else if (type.isNumberType() || type.isNumberLiteralType()) {
            return { type: 'number', format: 'double' };
        } else if (type.isBooleanType() || type.isBooleanType()) {
            return { type: 'boolean' };
        } else if (type.isObjectType() && type.getSymbol().getName() === 'Date') {
            return {
                type: 'string',
                format: 'date-time',
            };
        } else if (type.isArrayType() || type.isInterfaceType() || type.isAnonymousType() || type.isObjectType()) {
            const isArray = type.isArrayType();
            type = isArray ? type.getTypeArguments()[0] : type;
            const result = this.addTypeInternal(type);
            return isArray ? { type: 'array', items: { $ref: `#/definitions/${result.name}` } } : { $ref: `#/definitions/${result.name}` };
            // tslint:disable-next-line:no-bitwise
        } else if (flags & ts.TypeFlags.Void || flags & ts.TypeFlags.Null) {
            return null;
            // tslint:disable-next-line:no-bitwise
        } else if (flags & ts.TypeFlags.Any) {
            return {};
        } else {
            return { type: 'object' };
        }
    }

    private getExistingAnonymousType(obj: any) {
        const typeJson = JSON.stringify(obj);
        for (const anonymousType of this.anonymousTypeCache) {
            const json = JSON.stringify(anonymousType[1]);
            if (typeJson === json) {
                return {
                    name: anonymousType[0],
                    schema: anonymousType[1],
                };
            }
        }
        return null;
    }

    private isSchemaIdentical(a: any, b: any) {
        return JSON.stringify(a) === JSON.stringify(b);
    }

    private getJSDocTagsAndValues(sym: ts.Symbol) {
        const result: any = {};
        const declarations = sym.getDeclarations();
        if (declarations) {
            for (const declaration of declarations) {
                const propertyDeclaration = declaration as ts.PropertyDeclaration;
                if (propertyDeclaration.getJsDocs) {
                    const docs = propertyDeclaration.getJsDocs();
                    if (docs) {
                        for (const doc of docs) {
                            const tags = doc.getTags();
                            if (tags) {
                                for (const tag of tags) {
                                    const nameNode = tag.getTagNameNode();
                                    if (nameNode && nameNode.getText()) {
                                        let finalResult: any = tag.getComment();
                                        const parseResult = parseFloat(finalResult);
                                        finalResult = isNaN(parseResult) ? finalResult : parseResult;
                                        result[nameNode.getText()] = finalResult;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        return result;
    }

    private addType(type: ts.Type) {
        return this.addTypeInternal(type);
    }

}
