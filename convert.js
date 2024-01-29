const fs = require('fs');

const yaml = require("js-yaml");

const replace = require('gulp-replace');
const minify = require('gulp-minify');
const { src, dest, series } = require("gulp");

const appName = process.argv[2]
console.log("converting app: " + appName);

const appNamePlaceholder = `LegacyTemplateAppName`
const destinationPlaceholder = `LegacyTemplateSimplifierInstance`
const destinationUrlPlaceholder = `LegacyTemplateSimplifierURL`


console.log('try reading old manifest.yml')
const oldManifestYaml = yaml.load(fs.readFileSync(`${appName}/manifest.yml`, 'utf8'))
const url = JSON.parse(oldManifestYaml.applications[0].env.destinations)[0].url
console.log('url found: ' + url)

console.log('processing files')

const copyAppFiles = () => {
    console.log("coping app files")
    return src([
        `${appName}/www/**/*.js`, 
        `${appName}/www/**/*.json`, 
        `${appName}/www/**/*.css`,
        `${appName}/www/**/*.properties`,
        `${appName}/www/**/*.html`,
        `${appName}/www/**/*.png`,
        `${appName}/www/**/*.jpg`,
        `${appName}/www/**/*.jpeg`,
        `${appName}/www/**/*.map`,
        `${appName}/www/resources/**`, 
        `${appName}/www/img/**`, 
        `!${appName}/**/system-library/**`, 
        '!gulpfile.js', 
        '!build/**', 
        '!node_modules/**'])
        .pipe(dest(`build/${appName}`))
};

const injectLoaderDbg = () => {
    console.log("injecting loader")
    return src([`build/${appName}/Component-dbg.js`])
        .pipe(replace('sap.ui.define([', `sap.ui.define([\n    '${appName}/LegacyLoader',`))
        .pipe(replace('function(UIComponent, Globals) {', 'async function(LegacyLoader, UIComponent, Globals) {'))
        .pipe(replace('"use strict";', '"use strict";\n    await LegacyLoader;'))            
        .pipe(dest(`build/${appName}`));   
};

const injectLoaderPreload = () => {
    console.log("adjusting preload")
    return src([`build/${appName}/Component-preload.js`])
        .pipe(replace(
            `sap.ui.define(["sap/ui/core/UIComponent","${appName}/controller/Globals"],function(e,o){"use strict";`, 
            `sap.ui.define(["${appName}/LegacyLoader", "sap/ui/core/UIComponent","${appName}/controller/Globals"], async function(LegacyLoader,e,o){"use strict";await LegacyLoader;`))
        .pipe(dest(`build/${appName}`));        
}

const copyLegacyLoader = () => {
    console.log("coping legacy loader")
    return src([`templates/LegacyLoader.js`])
        .pipe(replace(
            `${appNamePlaceholder}`, `${appName}`))
        .pipe(dest(`build/${appName}`));
}

const minifyLegacyLoader = () => {
    console.log("minifing loader")
    return src(`build/${appName}/LegacyLoader.js`)
        .pipe(minify({
            ext:{
                src:'-dbg.js',
                min:'.js'
            }
        }))
        .pipe(dest(`build/${appName}`));
}

const injectLoaderPreloadComponent = () => {
    console.log("add loader to component preloade")
    const legacyLoaderMinified = fs.readFileSync(`build/${appName}/LegacyLoader.js`, "utf8");  
    return src(`build/${appName}/Component-preload.js`)
        .pipe(replace(
            `sap.ui.require.preload({`, 
            `sap.ui.require.preload({\n"${appName}/LegacyLoader.js": function(){
                ${legacyLoaderMinified}
            },`))
        .pipe(dest(`build/${appName}`));
    
}

const copyAppPackage = () => {
    console.log("coping app package")
    return src([`templates/app/package.json`])
        .pipe(replace(
            `${appNamePlaceholder}`, `${appName}`))
        .pipe(dest(`build/${appName}`));
    
}

const copyXSApp = () => {
    console.log("adding xs-app")
    return src([`templates/app/xs-app.json`])
        .pipe(replace(
            `${destinationPlaceholder}`, `${appName}Instance`))
        .pipe(dest(`build/${appName}`));
}

const copyManifest = () => {
    console.log("converting manifest")
    return src([`templates/app/manifest.json`])
        .pipe(replace(`${appNamePlaceholder}`, `${appName}`))
        .pipe(dest(`build/${appName}`));
    
}

const copyDestination = () => {
    console.log("adding destination")
    return src([`templates/destination.json`])
        .pipe(replace(`${destinationPlaceholder}`, `${appName}Instance`))
        .pipe(replace(`${destinationUrlPlaceholder}`, url))
        .pipe(dest(`build`));
}

const appNameConverted = appName.toLowerCase().replaceAll("_", "-")
const copyMTA = () => {
    console.log("adding mta")
    return src([`templates/mta.yaml`])
        .pipe(replace('PathToApp', `${appName}`))
        .pipe(replace(`${appNamePlaceholder}`, `${appName}`))
        .pipe(dest(`build`));
}

const copyXSSecurity = () => {
    console.log("adding xs-security")
    return src([`templates/xs-security.json`])
        .pipe(replace(`${appNamePlaceholder}`, `${appName}`))
        .pipe(dest(`build`));
}

const copyMTAPackage = () => {
    console.log("adding mta package")
    return src([`templates/package.json`])
        .pipe(replace(`${appNamePlaceholder}`, `${appName}`))
        .pipe(dest(`build`));
}

const convert = series(
    copyAppFiles, 
    injectLoaderDbg,
    injectLoaderPreload,
    copyLegacyLoader,
    minifyLegacyLoader,
    injectLoaderPreloadComponent,

    copyAppPackage,
    copyXSApp,
    copyManifest,
    copyDestination,
    copyMTA,
    copyXSSecurity,
    copyMTAPackage
)
convert();

