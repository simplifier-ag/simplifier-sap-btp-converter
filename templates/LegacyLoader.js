sap.ui.define([
    'LegacyTemplateAppName/simplifierLoader'    
], async function(sfl) {
    "use strict";

    var initSettings = async () => {
        SimplifierSettings.setAppName('LegacyTemplateAppName');
        var sMetadataUrl = sap.ui.require.toUrl(SimplifierSettings.appName + "/appbuilder-meta.json")
        var oAppMeta = await fetch(sMetadataUrl).then(m => m.json())        
        var baseUri = window.location.origin + sap.ui.require.toUrl("LegacyTemplateAppName");
        SimplifierSettings.apiBaseUrl = baseUri + '/';    
        SimplifierLoader.libraryRoot = SimplifierSettings.libBaseUrl = baseUri + '/library-managed'; 
    
        var _loadDependencies = async(oAppMeta) => {
            //SimplifierSettings.enableAnonymousLogin('');
            SimplifierSettings.enableAssetFingerprinting(oAppMeta.fingerprint);
    
            return new Promise((fnResolve) => {
                SimplifierLoader.provideScript('ui5');
                SimplifierLoader.addCachedStyle('css/' + SimplifierSettings.appName + '.css', 'App-Style')
    
                oAppMeta.assets.forEach(sAsset => {
                    SimplifierLoader.addCachedScript(sAsset);
                });
    
                oAppMeta.libraries.forEach(oLib => {
                    if (oLib.checksum) {
                        var sLibUrl = oLib.url;
                        SimplifierLoader.includeManagedLib(sLibUrl, function (addScript, addStyle, addBeforeInitHandler, addAfterInitHandler, sLibPath) {
                            new Function("addScript", "addStyle", "addBeforeInitHandler", "addAfterInitHandler", "sLibPath", oLib.snippet).apply(this, arguments);
                        });
                    } else {
                        (function () {
                            new Function(oLib.snippet).apply(this, arguments);
                        })();
                    }
                });
    
                SimplifierLoader.processLoading(fnResolve);
            });
        }
    
        await _loadDependencies(oAppMeta)
        var oPaths = oAppMeta.namespaces.reduce((acc, ns) => {
            var sns = ns.replaceAll(".", "/");
            acc[sns] = sap.ui.require.toUrl("LegacyTemplateAppName/resources/" + sns)
            return acc
        }, {})
    
        sap.ui.loader.config({
            paths: oPaths
        });
        oAppMeta.namespaces.forEach(sap.ui.getCore().loadLibrary)

        return {

        };
    }

    

    return await initSettings();
}); 