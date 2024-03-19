/**
 * Simplifier Module Loader.
 *
 * When this file is loaded, it includes a new object `SimplifierLoader` to global Scope.
 *
 * In order to add the dependencies, create a function that initializes all the dependencies.
 * If the SimplifierLoad is is already loaded, you can call the initializer function directly, otherwise listen to the
 * custom document event 'onSimplifierLoaderReady' which will be fired after the SimplifierLoader is ready.
 *
 * @example
 * <pre><code>
 * if (typeof SimplifierLoader === 'object') {
 *     executeWithScriptLoader();
 * } else {
 *     document.addEventListener('onSimplifierLoaderReady', executeWithScriptLoader, false);
 * }
 * </code></pre>
 *
 * @author Christian Simon
 */
(function() {

    "use strict";

    /**
     * Make url relative, enforce trailing slash (for appending it to a relative root path)
     * @param {string} src source url
     * @return {string} fixed url
     * @private
     */
    function _relativize(src) {
        if (typeof src === "string" && src.length >= 1 && src.substr(0, 1) !== "/") {
            return '/' + src;
        }
        return src;
    }

    var _unnamedCounter = 0;

    /**
     * Parse URL into components.
     * @param {string} url URL to parse
     * @returns {{protocol, host, hostname, port, pathname, search, searchObject: {}, hash}}
     * @private
     */
    function _parseURL(url) {
        var parser = document.createElement('a');
        var searchObject = {};
        var queries;
        var split;

        // Let the browser do the work
        parser.href = url;
        // Convert query string to object
        queries = parser.search.replace(/^\?/, '').split('&');
        for(var i = 0; i < queries.length; i++ ) {
            split = queries[i].split('=');
            searchObject[split[0]] = split[1];
        }
        return {
            protocol: parser.protocol,
            host: parser.host,
            hostname: parser.hostname,
            port: parser.port,
            pathname: parser.pathname,
            search: parser.search,
            searchObject: searchObject,
            hash: parser.hash
        };
    }

    /**
     * Get Web Socket URL from HTTP Url (http:// -> ws://, https:// -> wss://)
     * @param {string} httpUrl url with http or https prefix
     * @private
     */
    function _deriveWebSocketUrl(httpUrl) {
        return httpUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
    }

    /**
     * Get origin of target URL (e.g. http://dev.simplifier.io).
     * @param {string} url URL to get the origin for
     * @private
     */
    function _getOrigin(url) {
        var parsedUrl = _parseURL(url);
        return parsedUrl.protocol + "//" + parsedUrl.hostname + (parsedUrl.port ? ':' + parsedUrl.port : '');
    }

    /**
     * Read Data-Attribute on the root Html Element
     * @param attribute name of the data attribute (without "data-" prefix)
     * @param defaultValue the default value to return, if the attribute was not found
     * @returns {string | null}
     * @private
     */
    function _readHtmlAttribute(attribute, defaultValue) {
        return document.getElementsByTagName("html")[0].getAttribute("data-" + attribute) || defaultValue;
    }


    /**
     * Create ScriptData entry.
     * @param {string} scriptUrl script url
     * @param {string} name script name (for references in dependencies, defaults to 'unnamed${counter}')
     * @param {Array<string>|string} [dependencies] names of scripts fo dependencies
     * @class
     */
    function ScriptData(scriptUrl, name, dependencies) {
        this.name = (typeof name === 'string' ? name : 'unnamed' + (_unnamedCounter++));
        this.url = scriptUrl;
        this.dependencies = [];
        if (Array.isArray(dependencies)) {
            this.dependencies = dependencies.slice(0); // Create shallow clone
        } else if (typeof dependencies === 'string') {
            this.dependencies.push(dependencies);
        }
    }

    /**
     * Remove dependency from script (if existing)
     * @param dep dependency name to remove
     */
    ScriptData.prototype.removeDependency = function removeDependency(dep) {
        for(var i = 0; i < this.dependencies.length; i++) {
            if (this.dependencies[i] === dep) {
                this.dependencies.splice(i, 1);
                return;
            }
        }
    };

    /**
     * Check dependency status.
     * @return {boolean} true if no dependencies are present
     */
    ScriptData.prototype.hasNoDependencies = function hasNoDependencies() {
        return this.dependencies.length === 0;
    };

    /**
     * Create StyleData entry.
     * @param {string} styleUrl url of style
     * @param {string} [name] name of style (only for debugging)
     * @class
     */
    function StyleData(styleUrl, name) {
        this.name = this.name = (typeof name === 'string' ? name : 'unnamed' + (_unnamedCounter++));
        this.url = styleUrl;
    }

    /**
     * Create and parse Simplifier Loader environment settings.
     * @class
     * @alias SimplifierBootstrap.LoaderSettings
     */
    function LoaderSettings() {

        /**
         * Name of the App in which the Simplifier Context is executed.
         * @type {string}
         * @readonly
         */
        this.appName = "UnspecifiedApp";

        /**
         * Flag, if the app is currently executed in the Legacy client.
         * @type {boolean}
         * @readonly
         */
        this.legacyEnvironment = false;

        /**
         * Flag, if the app is currently executed in a Cordova client.
         * @type {boolean}
         * @readonly
         */
        this.cordovaEnvironment = false;

        /**
         * Flag, if the app is currently downloaded, and not access via the web (either the Legacy Client or the Cordova Offline Client)
         * @type {boolean}
         * @readonly
         */
        this.appDownloaded = false;

        /**
         * Flag, if the app is currently executed as SAP hosted app.
         * @type {boolean}
         * @readonly
         */
        this.isSAPApp = false;

        /**
         * Flag, if the app is executed as self hosted (i.e. on Apache/NGINX/...)
         * @type {boolean}
         * @readonly
         */
        this.isSelfHostedApp = false;

        /**
         * Flag, if the app is currently executed as standalone app.
         * @type {boolean}
         * @readonly
         */
        this.isStandAlone = false;

        /**
         * Flag, if the app is currently executed as standalone app.
         * @type {boolean}
         * @readonly
         */
        this.isMobileAppWithoutOverTheAirUpdate = false;

        /**
         * Flag, if the app is currently executed by the launchpad.
         * @type {boolean}
         * @readonly
         */
        this.isLaunchpad = false;

        /**
         * Base URL for the Simplifier API, pointing to the root of the appServer (e.g. "https://cloud.simplifier.io/").
         * @type {string}
         * @readonly
         */
        this.apiBaseUrl = '';

        /**
         * Base URL for the Simplifier WebSockets, pointing to the root of the appServer (e.g. "wss://cloud.simplifier.io/").
         * @type {string}
         * @readonly
         */
        this.webSocketBaseUrl = '';

        /**
         * Base URL for the Managed Libraries (e.g. "https://cloud.simplifier.io/library-managed").
         * @type {string}
         * @readonly
         */
        this.libBaseUrl = './';

        /**
         * Base URL for the System Libraries (e.g. "https://cloud.simplifier.io/system-library").
         * @type {string}
         * @readonly
         */
        this.systemLibBaseUrl = './';

        /**
         * Base URL for the Moduels (e.g. "https://cloud.simplifier.io/appDirect").
         * @type {string}
         * @readonly
         */
        this.moduleBaseUrl = 'appDirect/';

        /**
         * Base URL of the Cordova Context (is null, if not on Cordova Client).
         * @type {null|string}
         * @readonly
         */
        this.cordovaBaseUrl = null;

        /**
         * Fixed Simplifier Token, injected from Client. On Web, the token is walways null.
         * @type {null|string}
         * @readonly
         */
        this.simplifierToken = null;

        /**
         * Fixed Username, injected from Client. On Web, the username is walways null.
         * @type {null|string}
         * @readonly
         */
        this.username = null;

        /**
         * Flag, if the app allows anonymous App Login.
         * Should be initialized during App Bootstrapping via {@link SimplifierBootstrap.LoaderSettings#enableAnonymousLogin}
         * @type {boolean}
         * @readonly
         */
        this.anonymousAccessEnabled = false;

        /**
         * Shared secret for anonymous App Login. If the app does not allow anonymous access, the value is null.
         * Should be initialized during App Bootstrapping via {@link SimplifierBootstrap.LoaderSettings#enableAnonymousLogin}
         * @type {null|string}
         * @readonly
         */
        this.anonymousAppSecret = null;

        /**
         * Unique, random fingerprint for assets, forcing a cache invalidation on each app deployment. null means no fingerprint is used.
         * @type {null|string}
         */
        this.assetFingerprint = null;

        /**
         * Object containing the remaining token lifetime of a logged in user and the related settings from the login shape
         * @type {object}
         */
        this.tokenLifetimeSettings = {};

        /**
         * Prefix for asset urls if the app is executed in launchpad
         * @type {string}
         */
        this.assetUrlPrefix = "";

        //
        // initialize according to detected runtime and package settings
        //
        var bIsCordovaOnlineClient = typeof window['cordova'] !== 'undefined';
        var oCordovaWindowConfig = this._getCordovaWindowConfig(); // JSON parse window.name
        var bIsCordovaOfflineClient = oCordovaWindowConfig && typeof oCordovaWindowConfig === 'object';
        var sBaseUrl = this._getExplicitBaseURL();

        if (bIsCordovaOnlineClient && sBaseUrl === null) {
            // Cordova Online-only client  (OTA Update)
            this._initFromCordova(oCordovaWindowConfig); // kann demnächst raus?

        } else if (bIsCordovaOfflineClient) {
            // Cordova (download/offline) client
            this._initFromCordovaOfflineClient(oCordovaWindowConfig);

        } else if (typeof window.LaunchpadSettings === 'object') {
            this._initAsLaunchpad(window.LaunchpadSettings);
            this.isLaunchpad = true;
        } else {
            switch (this._getAppDeploymentType()) {

                case "MobileStandalone":
                    // standalone mobile app (without OTA)
                    this._initAsMobileAppWithoutOverTheAirUpdate();
                    this.isStandAlone = true;
                    break;

                case "SAPNetweaver":
                case "SAPCloudPlatform":
                    // SAP hosted app
                    this._initAsHosted();
                    this.isSAPApp = true;
                    break;

                case "SelfHostedWebApp":
                    // self hosted app
                    this._initAsHosted();
                    this.isSelfHostedApp = true;
                    break;

                default:
                    // Web browser (appDirect)
                    this._initFromWeb();
                    break;
            }
        }
    }


    LoaderSettings.prototype._isCordovaClient = function() {
        return typeof window['cordova'] !== 'undefined';
    };


    LoaderSettings.prototype._getCordovaWindowConfig = function() {
        try {
            return JSON.parse(window.name);
        } catch (e) {
            return null;
        }
    };

    /**
     * Get the explicit configured base url
     * @returns {string | null} base URL for hosted and standalone apps or null
     * @private
     */
    LoaderSettings.prototype._getExplicitBaseURL = function() {
        return _readHtmlAttribute("baseurl", null);
    };

    /**
     * Get runtime identifier, chosen for app deployment
     * @returns {string}
     * @private
     */
    LoaderSettings.prototype._getAppDeploymentType = function() {
        return _readHtmlAttribute("appDeploymentType", "BrowserApp");
    };

    /**
     * Configure App Name.
     * @param {string} appName the app name
     */
    LoaderSettings.prototype.setAppName = function(appName) {
        this.appName = appName;
    };

    /**
     * Enable anonymous login.
     * @param {string} appSecret app secret for anonymous login
     */
    LoaderSettings.prototype.enableAnonymousLogin = function(appSecret) {
        this.anonymousAccessEnabled = true;
        this.anonymousAppSecret = _readHtmlAttribute("anonymousLoginSecret", appSecret);
    };

    /**
     * Enable fingerprinting of cachable assets, in order to improve runtime
     * @param {string} fingerprint fingerprint hash (hexadecimal)
     */
    LoaderSettings.prototype.enableAssetFingerprinting = function(fingerprint) {
        if (!this.cordovaEnvironment && !this.isSelfHostedApp && !this.isSAPApp && !this.isStandAlone) {
            this.assetFingerprint = fingerprint;
        }
    };

    LoaderSettings.prototype.getModulePath = function(sModuleName) {
        if (this.legacyEnvironment) { // legacy
            throw 'legacy client is not compatible with modules'
        }

        if (this.assetFingerprint) { // webApp
            return this.apiBaseUrl + this.moduleBaseUrl + sModuleName + '/cached-assets-' + this.assetFingerprint;
        }

        return this.moduleBaseUrl + sModuleName;
    };

    /**
     * Initialize from Android Legacy Client.
     * @private
     */
    LoaderSettings.prototype._initFromLegacyClient = function() {
        this.legacyEnvironment = true;
        this.appDownloaded = true;
        this.libBaseUrl = './library-managed';
        this.systemLibBaseUrl = './system-library';
        this.simplifierToken = "";
        this.username = Settings.getUsername; // Legacy API
    };

    /**
     * Initialize from Web Browser (appDirect).
     * @private
     */
    LoaderSettings.prototype._initFromWeb = function() {
        var origin = _getOrigin(window.location.href);
        this.apiBaseUrl = origin + '/';
        this.webSocketBaseUrl = _deriveWebSocketUrl(origin) + '/';
        this.libBaseUrl = origin + '/library-managed';
        this.systemLibBaseUrl = origin + '/system-library';
    };

    /**
     * Initialize as SAP hosted app.
     * @private
     */
    LoaderSettings.prototype._initAsHosted = function() {
        var origin = this._getExplicitBaseURL();
        this.apiBaseUrl = origin + '/';
        this.webSocketBaseUrl = _deriveWebSocketUrl(origin) + '/';
        this.libBaseUrl = origin + '/library-managed';
        this.systemLibBaseUrl = origin + '/system-library';
        this.moduleBaseUrl = origin + '/appDirect/';
    };

    /**
     * Initialize as standalone app.
     * @private
     */
    LoaderSettings.prototype._initAsMobileAppWithoutOverTheAirUpdate = function() {
        this.isMobileAppWithoutOverTheAirUpdate = true;
        var origin = this._getExplicitBaseURL();
        this.apiBaseUrl = origin + '/';
        this.webSocketBaseUrl = _deriveWebSocketUrl(origin) + '/';
        this.libBaseUrl = './library-managed';
        this.systemLibBaseUrl = './system-library';
    };

    /**
     * Initialize from (non-offline) cordova client.
     * @private
     */
    LoaderSettings.prototype._initFromCordova = function(oCordovaWindowConfig) {
        this.cordovaEnvironment = true;
        this.appDownloaded = false;
        this.simplifierToken = oCordovaWindowConfig.simplifierToken;
        this.username = oCordovaWindowConfig.user;
        var origin = _getOrigin(oCordovaWindowConfig.server);
        this.apiBaseUrl = origin + '/';
        this.webSocketBaseUrl = _deriveWebSocketUrl(origin) + '/';
        this.libBaseUrl = origin + '/library-managed';
        this.systemLibBaseUrl = origin + '/system-library';
        this.moduleBaseUrl = origin + '/appDirect/';
    };

    /**
     * Initialize from cordova offline client.
     * @param {object} cordovaWindowConfig Cordova configuration object
     * @private
     */
    LoaderSettings.prototype._initFromCordovaOfflineClient = function(cordovaWindowConfig) {
        this.cordovaEnvironment = true;
        this.appDownloaded = true;
        this.simplifierToken = cordovaWindowConfig['simplifierToken'];
        this.cordovaBaseUrl = cordovaWindowConfig['cordova'];
        this.username = cordovaWindowConfig['user'];
        var origin = _getOrigin(cordovaWindowConfig['server']);
        this.apiBaseUrl = origin + '/';
        this.webSocketBaseUrl = _deriveWebSocketUrl(origin) + '/';
        this.libBaseUrl = "../../managed-libraries";
        this.systemLibBaseUrl = '../../system-libraries';
        this.moduleBaseUrl = '../../modules/';
    };

    /**
     * Initialize from launchpad settings.
     * @param oLaunchpadSettings settings object of launchpad
     * @private
     */
    LoaderSettings.prototype._initAsLaunchpad = function (oLaunchpadSettings) {
        var sOrigin = _getOrigin(window.location.href);
        this.appName = oLaunchpadSettings.appName;
        this.apiBaseUrl = sOrigin + '/';
        this.webSocketBaseUrl = _deriveWebSocketUrl(sOrigin) + '/';
        this.libBaseUrl = sOrigin + '/library-managed';
        this.systemLibBaseUrl = sOrigin + '/system-library';
        this.assetUrlPrefix = sOrigin + '/appDirect/' + oLaunchpadSettings.appName + '/';
        this.simplifierToken = oLaunchpadSettings.simplifierToken;
        this.username = oLaunchpadSettings.username;
    };

    /**
     * Get URL prefix for cached Assets.
     * @return {string} either cache URL if fingerprint is set, or './' otherwise
     */
    LoaderSettings.prototype.getAssetCacheUrl = function() {
        if (this.assetFingerprint) {
            return this.assetUrlPrefix + 'cached-assets-' + this.assetFingerprint + '/';
        } else if (this.assetUrlPrefix) {
            return this.assetUrlPrefix;
        } else {
            return './';
        }
    };

    /**
     * Simplifier Loader.
     * @class
     * @alias SimplifierBootstrap.Loader
     */
    function Loader() {
        this.settings = new LoaderSettings();
        this.libraryRoot = this.settings.libBaseUrl;
        this.systemLibraryRoot = this.settings.systemLibBaseUrl;
        this._styles = [];
        this._scripts = [];
        this._beforeInitHandlers = [];
        this._afterInitHandlers = [];
        this._provided = [];
        this._verbose = false;
    }

    /**
     * Set verbose level for dependency loading.
     * @param {boolean} verbose true if debug messages should be displayed
     */
    Loader.prototype.setVerbose = function(verbose) {
        this._verbose = verbose;
    };

    /**
     * Log debug message.
     * @param {string} msg message
     * @private
     */
    Loader.prototype._log = function(msg) {
        if (this._verbose) {
            console.debug(msg);
        }
    };

    /**
     * Directly insert script into page.
     * @param {string} src script source url
     * @param {function} [onLoadedHandler] optional handler to execute when the script is loaded
     */
    Loader.prototype.insertScript = function insertScript(src, onLoadedHandler) {
        this._log("Inserting script: " + src);
        var head = document.getElementsByTagName("head")[0] || document.documentElement;
        var scriptTag = document.createElement('script');
        scriptTag.type = 'text/javascript';
        if (typeof onLoadedHandler === 'function') {
            var done = false;
            scriptTag.onload = scriptTag.onreadystatechange = function() {
                if (!done && (!this.readyState || this.readyState === "loaded" || this.readyState === "complete")) {
                    done = true;
                    onLoadedHandler.apply(undefined);

                    // Handle memory leak in IE
                    scriptTag.onload = scriptTag.onreadystatechange = null;
                    if (head && scriptTag.parentNode && scriptTag.id !== "sap-ui-bootstrap") {
                        head.removeChild(scriptTag);
                    }
                }
            };
        }
        scriptTag.src = src;
        if (src.indexOf("sap-ui-core") !== -1) {
            scriptTag.id = "sap-ui-bootstrap";
        }
        // Use insertBefore instead of appendChild  to circumvent an IE6 bug.
        // This arises when a base node is used.
        head.insertBefore(scriptTag, head.firstChild);
    };

    /**
     * Directly insert style into page.
     * @param {string} src style source url
     */
    Loader.prototype.insertStyle = function insertStyle(src) {
        this._log("Inserting style: " + src);
        var linkTag = document.createElement('link');
        linkTag.rel = 'stylesheet';
        linkTag.href = src;
        document.getElementsByTagName("head")[0].appendChild(linkTag);
    };

    /**
     * Add style to list for deferred loading.
     * @param {string} styleUrl url of stylesheet
     * @param {string} [name] optional name for style (for debugging only)
     */
    Loader.prototype.addStyle = function addStyle(styleUrl, name) {
        this._log("Adding style: " + styleUrl);
        this._styles.push(new StyleData(styleUrl, name));
    };

    /**
     * Add style to list for deferred loading. The resource is loaded relative to the fingerprinted cached asset url.
     * @param {string} styleUrl url of stylesheet
     * @param {string} [name] optional name for style (for debugging only)
     */
    Loader.prototype.addCachedStyle = function addStyle(styleUrl, name) {
        var cachedUrl = this.settings.getAssetCacheUrl() + styleUrl;
        this._log("Adding style: " + cachedUrl);
        this._styles.push(new StyleData(cachedUrl, name));
    };

    /**
     * Add style of library to list for deferred loading.
     * @param {string} relativeStyleUrl url of stylesheet, relative to library root
     * @param {string} [name] optional name for style (for debugging only)
     */
    Loader.prototype.addLibraryStyle = function addLibraryStyle(relativeStyleUrl, name) {
        var styleUrl = this.libraryRoot + _relativize(relativeStyleUrl);
        this._log("Adding library style '" + relativeStyleUrl + "' at url: " + styleUrl);
        this._styles.push(new StyleData(styleUrl, name));
    };

    /**
     * Add script to list for deferred loading.
     * @param {string} scriptUrl url of script
     * @param {string} name script name (for references in dependencies, defaults to 'unnamed${counter}')
     * @param {Array<string>} [dependencies] names of scripts fo dependencies
     */
    Loader.prototype.addScript = function addLib(scriptUrl, name, dependencies) {
        var deps = dependencies;
        if (typeof dependencies === 'string' && arguments.length > 3) {
            // varargs
            deps = Array.prototype.slice.call(arguments, 2);
        }
        this._log("Adding script '" + scriptUrl + "' for name '" + name + "' with dependencies: [" + (deps ? deps : '') + "]");
        this._scripts.push(new ScriptData(scriptUrl, name, deps));
    };

    /**
     * Add script to list for deferred loading. The resource is loaded relative to the fingerprinted cached asset url.
     * @param {string} scriptUrl url of script
     * @param {string} name script name (for references in dependencies, defaults to 'unnamed${counter}')
     * @param {Array<string>} [dependencies] names of scripts fo dependencies
     */
    Loader.prototype.addCachedScript = function addLib(scriptUrl, name, dependencies) {
        var cachedUrl = this.settings.getAssetCacheUrl() + scriptUrl;
        var deps = dependencies;
        if (typeof dependencies === 'string' && arguments.length > 3) {
            // varargs
            deps = Array.prototype.slice.call(arguments, 2);
        }
        this._log("Adding script '" + cachedUrl + "' for name '" + name + "' with dependencies: [" + (deps ? deps : '') + "]");
        this._scripts.push(new ScriptData(cachedUrl, name, deps));
    };

    /**
     * Add script of library to list for deferred loading.
     * @param {string} relativeScriptUrl url of script, relative to library root
     * @param {string} name script name (for references in dependencies, defaults to 'unnamed${counter}')
     * @param {Array<string>} [dependencies] names of scripts fo dependencies
     */
    Loader.prototype.addLibraryScript = function addLibraryScript(relativeScriptUrl, name, dependencies) {
        var deps = dependencies;
        if (typeof dependencies === 'string' && arguments.length > 3) {
            // varargs
            deps = Array.prototype.slice.call(arguments, 2);
        }
        this._log("Adding library script '" + relativeScriptUrl + "' for name '" + name + "' with dependencies: [" + (deps ? deps : '') + "]");
        this._scripts.push(new ScriptData(relativeScriptUrl, name, deps));
    };

    /**
     * Add handle to be executed immediately before deferred loading is processed.
     * @param {function} handler handler function
     */
    Loader.prototype.addBeforeInitHandler = function addBeforeInitHandler(handler) {
        if (typeof handler === 'function') {
            this._log("Adding before-init handler");
            this._beforeInitHandlers.push(handler);
        } else {
            this._log("Given before-init handler was not a function: " + handler);
        }
    };

    /**
     * Add handle to be executed after all libraries have been loaded.
     * @param {function} handler handler function
     */
    Loader.prototype.addAfterInitHandler = function addAfterInitHandler(handler) {
        if (typeof handler === 'function') {
            this._log("Adding after-init handler");
            this._afterInitHandlers.push(handler);
        } else {
            this._log("Given after-init handler was not a function: " + handler);
        }
    };

    /**
     * Register dependency as already provided (e.g. if the script loaded identified the script as already loaded).
     * @param {string} name name to provide
     */
    Loader.prototype.provideScript = function(name) {
        this._log("Provide name: " + name);
        this._provided.push(name);
    };

    /**
     * Bootstrap Simplifier Loader, by first loading environment dependencies (cordova), and then processing
     * the required dependencies.
     * @param {function} onFinishedHandler optional handler function to be executed, when the loading has completed
     */
    Loader.prototype.processLoading = function processLoading(onFinishedHandler) {
        this._log("Process bootstrapping of environment dependencies ...");
        if (this.settings.cordovaEnvironment && this.settings.appDownloaded) {
            // Bootstrap cordova
            this._log("Process Cordova environment ...");
            var cordovaLib = this.settings.cordovaBaseUrl + "www/cordova.js";
            window.document.addEventListener('deviceready', this.processLoadingAfterBootstrap.bind(this, onFinishedHandler), false);
            this.insertScript(cordovaLib);
        }   else if (this.settings.isMobileAppWithoutOverTheAirUpdate) {
            window.document.addEventListener('deviceready', this.processLoadingAfterBootstrap.bind(this, onFinishedHandler), false);
        } else {
            // Process libs directly
            this.processLoadingAfterBootstrap(onFinishedHandler);
        }
    };

    /**
     * Run dependency-aware loading of all deferred sty<les and scripts.
     * @param {function} onFinishedHandler optional handler function to be executed, when the loading has completed
     */
    Loader.prototype.processLoadingAfterBootstrap = function processLoading(onFinishedHandler) {
        this._log("Process loading of library dependencies ...");
        var i;

        this._log("Process before-init handlers ...");
        for(i = 0; i < this._beforeInitHandlers.length; i++) {
            this._beforeInitHandlers[i].apply();
        }

        var finalizeProcessing = function finalizeProcessing() {
            this._log("Process after-init handlers ...");
            for(var i = 0; i < this._afterInitHandlers.length; i++) {
                this._afterInitHandlers[i].apply();
            }
            this._styles = [];
            this._scripts = [];
            this._beforeInitHandlers = [];
            this._afterInitHandlers = [];
            this._provided = [];
            if (typeof onFinishedHandler === 'function') {
                this._log("Scheduling on-finished handler ...");
                window.setTimeout(onFinishedHandler, 0);
            }
            this._log("Module loading finished");
        }.bind(this);

        this._log("Process styles ...");
        var stylesToLoad = this._styles;
        for(i = 0; i < stylesToLoad.length; i++) {
            var style = stylesToLoad[i];
            this.insertStyle(style.url);
        }

        var scriptsWithoutDeps = [];
        var scriptsWithDeps = [];
        var scriptsPending = [];
        var scriptsFinished = [];

        var loadNextScripts;
        var createScriptLoadCallback = function(loadingScript) {
            return function scriptLoadedCallback() {
                var scriptWithDepsToKeep = [];
                for (var i = 0; i < scriptsWithDeps.length; i++) {
                    var script = scriptsWithDeps[i];
                    script.removeDependency(loadingScript.name);
                    if (script.hasNoDependencies()) {
                        scriptsWithoutDeps.push(script);
                    } else {
                        scriptWithDepsToKeep.push(script);
                    }
                }
                scriptsWithDeps = scriptWithDepsToKeep;
                for (i = 0; i < scriptsPending.length; i++) {
                    script = scriptsPending[i];
                    if (script.name === loadingScript.name) {
                        scriptsPending.splice(i, 1);
                        break;
                    }
                }
                this._log("Finished script " + loadingScript.name);
                scriptsFinished.push(loadingScript);
                loadNextScripts();
            }.bind(this);
        }.bind(this);

        loadNextScripts = function loadNextScripts() {
            var i, script;
            for (i = 0; i < scriptsWithoutDeps.length; i++) {
                script = scriptsWithoutDeps[i];
                this.insertScript(script.url, createScriptLoadCallback(script));
                this._log("Load script " + script.name);
                scriptsPending.push(script);
            }
            scriptsWithoutDeps = [];
            if (scriptsPending.length === 0) {
                // No more scripts in process
                if (scriptsWithDeps.length !== 0) {
                    console.error("Could not load all required scripts due to circular dependencies."
                        + "The following scripts failed to load:");
                    for (i = 0; i < scriptsWithDeps.length; i++) {
                        script = scriptsWithDeps[i];
                        console.error("Script '" + script.name + "' at url '" + script.url
                            + "', having dependencies: " + script.dependencies)
                    }
                } else {
                    finalizeProcessing();
                }
            }
        }.bind(this);

        for (i = 0; i < this._scripts.length; i++) {
            var script = this._scripts[i];
            for (var j = 0; j < this._provided.length; j++) {
                var providedName = this._provided[j];
                script.removeDependency(providedName);
            }
            if (script.hasNoDependencies()) {
                scriptsWithoutDeps.push(script);
            } else {
                scriptsWithDeps.push(script);
            }
        }

        this._log("Process scripts ...");
        loadNextScripts();
    };

    /**
     * Abstract function to introduce Managed- or System-Library specific scope for adding scripts, styles and attaching handlers.
     * @param {string} libraryPath relative path of the library (not ending in slash)
     * @param {function} includeHandler include function to be called with the curried addX functions
     * @param {boolean} bIsSystemLib flag to distinguish managed libs from system libs
     */
    Loader.prototype.includeLib = function(libraryPath, includeHandler, bIsSystemLib) {
        var addScript = function(relativeUrl, name, dependencies) {
            var relativeLibUrl = libraryPath + _relativize(relativeUrl);
            var scriptUrl = (bIsSystemLib ? this.systemLibraryRoot : this.libraryRoot) + _relativize(relativeLibUrl);
            var delegateArgs = [scriptUrl].concat(Array.prototype.slice.call(arguments, 1));
            this.addLibraryScript.apply(this, delegateArgs);
        }.bind(this);
        var addStyle = function(relativeUrl, name) {
            var relativeLibUrl = libraryPath + _relativize(relativeUrl);
            var delegateArgs = [relativeLibUrl].concat(Array.prototype.slice.call(arguments, 1));
            this.addLibraryStyle.apply(this, delegateArgs);
        }.bind(this);
        var addBeforeInitHandler = this.addBeforeInitHandler.bind(this);
        var addAfterInitHandler = this.addAfterInitHandler.bind(this);
        includeHandler(addScript, addStyle, addBeforeInitHandler, addAfterInitHandler, libraryPath);
    };

    /**
     * Introduce System-Library specific scope to add scripts, styles and attach handlers.
     * @param {string} libraryPath relative path of the library (not ending in slash)
     * @param {function} includeHandler include function to be called with the curried addX functions
     */
    Loader.prototype.includeSystemLib = function (libraryPath, includeHandler) {
        this.includeLib(libraryPath, includeHandler, true);
    };

    /**
     * Introduce Manage-Library specific scope to add scripts, styles and attach handlers.
     * @param {string} libraryPath relative path of the library (not ending in slash)
     * @param {function} includeHandler include function to be called with the curried addX functions
     */
    Loader.prototype.includeManagedLib = function(libraryPath, includeHandler) {
        this.includeLib(libraryPath, includeHandler, false);
    };

    /**
     * Reset state of loader
     */
    Loader.prototype.unload = function() {
        this._styles = [];
        this._scripts = [];
        this._beforeInitHandlers = [];
        this._afterInitHandlers = [];
        this._provided = [];
    };

    /**
     * Display a global error message indicating an error occurred during application startup.
     * @param {string} msg message to display
     * @param {string} url source URL
     * @param {number|string} lineNo line number of error
     * @param {number|string} colNo column number of error
     * @param {object} error error object
     */
    Loader.prototype.showInitErrorPage = function showInitErrorPage(msg, url, lineNo, colNo, error) {
        document.body.style.cssText = "background-color:#DDDDDD";
        var errorStack = '';
        if (typeof error === 'object' && typeof error.stack === 'string') {
            var stack = '';
            for (var i=0; i < error.stack.length; i++) {
                var char = error.stack[i];
                if (char === '>') stack += '&gt;';
                else if (char === '<') stack += '&lt;';
                else stack += char;
            }
            errorStack = '<tr><td style="font-weight:bold;vertical-align:text-top;text-align:right">Stack:</td>'
                + '<td><pre style="margin:0">'
                + stack + '</pre></td></tr>';
        }
        document.body.innerHTML =
            '<div style="height:90%;width:90%;margin:10% auto auto auto;'
            + '          overflow:auto;background-color:white;border: #BB0000 solid 3px;'
            + '          box-shadow:0 0 20px #888888;padding:20px;font-family:sans-serif">'
            + '<h1 style="color:#BB0000;text-align:center">Error in App Initialization</h1>'
            + '<table style="margin:20px auto auto auto;font-size:14px;border-spacing:10px">'
            + '<tr><td style="font-weight:bold;vertical-align:text-top;text-align:right">Message:</td>'
            + '<td>' + msg + '</td></tr>'
            + '<tr><td style="font-weight:bold;vertical-align:text-top;text-align:right">Source:</td>'
            + '<td>' + url + '</td></tr>'
            + '<tr><td style="font-weight:bold;text-align:right">Line:</td><td>' + lineNo + '</td>'
            + '<tr><td style="font-weight:bold;text-align:right">Column:</td><td>' + colNo + '</td></tr>'
            + errorStack
            + '</table>'
            + '</div>';
    };

    if (!window.SimplifierBootstrap) {
        /**
         * @namespace SimplifierBootstrap
         */
        window.SimplifierBootstrap = {
            Loader: Loader,
            LoaderSettings: LoaderSettings
        };

        /**
         * Global Simplifier Loader.
         * @constant
         * @global
         * @type {SimplifierBootstrap.Loader}
         */
        window.SimplifierLoader = new Loader();

        /**
         * Global Simplifier Loader Settings.
         * @constant
         * @global
         * @type {SimplifierBootstrap.LoaderSettings}
         */
        window.SimplifierSettings = window.SimplifierLoader.settings;

        // Fire event 'onSimplifierLoaderReady' to signal the loader is available now
        var event = document.createEvent("CustomEvent");
        event.initCustomEvent("onSimplifierLoaderReady", false, false, undefined);
        document.dispatchEvent(event);
    }  


})();