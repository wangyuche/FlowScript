#!/usr/bin/env node
const { Command } = require('commander');
const program = new Command();
const fs = require('fs'),
    Converter = require('openapi-to-postmanv2'),
    yaml = require('js-yaml');
program
    .version('1.0.10')
    .description('For OpenAPI to Newman and Create Test Flow')
    .option('-o, --output <file>', 'output file')
    .option('-f, --flow <file>', 'test flow file')
    .option('-s, --source [file file...]', 'openapi file', commaSeparatedList).parse(process.argv);
const options = program.opts();
var APIs = [];
function commaSeparatedList(value, dummyPrevious) {
    return value.split(' ');
}

function CreateFlow() {
    if (options.source !== undefined) {
        if (options.source.length > 1) {
            try {
                let sourceFileObject;
                let paths;
                let schemas;
                for (const file of options.source) {
                    if (sourceFileObject === undefined) {
                        sourceFileObject = yaml.load(fs.readFileSync(file, { encoding: 'UTF8' }));
                        paths = sourceFileObject.paths;
                        schemas = sourceFileObject.components.schemas;
                    } else {
                        const p = yaml.load(fs.readFileSync(file, { encoding: 'UTF8' })).paths;
                        paths = { ...paths, ...p };
                        const s = yaml.load(fs.readFileSync(file, { encoding: 'UTF8' })).components.schemas;
                        schemas = { ...schemas, ...s };
                    }
                }
                sourceFileObject.paths = paths;
                sourceFileObject.components.schemas = schemas;
                //console.log(sourceFileObject);
                sourceFile = yaml.dump(sourceFileObject);
            } catch (error) {
                console.error('Error merging OpenAPI files:', error.message);
                process.exit(1);
            }
        } else {
            sourceFile = fs.readFileSync(options.source[0], { encoding: 'UTF8' });
        }
    } else {
        console.error("Please use the -s option to specify the source file.");
        process.exit(0);
    }
    if (options.flow !== undefined) {
        flowFile = fs.readFileSync(options.flow, { encoding: 'UTF8' });
    } else {
        console.error("Please use the -f option to specify the flow file.");
        process.exit(0);
    }
    if (options.output !== undefined) {
        outputFile = options.output;
    } else {
        outputFile = "test.json";
    }

    var flow = yaml.load(flowFile);
    Converter.convert({ type: 'string', data: sourceFile },
        {
            requestNameSource: "Fallback",
            indentCharacter: "Space",
            folderStrategy: "Paths",
            parametersResolution: "Example",
            requestParametersResolution: "Example",
            exampleParametersResolution: "Example",
            includeAuthInfoInExample: true,
            enableOptionalParameters: true,
            keepImplicitHeaders: false,
            includeDeprecated: true,
            alwaysInheritAuthentication: false
        }, (err, conversionResult) => {
            if (!conversionResult.result) {
                console.log('Could not convert', conversionResult.reason);
            }
            conversionResult.output[0].data.info.name = flow.Setting.Describe;
            conversionResult.output[0].data.info.description.content = flow.Setting.Describe;

            RecursionItem(conversionResult.output[0].data.item);
            /*
            const items = conversionResult.output[0].data.item[0].item === undefined ? conversionResult.output[0].data.item : conversionResult.output[0].data.item[0].item
            for (const item of items) {
                _url = "";
                item.request.url.path.forEach((u) => {
                    if (u[0] === ":") {
                        u = u.replace(":", "{");
                        u = u + "}";
                    }
                    _url = _url + "/" + u;
                });
                APIs[_url] = item;
            };
            */
            var item = [];
            for (i = 0; i < flow.Setting.Flow.length; i++) {
                item[i] = {};
                if (APIs[flow.Setting.Flow[i].API] !== undefined) {
                    item[i] = JSON.parse(JSON.stringify(APIs[flow.Setting.Flow[i].API]));
                    item[i].event[0] = { "listen": "test", "script": { "exec": [] }, "type": "text/javascript", "packages": {} };
                    for (var s of flow.Setting.Flow[i].Scripts) {
                        if (typeof s === 'object') {
                            const keyName = Object.keys(s)[0];
                            const arr = s[keyName];
                            for (var key of arr) {
                                var _c = flow.Setting.Scripts[keyName].Data;
                                _c = _c.replaceAll(key.Key, key.Value);
                                item[i].event[0].script.exec.push(_c);
                            }
                        }else{
                            item[i].event[0].script.exec.push(flow.Setting.Scripts[s].Data);
                        }
                    };
                    _path = [];
                    item[i].request.url.path.forEach((u) => {
                        if (u[0] === ":") {
                            u = u.replace(":", "{{");
                            u = u + "}}";
                        }
                        _path.push(u);
                    });
                    if (flow.Setting.Flow[i].Host !== undefined) {
                        item[i].request.url.host = [flow.Setting.Flow[i].Host];
                    }
                    item[i].request.url.path = _path;
                    item[i].request.url.variable = [];
                    item[i].name = flow.Setting.Flow[i].Describe;
                    item[i].request.name = flow.Setting.Flow[i].Describe;
                    item[i].response = [];
                    if (item[i].request.body !== undefined) {
                        item[i].request.body.raw = flow.Setting.Flow[i].Body;
                    }
                    if (flow.Setting.Flow[i].Headers !== undefined) {
                        var headers = [];
                        for (j = 0; j < flow.Setting.Flow[i].Headers.length; j++) {
                            headers[j] = { type: flow.Setting.Flow[i].Headers[j].type, value: flow.Setting.Flow[i].Headers[j].value, key: flow.Setting.Flow[i].Headers[j].key };
                        }
                        item[i].request.header = headers;
                    }
                }
            }
            if (flow.Setting.Variable !== undefined) {
                var variable = [];
                for (i = 0; i < flow.Setting.Variable.length; i++) {
                    variable[i] = { type: flow.Setting.Variable[i].type, value: flow.Setting.Variable[i].value, key: flow.Setting.Variable[i].key };
                }
                conversionResult.output[0].data.variable = variable;
            }
            // if (conversionResult.output[0].data.item[0].item === undefined) {
            conversionResult.output[0].data.item = item
            // } else {
            //     conversionResult.output[0].data.item[0].item = item
            // }
            //console.log(JSON.stringify(conversionResult.output[0].data.item, null, 2));
            fs.writeFile(outputFile, JSON.stringify(conversionResult.output[0].data, null, 2), err => {
                if (err) {
                    console.error(err);
                }
            });
        });
}

function RecursionItem(item) {
    if (Array.isArray(item)) {
        for (const _item of item) {
            if (Array.isArray(_item.item)) {
                RecursionItem(_item.item);
            } else {
                _url = "";
                _item.request.url.path.forEach((u) => {
                    if (u[0] === ":") {
                        u = u.replace(":", "{");
                        u = u + "}";
                    }
                    _url = _url + "/" + u;
                });
                APIs[_url] = _item;
            }
        }
    }
}

CreateFlow();
