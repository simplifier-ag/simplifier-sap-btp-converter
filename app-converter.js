import * as fs from 'fs';
import yaml from 'js-yaml'

import { src, dest, series } from 'gulp'
import replace from 'gulp-replace'
import minify from 'gulp-minify'


const convertApp = (appName) => {    
    console.log("converting app: " + appName);

    const appNamePlaceholder = `LegacyTemplateAppName`    
    const appBuildDirectory = "app-build"
    

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
            `!${appBuildDirectory}/**`,
            '!node_modules/**'])
            .pipe(dest(`${appBuildDirectory}/${appName}`))
    };

    const copyModuleFiles = () => {
        console.log("coping module files")        
        return src([
            `${appName}/www/appDirect/**`,
            `!${appName}/www/appDirect/**/manifest.json`
        ])
            .pipe(dest(`${appBuildDirectory}/${appName}/appDirect`))
    };

    const copyAssetDirectory = (assetDirectory) => {
        console.log(`coping asset directory ${assetDirectory}`)
        return () => {
            return src([`${appName}/www/${assetDirectory}/**`])
                .pipe(dest(`${appBuildDirectory}/${appName}/${assetDirectory}`));
        }
    }
   
    const injectLoader = () => {
        console.log("injecting loader")
        return src([`${appBuildDirectory}/${appName}/Component.js`])
            .pipe(replace(
                new RegExp(`sap.ui.define\\(\\["sap\\/ui\\/core\\/UIComponent","${appName}\\/controller\\/Globals","${appName}/modules/SimplifierFormatter"\\],function\\(([a-z]{1}),([a-z]{1})\\){"use strict";`, "g"),
                `sap.ui.define(["${appName}/LegacyLoader", "sap/ui/core/UIComponent","${appName}/controller/Globals","${appName}/modules/SimplifierFormatter"], async function(LegacyLoader,$1,$2){"use strict";await LegacyLoader;`))
            .pipe(dest(`${appBuildDirectory}/${appName}`));
    };

    const injectLoaderPreFormatter = () => {
        console.log("injecting loader")
        return src([`${appBuildDirectory}/${appName}/Component.js`])
            .pipe(replace(
                new RegExp(`sap.ui.define\\(\\["sap\\/ui\\/core\\/UIComponent","${appName}\\/controller\\/Globals"\\],function\\(([a-z]{1}),([a-z]{1})\\){"use strict";`, "g"),
                `sap.ui.define(["${appName}/LegacyLoader", "sap/ui/core/UIComponent","${appName}/controller/Globals"], async function(LegacyLoader,$1,$2){"use strict";await LegacyLoader;`))
            .pipe(dest(`${appBuildDirectory}/${appName}`));
    };

    const injectLoaderDbg = () => {
        console.log("injecting loader in dbg")
        return src([`${appBuildDirectory}/${appName}/Component-dbg.js`])
            .pipe(replace('sap.ui.define([', `sap.ui.define([\n    '${appName}/LegacyLoader',`))
            .pipe(replace('function(UIComponent, Globals) {', 'async function(LegacyLoader, UIComponent, Globals) {'))
            .pipe(replace('"use strict";', '"use strict";\n    await LegacyLoader;'))
            .pipe(dest(`${appBuildDirectory}/${appName}`));
    };

    const injectLoaderPreload = () => {
        console.log("adjusting preload")
        return src([`${appBuildDirectory}/${appName}/Component-preload.js`])
            .pipe(replace(
                new RegExp(`sap.ui.define\\(\\["sap\\/ui\\/core\\/UIComponent","${appName}\\/controller\\/Globals","${appName}/modules/SimplifierFormatter"\\],function\\(([a-z]{1}),([a-z]{1})\\){"use strict";`, "g"),
                `sap.ui.define(["${appName}/LegacyLoader", "sap/ui/core/UIComponent","${appName}/controller/Globals","${appName}/modules/SimplifierFormatter"], async function(LegacyLoader,$1,$2){"use strict";await LegacyLoader;`))
            .pipe(dest(`${appBuildDirectory}/${appName}`));
    }

    const injectLoaderPreloadPreFormatter = () => {
        console.log("adjusting preload")
        return src([`${appBuildDirectory}/${appName}/Component-preload.js`])
            .pipe(replace(
                new RegExp(`sap.ui.define\\(\\["sap\\/ui\\/core\\/UIComponent","${appName}\\/controller\\/Globals"\\],function\\(([a-z]{1}),([a-z]{1})\\){"use strict";`, "g"),
                `sap.ui.define(["${appName}/LegacyLoader", "sap/ui/core/UIComponent","${appName}/controller/Globals"], async function(LegacyLoader,$1,$2){"use strict";await LegacyLoader;`))
            .pipe(dest(`${appBuildDirectory}/${appName}`));
    }

    const copyLegacyLoader = () => {
        console.log("coping legacy loader")
        return src([`templates/simplifier-app/LegacyLoader.js`])
            .pipe(replace(
                `${appNamePlaceholder}`, `${appName}`))
            .pipe(dest(`${appBuildDirectory}/${appName}`));
    }

    const minifyLegacyLoader = () => {
        console.log("minifing loader")
        return src(`${appBuildDirectory}/${appName}/LegacyLoader.js`)
            .pipe(minify({
                ext: {
                    src: '-dbg.js',
                    min: '.js'
                }
            }))
            .pipe(dest(`${appBuildDirectory}/${appName}`));
    }

    const minifyComponent = () => {
        console.log("minifing compontent")
        return src(`${appBuildDirectory}/${appName}/Component-dbg.js`)
            .pipe(minify({
                ext: {
                    src: '-dbg.js',
                    min: '.js'
                }
            }))
            .pipe(dest(`${appBuildDirectory}/${appName}`));
    }

    const injectLoaderPreloadComponent = () => {
        console.log("add loader to component preload")
        const legacyLoaderMinified = fs.readFileSync(`${appBuildDirectory}/${appName}/LegacyLoader.js`, "utf8");
        return src(`${appBuildDirectory}/${appName}/Component-preload.js`)
            .pipe(replace(
                `sap.ui.require.preload({`,
                `sap.ui.require.preload({\n"${appName}/LegacyLoader.js": function(){
                    ${legacyLoaderMinified}
                },`.replace(/^ +/gm, '')))
            .pipe(dest(`${appBuildDirectory}/${appName}`));

    }

    const copyAppPackage = () => {
        console.log("coping app package")
        return src([`templates/simplifier-app/webapp/package.json`])
            .pipe(replace(
                `${appNamePlaceholder}`, `${appName}`))
            .pipe(dest(`${appBuildDirectory}/${appName}`));

    }

    const copyXSApp = () => {
        console.log("adding xs-app")
        return src([`templates/simplifier-app/webapp/xs-app.json`])
            .pipe(dest(`${appBuildDirectory}/${appName}`));
    }
  
    const copyManifest = () => {
        console.log("converting manifest")
        return src([`templates/simplifier-app/webapp/manifest.json`])
            .pipe(replace(`${appNamePlaceholder}`, `${appName}`))
            .pipe(dest(`${appBuildDirectory}/${appName}`));

    }
  
    const copyMTA = () => {
        console.log("adding mta")
        return src([`templates/simplifier-app/mta.yaml`])
            .pipe(replace('PathToApp', `${appName}`))
            .pipe(replace(`${appNamePlaceholder}`, `${appName}`))
            .pipe(dest(`${appBuildDirectory}`));
    }

    
    const copyMTAPackage = () => {
        console.log("adding mta package")
        return src([`templates/simplifier-app/package.json`])
            .pipe(replace(`${appNamePlaceholder}`, `${appName}`))
            .pipe(dest(`${appBuildDirectory}`));
    }

    const injectSimplifierSettingsToEventHolder = () => {
        console.log("injecting simplifier settings in event holder")
        return src([`${appBuildDirectory}/${appName}/modules/EventHolder.js`])
            .pipe(replace(`sap.ui.define(["sap/ui/base/Object"]`, `sap.ui.define(["sap/ui/base/Object","${appName}/simplifierLoader"]`))
            .pipe(replace(`//# sourceMappingURL=EventHolder.js.map`, ``))
            .pipe(dest(`${appBuildDirectory}/${appName}/modules`));
    };

    const injectSimplifierSettingsToEventHolderDbg = () => {
        console.log("injecting simplifier settings in event holder dbg")
        return src([`${appBuildDirectory}/${appName}/modules/EventHolder-dbg.js`])
            .pipe(replace(`sap.ui.define([\n    'sap/ui/base/Object'`, `sap.ui.define([\n    'sap/ui/base/Object',\n    '${appName}/simplifierLoader'`))
            .pipe(dest(`${appBuildDirectory}/${appName}/modules`));
    };

    const injectEventHolderPreloadComponent = () => {
        console.log("add event holder to component preload")

        const regEx = new RegExp(`"${appName}\\/modules/EventHolder\\.js":function\\(\\){(\\n.+)`, "g");
        const eventHolderMinified = fs.readFileSync(`${appBuildDirectory}/${appName}/modules/EventHolder.js`, "utf8");
        return src(`${appBuildDirectory}/${appName}/Component-preload.js`)
            .pipe(replace(
                regEx,
                `"${appName}/modules/EventHolder.js": function(){
                    ${eventHolderMinified}
                `.replace(/^ +/gm, '')))
            .pipe(dest(`${appBuildDirectory}/${appName}`));

    }

    // remove from appbuilder-meta.json widget-libraries -> only load io.simplifier.widgets
    const addOnlyWidgetsLibToAppBuilderMeta = () => {
        console.log("add io.simplifier.widgets to appbuilder-mta.json")

        const regEx = new RegExp(`"namespaces" : \\[.+\\]`, "g");
        return src(`${appBuildDirectory}/${appName}/appbuilder-meta.json`)
            .pipe(replace(
                regEx,
                `"namespaces" : ["io.simplifier.widgets"]`))
            .pipe(dest(`${appBuildDirectory}/${appName}`));

    }


    const tasks = []
    tasks.push(copyAppFiles)
    
    if (fs.existsSync(`${appName}/www/appDirect/`)) {
        tasks.push(copyModuleFiles)       
    }



    tasks.push(copyAssetDirectory("css"))
    if (fs.existsSync(`${appName}/www/img/`)) {
        tasks.push(copyAssetDirectory("img"))
    }
    if (fs.existsSync(`${appName}/www/data/`)) {
        tasks.push(copyAssetDirectory("data"))
    }
    tasks.push(copyAssetDirectory("i18n"))
    if (fs.existsSync(`${appName}/www/library-managed/`)) {
        tasks.push(copyAssetDirectory("library-managed"))
    }

    tasks.push(injectSimplifierSettingsToEventHolderDbg)
    tasks.push(injectSimplifierSettingsToEventHolder)
    tasks.push(injectEventHolderPreloadComponent)

    tasks.push(injectLoader)
    tasks.push(injectLoaderPreFormatter)
    tasks.push(injectLoaderDbg)
    tasks.push(injectLoaderPreload)
    tasks.push(injectLoaderPreloadPreFormatter)

    tasks.push(copyLegacyLoader)
    tasks.push(minifyLegacyLoader)
    tasks.push(injectLoaderPreloadComponent)

    tasks.push(addOnlyWidgetsLibToAppBuilderMeta)

    tasks.push(copyAppPackage)
    tasks.push(copyXSApp)
    tasks.push(copyManifest)
    tasks.push(copyMTA)
    tasks.push(copyMTAPackage)

    const convert = series(...tasks)

    convert()
}



export default convertApp
