#!/usr/bin/env node
const { Command } = require('commander');
const program = new Command();
const fs = require('fs'),
    Converter = require('openapi-to-postmanv2'),
    yaml = require('js-yaml');
program
    .version('1.0.0')
    .description('For OpenAPI to Newman and Create Test Flow')
    .option('-o, --output <file>', 'output file')
    .option('-f, --flow <file>', 'test flow file')
    .option('-s, --source <file>', 'openapi file').parse(process.argv);
const options = program.opts();

function CreateFlow() {
    if (options.source !== undefined) {
        sourceFile = fs.readFileSync(options.source, { encoding: 'UTF8' });
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
    var APIs = [];
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
            const items = conversionResult.output[0].data.item[0].item
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
            conversionResult.output[0].data.item[0].item = [];
            for (i = 0; i < flow.Setting.Flow.length; i++) {
                conversionResult.output[0].data.item[0].item[i] = {};
                conversionResult.output[0].data.item[0].item[i] = JSON.parse(JSON.stringify(APIs[flow.Setting.Flow[i].API]));
                conversionResult.output[0].data.item[0].item[i].event[0] = { "listen": "test", "script": { "exec": [] }, "type": "text/javascript", "packages": {} };
                for (var s of flow.Setting.Flow[i].Scripts) {
                    conversionResult.output[0].data.item[0].item[i].event[0].script.exec.push(flow.Setting.Scripts[s].Data);
                };
            }
            fs.writeFile(outputFile, JSON.stringify(conversionResult.output[0].data, null, 2), err => {
                if (err) {
                    console.error(err);
                }
            });
        });
}
CreateFlow();
