import convertApp from './app-converter.js'
import convertShared from './shared-converter.js'

console.log(convertApp)

const appName = process.argv[2]

convertApp(appName)

convertShared(appName)