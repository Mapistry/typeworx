#!/usr/bin/env node
import { execute } from './index';

function outputHelp() {
    log(`
Welcome to TypeWorx
Usage: <filePathOrGlob> [pluginOptionsOrState]
Global Options:
"--namespaces namespace1,namespace2,etc": Restricts processing to a specific decorator namespace. "*"
can be used for specific sub-namespaces. If this option is omitted it is equivalent to "*" for all.
`);
    log('Usage: <filePathOrGlob> [pluginOptionsOrState]');
}

function log(str: string) {
    // tslint:disable-next-line:no-console
    console.log(str);
}

function processArguments(remainingArgs: string[]): any {
    const convertedArgs = {};
    for (let i = 0; i < remainingArgs.length; i++) {
        const arg = remainingArgs[i];
        if (arg.indexOf('--') !== 0) {
            continue;
        }
        let value: any = remainingArgs[i + 1];
        if (value === undefined || value.indexOf('--') === 0 || value.toLowerCase() === 'true') {
            value = true;
        }
        convertedArgs[arg.replace('--', '')] = value;
    }
    return convertedArgs;
}

const args = process.argv;
if (args.length < 3) {
    outputHelp();
    process.exit(0);
}
if (args.map((a) => a.toLowerCase()).indexOf('--help') > -1) {
    outputHelp();
    process.exit(0);
}
const filePathOrGlob = args[2];
const pluginOptionsOrState = processArguments(args.slice(3));
if (pluginOptionsOrState.namespaces) {
    pluginOptionsOrState.namespaces = pluginOptionsOrState.namespaces.split(',');
}
execute(filePathOrGlob, pluginOptionsOrState).then((state) => {
    for (const key of Object.keys(state.outputs)) {
        const obj = state.outputs[key];
        // tslint:disable-next-line:no-console
        console.log(obj);
    }
}).catch((err) => {
    // tslint:disable-next-line:no-console
    console.error(`An error occured: ${err}`);
});
