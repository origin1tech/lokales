"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var path_1 = require("path");
var fs_1 = require("fs");
var util_1 = require("util");
var mkdir = require("make-dir");
var DEFAULTS = {
    directory: './locales',
    locale: 'en',
    localeFallback: 'en',
    update: true,
    onUpdate: undefined,
    onError: undefined // called on write queue error.
};
var instance = null; // ensure singleton.
var Lokales = /** @class */ (function () {
    function Lokales(options) {
        this._exiting = false;
        this.cache = {};
        this.queue = [];
        if (instance)
            return instance;
        this.options = this.extend({}, DEFAULTS, options);
        var optKeys = Object.keys(this.options);
        if (~optKeys.indexOf('backup'))
            console.error('DEPRECATED: Lokales property "backup" has been deprecated, graceful exit now handled.');
        process.on('exit', this.onExit.bind(this, 'exit'));
        process.on('uncaughtException', this.onExit.bind(this, 'error'));
        instance = this;
    }
    // UTILS //
    /**
     * Exit handler ensures graceful exit writing any in queue.
     */
    Lokales.prototype.onExit = function (type, err) {
        // Remove event listeners.
        if (!this._exiting) {
            process.removeListener('exit', this.onExit);
            process.removeListener('uncaughtException', this.onExit);
        }
        // If queue length and not already in
        // exit loop call processQueue.
        if (this.queue.length && !this._exiting) {
            this._exiting = true;
            this.processQueue(type, err);
        }
        // Otherwise if an error was passed
        // throw it otherwise exit.
        else {
            if (type === 'error' && err)
                throw err;
        }
    };
    /**
     * Handles module errors.
     *
     * @param err the error to be handled.
     */
    Lokales.prototype.error = function (err, shouldThrow, noStack) {
        if (shouldThrow === void 0) { shouldThrow = true; }
        if (noStack === void 0) { noStack = false; }
        var errorHandler = this.options.onError;
        if (!(err instanceof Error)) {
            var msg = err;
            err = new Error(err);
            err.message = msg;
        }
        if (errorHandler) {
            errorHandler(err);
        }
        else {
            var error = noStack ? err.message : err;
            if (shouldThrow)
                throw error;
            console.error(error);
        }
    };
    /**
     * Is Value ensures the provided argument is not undefined, NaN, Infinity etc.
     *
     * @param val the value to inspect.
     */
    Lokales.prototype.isValue = function (val) {
        return ((typeof val !== 'undefined') &&
            (val !== null));
    };
    /**
     * Is Plain Object checks if is plain object.
     *
     * @param val the value to inspect.
     */
    Lokales.prototype.isPlainObject = function (val) {
        return val && val.constructor && val.constructor === {}.constructor;
    };
    /**
     * Minimalistc extend just suits purpose here.
     *
     * @param dest the destination object.
     * @param src the source object.
     */
    Lokales.prototype.extend = function (dest) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        return Object.assign.apply(Object, [dest].concat(args));
    };
    // FILE SYSTEM //
    /**
     * Resolve Locale resolves the locale or fallback path.
     *
     * @param locale the locale to be resovled.
     * @param directory the directory where locales are stored.
     */
    Lokales.prototype.resolveFile = function (locale, directory, fallback) {
        fallback = fallback || this.options.localeFallback;
        var path = path_1.resolve(directory, locale + ".json");
        var parsed = path_1.parse(path);
        mkdir.sync(parsed.dir); // ensure the directory exists.
        if (fallback && !fs_1.existsSync(path))
            path = path_1.resolve(directory, fallback + ".json");
        return path;
    };
    /**
     * Resolve the path for a locale file.
     *
     * @param locale the locale to use for resolving path.
     * @param directory an optional directory for resolving locale file.
     */
    Lokales.prototype.resolvePath = function (locale, directory) {
        directory = directory || this.options.directory;
        locale = locale || this.options.locale;
        return this.resolveFile(locale, directory);
    };
    /**
     * Reads the locale file.
     *
     * @param locale the active locale.
     * @param directory the directory for locales.
     */
    Lokales.prototype.readLocale = function (locale, directory, ignoreErrors) {
        var path = this.resolvePath(locale, directory);
        this.path = path;
        var obj = {};
        try {
            var str = fs_1.readFileSync(path, 'utf-8');
            if (!str)
                return obj;
            obj = JSON.parse(str);
        }
        catch (ex) {
            if (!ignoreErrors) {
                if ((ex instanceof SyntaxError)) {
                    ex.message = "locale " + locale + " contains invalid syntax, ensure valid JSON.";
                    this.error(ex);
                }
                obj = {}; // ensure object file may not exist yet.
                if (ex && !(ex && ex.code === 'ENOENT')) // if missing ignore otherwise throw.
                    this.error(ex);
            }
            else {
                console.error("Failed to sync locale >> " + ex.message + ".");
            }
        }
        return obj;
    };
    // QUEUE //
    /**
     * Adds event to write queue.
     *
     * @param state the current state of options object.
     */
    Lokales.prototype.writeQueue = function (updated) {
        this.queue.push(updated);
        if (this.queue.length === 1)
            this.processQueue();
    };
    /**
     * Process queued jobs saving to file.
     */
    Lokales.prototype.processQueue = function (type, err) {
        var _this = this;
        if (!this.queue.length) {
            this._exiting = false;
            this.onExit(type, err);
            return;
        }
        var updated = this.queue[0];
        var opts = updated.options;
        var serialized = JSON.stringify(this.cache[opts.locale], null, 2);
        var path = this.resolveFile(opts.locale, opts.directory, opts.localeFallback);
        if (!serialized)
            return;
        fs_1.writeFile(path, serialized, 'utf-8', function (err) {
            if (err)
                _this.error(err, false, true); // don't exit continue queue but log error.
            if (opts.onUpdate) {
                opts.onUpdate(err, updated, _this);
            }
            _this.queue.shift();
            if (_this.queue.length > 0)
                _this.processQueue();
        });
    };
    /**
     * Template Literal allows for localizing __`some localized string ${value}`;
     *
     * @param strings array of template literal strings.
     * @param values template literal args.
     */
    Lokales.prototype.templateLiteral = function (strings, values) {
        var str = '';
        strings.forEach(function (el, i) {
            var arg = values[i];
            str += el;
            if (typeof arg !== 'undefined') {
                str += '%s';
            }
        });
        return this.__.apply(this, [str].concat(values));
    };
    Object.defineProperty(Lokales.prototype, "t", {
        // GETTERS //
        get: function () {
            return this.__;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Lokales.prototype, "tn", {
        get: function () {
            return this.__n;
        },
        enumerable: true,
        configurable: true
    });
    // LOCALIZATION //
    /**
     * Localize common method for localizing strings.
     *
     * @param singular singular string value.
     * @param plural plural string value or count.
     * @param count numeric count for pluralization.
     * @param args format args.
     */
    Lokales.prototype.localize = function (singular, plural, count) {
        var args = [];
        for (var _i = 3; _i < arguments.length; _i++) {
            args[_i - 3] = arguments[_i];
        }
        var cache = this.cache;
        var locale = this.options.locale;
        var isPlural = count > 1 ? true : false;
        var supportsPlural = this.isValue(plural);
        var shouldQueue;
        if (!cache[locale]) { // ensure loaded locale.
            cache[locale] = this.readLocale();
        }
        var existing = cache[locale][singular]; // value already exists.
        if (!existing && this.options.update) {
            if (!supportsPlural) { // singular localization.
                cache[locale][singular] = singular;
            }
            else {
                cache[locale][singular] = {
                    one: singular,
                    other: plural
                };
            }
            shouldQueue = true;
        }
        if (existing && supportsPlural && // ensure key is object.
            this.options.update &&
            !this.isPlainObject(cache[locale][singular])) {
            cache[locale][singular] = {
                one: singular,
                other: plural
            };
            shouldQueue = true;
        }
        var val = cache[locale][singular]; // default singular value.
        if (supportsPlural) { // supports plural
            if (isPlural)
                val = cache[locale][singular].other; // get plural value.
            else
                val = cache[locale][singular].one; // get singular.
        }
        if (shouldQueue) // add write to queue to reflect changes.
            this.writeQueue({
                singular: singular,
                plural: plural,
                count: count,
                args: args,
                options: this.options
            });
        if (~val.indexOf('%d'))
            args.push(count);
        return util_1.format.apply(void 0, [val].concat(args));
    };
    // API METHODS //
    /**
     * Set an option or extends current options.
     *
     * @param key the key or options object to set.
     * @param val the value to set when key is not an object.
     */
    Lokales.prototype.setOption = function (key, val) {
        var isObj = this.isPlainObject(key);
        var obj = key;
        if (!isObj && !this.isValue(val))
            return;
        if (!isObj) {
            obj = {};
            obj[key] = val;
        }
        this.extend(this.options, obj);
        return this;
    };
    /**
     * Get an option value by key.
     *
     * @param key the option key to get.
     */
    Lokales.prototype.getOption = function (key) {
        return this.options[key] || null;
    };
    /**
     * Key Exists inspects cached checking if key already exists.
     *
     * @param key the key to check if exists.
     * @param locale the locale to inspect for key.
     * @param directory optional directory.
     */
    Lokales.prototype.keyExists = function (key, locale, directory) {
        locale = locale || this.options.locale;
        if (!this.cache[locale]) // ensure loaded locale.
            this.cache[locale] = this.readLocale(locale, directory);
        return this.cache[locale][key];
    };
    /**
     * Sync ensures secondary locales contain same keys of primary from.
     *
     * @param from the locale to sync from default "en".
     */
    Lokales.prototype.sync = function (from) {
        var _this = this;
        if (from === void 0) { from = 'en'; }
        from = from.replace(/\.json$/, '.json').toLowerCase();
        var stats = fs_1.statSync(this.options.directory);
        var files = fs_1.readdirSync(this.options.directory, 'utf-8');
        var fromLocale = this.readLocale(from);
        var ctr = 0;
        files.forEach(function (f, i) {
            var filename = f.toString().toLowerCase();
            var locale = path_1.basename(filename).replace(/\.json$/, '');
            if (locale !== from) {
                // Load the current found locale.
                var currLocale = _this.readLocale(locale, null, true);
                for (var k in fromLocale) {
                    if (!currLocale[k])
                        currLocale[k] = fromLocale[k];
                }
                // Write the file.
                fs_1.writeFileSync(path_1.resolve(_this.options.directory, locale + ".json"), JSON.stringify(currLocale, null, 2));
                console.error("Synchronized locales: " + from + " >> " + locale);
            }
        });
    };
    /**
     * Localize non plurals.
     *
     * @param val the value to localize.
     * @param args format arguments.
     */
    Lokales.prototype.__ = function (val) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        if (Array.isArray(val)) // is template literal.
            return this.templateLiteral(val, args);
        return this.localize.apply(this, [val, null, null].concat(args));
    };
    /**
     * Localize plurals.
     *
     * @param singular the singular localized value.
     * @param plural the pluralized valued.
     * @param count the count for the plural value.
     * @param args argument formatters.
     */
    Lokales.prototype.__n = function (singular, plural, count) {
        var args = [];
        for (var _i = 3; _i < arguments.length; _i++) {
            args[_i - 3] = arguments[_i];
        }
        return this.localize.apply(this, [singular, plural, count].concat(args));
    };
    return Lokales;
}());
exports.Lokales = Lokales;
//# sourceMappingURL=index.js.map