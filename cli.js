#!/usr/bin/env node
const program = require('commander');
const chalk = require('chalk');
const { spawn } = require('child_process');
const fileWatch = require('node-watch');
const fs = require('fs');
const jsonlint = require('jsonlint');
const clear = require('clear');
const conf = require('rc')('jsonapimock', {
    port: 3004,
    watch: 'db.json',
    nestedRoutePrefix: 'route:',
    contentType: 'application/vnd.api+json',
    accept: 'application/vnd.api+json',
});
program
    .version('1.0.3')
    .option('-p --port [port]', 'Change the port from the default 3004')
    .option('-w, --watch [value]', 'Watch a .json file to act as a DB')
    .parse(process.argv);

const port = program.port || conf.port;
const watch = program.watch || conf.watch;
const watchDir = process.cwd() + '/' + watch;
let child = null;

// functions
const getJSONData = () => fs.readFileSync(watchDir, { encoding: 'utf-8' });
const errorMessage = (text) => chalk.white.bgRed(text);
const validateJSON = (json) => {
    try {
        jsonlint.parse(json);
        return true;
    } catch (e) {
        clear();
        console.log(`
${errorMessage(e.name)}

${e.message}
`);
        return null;
    }
};
const spawnNodeServer = () => {
    clear();
    const env = Object.create(process.env);
    env.PORT = port;
    env.WATCHFILE = watch;
    env.NESTEDROUTEPREFIX = conf.nestedRoutePrefix;
    env.CONTENTTYPE = conf.contentType;
    env.ACCEPT = conf.accept;
    const child = spawn(`jsonapi-mock-node-server`, [], { env: env });
    child.stdout.on('data', data => console.log(String(data)));
    child.stderr.on('data', data => console.log(String(data)));
    return child;
};
if (fs.existsSync(watchDir)) {
    // watcher
    fileWatch(watchDir, { recursive: false }, (e, name) => {
        if (e === 'update') {
            child.kill();
            clear();
            child = spawnNodeServer();
        }

        if (e === 'remove') {
            clear();
            console.log(`

${errorMessage(`Couldn't read ${watch} because it got removed!`)}

        `);
        }
    });
    // init server
    if (validateJSON(getJSONData())) {
        child = spawnNodeServer();
    }
} else if (!fs.existsSync(watchDir)) {
    const sampleJson = require('./src/db.json');
    console.log(`

${errorMessage(`db.json file not found!`)}

    ${chalk.green.bold(`Generating one with sample data for you. :)`)}

    `);
    fs.writeFileSync(watchDir, JSON.stringify(sampleJson, null, 4), (err) => {
        if (err) {
            return console.log(err);
        }
        console.log(`

        ${chalk.green.bold(`Generated sample db.json!`)}

        `);
    });
    // init server
    if (validateJSON(getJSONData())) {
        child = spawnNodeServer();
    }
}