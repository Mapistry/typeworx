// tslint:disable
export enum DecoratorType {
    Class = 1 << 1,
    Method = 1 << 2,
    Parameter = 1 << 3,
    Any = Class | Method | Parameter,
}
