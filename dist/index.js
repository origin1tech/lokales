"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var path_1 = require("path");
var fs_1 = require("fs");
var util_1 = require("util");
var os_1 = require("os");
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
        this.cache = {};
        this.queue = [];
        if (instance)
            return instance;
        this.options = this.extend({}, DEFAULTS, options);
        var optKeys = Object.keys(this.options);
        if (~optKeys.indexOf('backup'))
            process.stderr.write('DEPRECATED: Lokales property "backup" has been deprecated, graceful exit now handled.\n');
        process.on('exit', this.onExit.bind(this, 'exit'));
        process.on('uncaughtException', this.onExit.bind(this, 'error'));
        instance = this;
    }
    // UTILS //
    /**
     * On Exit.
     * Ensures graceful exit writing any in queue.
     */
    Lokales.prototype.onExit = function (type, err) {
        var _this = this;
        // Loop until queue is empty.
        var checkQueue = function () {
            if (_this.queue.length)
                process.nextTick(checkQueue);
            if (type === 'error' && err)
                throw err;
        };
        checkQueue();
    };
    /**
     * Error
     * : Handles module errors.
     *
     * @param err the error to be handled.
     */
    Lokales.prototype.error = function (err) {
        var errorHandler = this.options.onError;
        if (!(err instanceof Error)) {
            err = new Error(err);
            var stack = (err.stack || '').split(os_1.EOL);
            var msg = stack.shift();
            if (msg && stack.length)
                err.stack = [msg].concat(stack.slice(1)).join(os_1.EOL);
        }
        if (errorHandler) {
            errorHandler(err);
        }
        else {
            process.stderr.write('\n');
            throw err;
        }
    };
    /**
     * Keys
     * : Gets keys for an object.
     *
     * @param obj the object to get keys for.
     */
    Lokales.prototype.keys = function (obj) {
        if (!this.isPlainObject(obj))
            return [];
        return Object.keys(obj);
    };
    /**
     * Is Value
     * : Ensures the provided argument is not undefined, NaN, Infinity etc.
     *
     * @param val the value to inspect.
     */
    Lokales.prototype.isValue = function (val) {
        return ((typeof val !== 'undefined') &&
            (val !== null));
    };
    /**
     * Is Plain Object
     * : Checks if is plain object.
     *
     * @param val the value to inspect.
     */
    Lokales.prototype.isPlainObject = function (val) {
        return val && val.constructor && val.constructor === {}.constructor;
    };
    /**
     * Is Number
     * : Checks if value is a number.
     *
     * @param val the value to be checked.
     */
    Lokales.prototype.isNumber = function (val) {
        return (typeof val === 'number' &&
            !isNaN(val));
    };
    /**
     * Extend
     * : Minimalistc extend just suits purpose here.
     *
     * @param dest the destination object.
     * @param src the source object.
     */
    Lokales.prototype.extend = function (dest) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        dest = dest || {};
        while (args.length) {
            var current = args.shift() || {};
            if (this.isPlainObject(current)) {
                for (var k in current) {
                    if (this.isValue(current[k]))
                        dest[k] = current[k];
                }
            }
        }
        return dest;
    };
    // FILE SYSTEM //
    /**
     * Path Exists
     * : Checks if a file or directory exists.
     *
     * @param path the path to inspect if exists.
     * @param fn a callback function on result.
     */
    Lokales.prototype.pathExists = function (path, isDir, fn) {
        if (typeof isDir === 'function') {
            fn = isDir;
            isDir = undefined;
        }
        try {
            if (!fn) {
                if (isDir)
                    return fs_1.statSync(path).isDirectory();
                return fs_1.statSync(path).isFile();
            }
            fs_1.stat(path, function (e, s) {
                if (e) {
                    if (!fn)
                        return false;
                    return fn(false);
                }
                if (isDir)
                    return s.isDirectory();
                return s.isFile();
            });
        }
        catch (ex) {
            if (!fn)
                return false;
            fn(false);
        }
    };
    /**
     * Resolve Path
     * : Resolves the path for a locale file.
     *
     * @param locale the locale to use for resolving path.
     * @param directory an optional directory for resolving locale file.
     */
    Lokales.prototype.resolvePath = function (locale, directory) {
        directory = directory || this.options.directory;
        locale = locale || this.options.locale;
        return this.resolveFile(directory, locale);
    };
    /**
     * Resolve Locale
     * : Resolves the locale or fallback path.
     *
     * @param directory the directory where locales are stored.
     * @param locale the locale to be resovled.
     */
    Lokales.prototype.resolveFile = function (directory, locale, fallback) {
        fallback = fallback || this.options.localeFallback;
        var path = path_1.resolve(directory, './', locale + ".json");
        if (fallback && !this.pathExists(path))
            path = path_1.resolve(directory, './', fallback + ".json");
        var parsed = path_1.parse(path);
        if (!this.pathExists(parsed.dir, true)) {
            this.error("failed to load locales path " + parsed.dir + ", ensure the directory exists.");
            return;
        }
        return path;
    };
    /**
     * Read Locale
     * : Reads the locale file.
     *
     * @param directory the directory for locales.
     * @param locale the active locale.
     */
    Lokales.prototype.readLocale = function (locale, directory) {
        var path = this.resolvePath(directory, locale);
        var obj = {};
        try {
            var str = fs_1.readFileSync(path, 'utf-8');
            // if (this.options.backup) {
            //   this._backupQueue.push([path, str]);
            //   // backup a copy of the locale.
            //   this.backup(path, str);
            // }
            obj = JSON.parse(str);
        }
        catch (ex) {
            if (ex instanceof SyntaxError) {
                ex.message = "locale " + locale + " contains invalid syntax, ensure valid JSON.";
                this.error(ex);
            }
            obj = {}; // ensure object file may not exist yet.
            if (ex && !(ex && ex.code === 'ENOENT'))
                this.error(ex);
        }
        return obj;
    };
    // QUEUE //
    /**
     * Write Queue
     * : Adds options state to write queue for processing.
     *
     * @param state the current state of options object.
     */
    Lokales.prototype.writeQueue = function (updated) {
        this.queue.push(updated);
        if (this.queue.length === 1)
            this.processQueue();
    };
    /**
     * Process Queue
     * : Processes queued jobs saving to file.
     */
    Lokales.prototype.processQueue = function () {
        var _this = this;
        if (!this.queue.length)
            return;
        var updated = this.queue[0];
        var opts = updated.options;
        var path = this.resolveFile(opts.directory, opts.locale, opts.localeFallback);
        var serialized = JSON.stringify(this.cache[opts.locale], null, 2);
        if (!serialized)
            return;
        fs_1.writeFile(path, serialized, 'utf-8', function (err) {
            if (err)
                _this.error(err); // don't exit continue queue but log error.
            if (opts.onUpdate) {
                opts.onUpdate(err, updated, _this);
            }
            _this.queue.shift();
            if (_this.queue.length > 0)
                _this.processQueue();
        });
    };
    /**
     * Template Literal
     * : Allows for localizing __`some localized string ${value}`;
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
     * Localize
     * : Common method for localizing strings.
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
        if (!cache[locale]) {
            cache[locale] = this.readLocale();
        }
        var existing = cache[locale][singular]; // value already exists.
        if (!existing && this.options.update) {
            if (!supportsPlural) {
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
        if (supportsPlural) {
            if (isPlural)
                val = cache[locale][singular].other; // get plural value.
            else
                val = cache[locale][singular].one; // get singular.
        }
        if (shouldQueue)
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
     * Set Option
     * : Sets an option or extends current options.
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
     * Get Option
     * : Gets an option value by key.
     *
     * @param key the option key to get.
     */
    Lokales.prototype.getOption = function (key) {
        return this.options[key] || null;
    };
    /**
     * Key Exists
     * : Inspects cached checking if key already exists.
     *
     * @param key the key to check if exists.
     * @param locale the locale to inspect for key.
     * @param directory optional directory.
     */
    Lokales.prototype.keyExists = function (key, locale, directory) {
        locale = locale || this.options.locale;
        if (!this.cache[locale])
            this.cache[locale] = this.readLocale(locale, directory);
        return this.cache[locale][key];
    };
    /**
     * Backup
     * : Creates backup copy of file.
     *
     * @param src the original source path to be backed up.
     */
    Lokales.prototype.backup = function (src, data) {
        src = src || this.resolvePath();
        if (this.isPlainObject(data))
            data = JSON.stringify(data);
        try {
            var parsed = path_1.parse(src);
            var dest = path_1.join(parsed.dir, parsed.name + '.bak' + parsed.ext);
            fs_1.writeFileSync(dest, data, 'utf-8');
        }
        catch (ex) {
            this._backedUp = false;
            this.error(ex);
        }
    };
    /**
     * Purge
     * : Purges any backup files in locales directory.
     */
    Lokales.prototype.purge = function () {
        var _this = this;
        var stats = fs_1.statSync(this.options.directory);
        var files = fs_1.readdirSync(this.options.directory, 'utf-8');
        var ctr = 0;
        files.forEach(function (f, i) {
            if (/bak\.json$/.test(f.toString())) {
                fs_1.unlinkSync(path_1.join(_this.options.directory, f.toString()));
                ctr++;
            }
        });
        process.stderr.write("\nLokales successfully purged " + ctr + " file(s).\n");
    };
    Lokales.prototype.__ = function (val) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        if (Array.isArray(val))
            return this.templateLiteral(val, args);
        return this.localize.apply(this, [val, null, null].concat(args));
    };
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