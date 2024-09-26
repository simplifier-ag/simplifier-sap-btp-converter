import * as fs from 'fs';
import yaml from 'js-yaml'

import { src, dest, series } from 'gulp'
import replace from 'gulp-replace'

import decompress from "decompress"
import { mkdir } from 'fs/promises'
import { Readable } from 'stream'
import { finished } from 'stream/promises'
import path from 'path'


const convertShared = async appName => {
    console.log(`converting shared libraries`)
   
    const downloadFile = (async (url, fileName) => {
      const res = await fetch(url);
      if (!fs.existsSync("downloads")) await mkdir("downloads"); //Optional if you already have downloads directory
      const destination = path.resolve("./downloads", fileName);
      const fileStream = fs.createWriteStream(destination, { flags: 'wx' })
      await finished(Readable.fromWeb(res.body).pipe(fileStream))
    })   

    console.log(`downloading widget-library`)
    const cdnUrl = "https://cdn.simplifier.io/widget-library/resources.zip"
    await downloadFile(cdnUrl, "resources.zip")

    console.log(`extracting widget-library`)
    await decompress('downloads/resources.zip', 'shared-build/widget-library/')
    
    const destinationUrlPlaceholder = `LegacyTemplateSimplifierURL`
    const sharedBuildDirectory = "shared-build"
    

    console.log('try reading old manifest.yml')
    const oldManifestYaml = yaml.load(fs.readFileSync(`${appName}/manifest.yml`, 'utf8'))
    const url = JSON.parse(oldManifestYaml.applications[0].env.destinations)[0].url
    console.log('url found: ' + url)

    const copyDestination = () => {
        console.log("adding shared destination")
        return src([`templates/simplifier-shared/destination.json`])
            .pipe(replace(`${destinationUrlPlaceholder}`, url))
            .pipe(dest(`${sharedBuildDirectory}`));
    }

    const copyXSSecurity = () => {
        console.log("adding shared xs-security")
        return src([`templates/simplifier-shared/xs-security.json`])
            .pipe(dest(`${sharedBuildDirectory}`));
    }

    const copyMTAPackage = () => {
        console.log("adding shared mta package")
        return src([`templates/simplifier-shared/package.json`])
            .pipe(dest(`${sharedBuildDirectory}`));
    }

    const copyMTA = () => {
        console.log("adding shared mta")
        return src([`templates/simplifier-shared/mta.yaml`])            
            .pipe(dest(`${sharedBuildDirectory}`));
    }

    const copyManifest = () => {
        console.log("converting shared manifest")
        return src([`templates/simplifier-shared/widget-library/manifest.json`])
            .pipe(dest(`${sharedBuildDirectory}/widget-library`));

    }

    const copyLibraryPackage = () => {
        console.log("coping shared package")
        return src([`templates/simplifier-shared/widget-library/package.json`])
            .pipe(dest(`${sharedBuildDirectory}/widget-library`));

    }

    const copyXSApp = () => {
        console.log("adding shared xs-app")
        return src([`templates/simplifier-shared/widget-library/xs-app.json`])
            .pipe(dest(`${sharedBuildDirectory}/widget-library`));
    }

    const convert = series(
        copyDestination,
        copyXSSecurity,
        copyMTAPackage,
        copyMTA,
        copyManifest,
        copyXSApp,
        copyLibraryPackage
    )

    convert()
}


export default convertShared