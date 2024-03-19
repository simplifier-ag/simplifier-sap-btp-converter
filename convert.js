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
        `${appName}/www/**/*.html`,    
        `${appName}/www/resources/**`,        
        `!${appName}/www/appDirect/**`,
        `!${appName}/**/library-managed/**`,
        `!${appName}/**/system-library/**`, 
        '!gulpfile.js', 
        '!build/**', 
        '!node_modules/**'])
        .pipe(dest(`build/${appName}`))
};

const copyModuleFiles = () => {
    console.log("coping module files")
    return src([
        `${appName}/www/appDirect/**`,
        `!${appName}/www/appDirect/**/manifest.json`
        ])
        .pipe(dest(`build/${appName}/appDirect`))
};

const copyAssetDirectory = (assetDirectory) => {
    console.log(`coping asset directory ${assetDirectory}`)
    return () => {
        return src([`${appName}/www/${assetDirectory}/**`])
        .pipe(dest(`build/${appName}/${assetDirectory}`));
    }
}

const addUrlToIndexHtml = () => {
    console.log("change index html")
    
    const regEx = new RegExp(`<html data-baseurl=".+">`, "g");
        return src(`build/${appName}/index.html`)
        .pipe(replace(
            regEx, 
            `<html data-baseurl="${url}" data-appDeploymentType="SAPCloudPlatform">`))
        .pipe(dest(`build/${appName}`));
}


const copySimplifierLoader = () => {
    console.log("coping simplifier loader")
    return src([`templates/simplifierLoader.js`])        
        .pipe(dest(`build/${appName}`));
}

const minifySimplifierLoader = () => {
    console.log("minifing simplifier loader")
    return src(`build/${appName}/simplifierLoader.js`)
        .pipe(minify({
            ext:{
                src:'-dbg.js',
                min:'.js'
            }
        }))
        .pipe(dest(`build/${appName}`));
}

const injectSimplifierLoaderPreloadComponent = () => {
    console.log("add simplifier loader to component preloade")
    
    const regEx = new RegExp(`"${appName}\\/simplifierLoader\\.js":function\\(\\){(\\n.+)`, "g");
    const simplifierLoaderMinified = fs.readFileSync(`build/${appName}/simplifierLoader.js`, "utf8");  
    return src(`build/${appName}/Component-preload.js`)
        .pipe(replace(
            regEx, 
            `"${appName}/simplifierLoader.js": function(){
                ${simplifierLoaderMinified}
            `))
        .pipe(dest(`build/${appName}`));
    
}

const copyUi5AppLoader = () => {
    console.log("coping ui5 app loader")
    return src([`templates/ui5AppLoader.js`])        
        .pipe(dest(`build/${appName}`));
}

const minifyUi5AppLoader = () => {
    console.log("minifing ui5 app loader")
    return src(`build/${appName}/ui5AppLoader.js`)
        .pipe(minify({
            ext:{
                src:'-dbg.js',
                min:'.js'
            }
        }))
        .pipe(dest(`build/${appName}`));
}

const injectLoader = () => {
    console.log("injecting loader")
    return src([`build/${appName}/Component.js`])
        .pipe(replace(
            new RegExp(`sap.ui.define\\(\\["sap\\/ui\\/core\\/UIComponent","${appName}\\/controller\\/Globals"\\],function\\(([a-z]{1}),([a-z]{1})\\){"use strict";`, "g"),
            `sap.ui.define(["${appName}/LegacyLoader", "sap/ui/core/UIComponent","${appName}/controller/Globals"], async function(LegacyLoader,$1,$2){"use strict";await LegacyLoader;`))
        .pipe(dest(`build/${appName}`));
};

const injectLoaderDbg = () => {
    console.log("injecting loader in dbg")
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
            new RegExp(`sap.ui.define\\(\\["sap\\/ui\\/core\\/UIComponent","${appName}\\/controller\\/Globals"\\],function\\(([a-z]{1}),([a-z]{1})\\){"use strict";`, "g"),
            `sap.ui.define(["${appName}/LegacyLoader", "sap/ui/core/UIComponent","${appName}/controller/Globals"], async function(LegacyLoader,$1,$2){"use strict";await LegacyLoader;`))
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

const minifyComponent = () => {
    console.log("minifing compontent")
    return src(`build/${appName}/Component-dbg.js`)
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
    copyModuleFiles,
    copyAssetDirectory("css"),
    copyAssetDirectory("img"),
    copyAssetDirectory("data"),
    copyAssetDirectory("i18n"),
    copyAssetDirectory("library-managed"),

    // only needed for direct index.html access
    addUrlToIndexHtml,

    copySimplifierLoader,
    minifySimplifierLoader,
    injectSimplifierLoaderPreloadComponent,

    copyUi5AppLoader,
    minifyUi5AppLoader,
    // only needed for direct index.html access end
      
    injectLoader,
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

