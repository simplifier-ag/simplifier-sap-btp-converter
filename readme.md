# simplifier-sap-btp-converter

This project converts Simplifier Fiori Apps build with Simplifier Low-Code and makes them available in the SAP Build Work Zone
This project is in preview state and to be used "AS-IS" and requires deeper knowledge about MTA and SAP BTP Deployment.
It is not tested for all kind of Simplifier Business Apps.


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
