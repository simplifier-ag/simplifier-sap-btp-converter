/** @namespace AppName */
/** @namespace AppName.modules */
/** @namespace AppName.controller */

/**
 * @namespace
 */
var oAppLoader = {

    /**
     * Handle Event that UI5 finished initializing.
     * @param {string} appName name of the application
     */
    onSAPUI5Loaded: function(appName) {
        oAppLoader.initializeUI5(appName);
    },

    /**
     * Event handler: views have been registered.
     * @private
     */
    _onViewRegistered : function() {
        window.onerror = undefined;
        $("#itizBusyIndicator").fadeOut("slow", function() {
            $("#itizBusyIndicator").empty();
            $("#content").fadeIn("slow");
        });
    },

    /**
     * @callback RegisterNamespaces
     */

    /**
     * Start initializing UI5 Application.
     * @param {string} appName application name
     * @param {RegisterNamespaces} [registerNamespaces] callback to register namespaces
     */
    initializeUI5: function(appName, registerNamespaces) {
        window.onerror = SimplifierLoader.showInitErrorPage;
        sap.ui.getCore().getEventBus().subscribe("ApplicationChannel", "onViewsRegistered", this._onViewRegistered, this);
        jQuery.sap.registerModulePath(appName, '');
        if (typeof registerNamespaces === 'function') {
            registerNamespaces();
        }
        sap.ui.getCore().attachInit(function() {
            var component = new sap.ui.core.ComponentContainer({
                name : appName,
                async: true,
                height : "100%", //Legacy Code entfernt
                width  : "100%"
            });

            sap.ui.Device.orientation.attachHandler(function (oEvt) {
                $("#RemoteDiv").height(document.body.offsetHeight - 48);
                component.setHeight("100%"); //Legacy Code entfernt
                $('#content').outerHeight("100%"); //Legacy Code entfernt
            }.bind(this));

            component.placeAt("content");
            $('#content').outerHeight("100%"); //Legacy Code entfernt
            console.debug("Simplifier application initialized.");
        }.bind(this));
    }
};
