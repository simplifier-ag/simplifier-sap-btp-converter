# btp-converter

This project temporarily converts old BTP download apps from the Simplifier into a new structure and then makes them available in the SAP Build Work Zone. After restructuring the apps within the Simplifier, the project is obsolete


## Convert

Extract the Zip file and then run

```
npm run convert <App/Extracted Folder Name>
```


When conversion is finished copy the build directory for your adjustments withing the SAP Build Work Zone 

## Check conversion

Check the following files and adjust values to your needs
- manifest.json
- xs-app.json
- xs-security.json
- destination.json
- mta.yaml

## Deploy
Within the converted app directory

Make sure you are logged in to BTP (https://developers.sap.com/tutorials/cp-cf-download-cli.html)

And install cf plugins

```
cf add-plugin-repo CF-Community https://plugins.cloudfoundry.org
```

```
cf install-plugin multiapps -f
```

```
cf login
```

Install

```
npm install
```

Deploy

```
npm run deploy
```

## SAP Build Work Zone
Don't forget to adjust the SAP Build Work Zone and the Site-Manager to your needs
https://help.sap.com/docs/cloud-portal-service/sap-cloud-portal-service-on-cloud-foundry/your-working-environment

Hint: make sure to hit the refresh button within the content channels