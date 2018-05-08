export interface ResolvedFunctions {
    beforeAll: { namespace: string, fqn: string, func: (...params) => (void | Promise<void>), args: any[] }[];
    afterAll: { namespace: string, fqn: string, func: (...params) => (void | Promise<void>), args: any[] }[];
    functions: ({ namespace: string, func: (...params) => (void | Promise<void>), args: any[] })[];
}
