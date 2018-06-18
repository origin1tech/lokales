"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const fs_1 = require("fs");
const util_1 = require("util");
const mkdir = require("make-dir");
const DEFAULTS = {
    directory: './locales',
    locale: 'en',
    localeFallback: 'en',
    update: true,
    onUpdate: undefined,
    onError: undefined // called on write queue error.
};
class Lokales {
    constructor(options) {
        // private _cache: any;
        this._canExit = false;
        this._onQueueEmpty = () => { };
        this.cache = {};
        this.queue = [];
        this.options = this.extend({}, DEFAULTS, options);
        const optKeys = Object.keys(this.options);
        process.on('exit', this.onExit.bind(this, 'exit'));
        process.on('uncaughtException', this.onExit.bind(this, 'error'));
    }
    // UTILS //
    /**
     * Exit handler ensures graceful exit writing any in queue.
     */
    onExit(type, err) {
        if (this._canExit)
            return;
        this._canExit = true;
        // Remove event listeners.
        process.removeListener('exit', this.onExit);
        process.removeListener('uncaughtException', this.onExit);
        // If queue length and not already in
        // exit loop call processQueue.
        if (this.queue.length) {
            this._canExit = false;
            this.processQueue(type, err);
        }
        // Otherwise if an error was passed
        // throw it otherwise exit.
        if (this._canExit) {
            this._onQueueEmpty();
            if (type === 'error' && (err instanceof Error))
                this.error(err);
        }
    }
    /**
     * Handles module errors.
     *
     * @param err the error to be handled.
     */
    error(err) {
        const errorHandler = this.options.onError;
        if (errorHandler) {
            err = !(err instanceof Error) ? new Error(err) : err;
            errorHandler(err);
        }
        else {
            console.error(err);
        }
    }
    /**
     * Is Value ensures the provided argument is not undefined, NaN, Infinity etc.
     *
     * @param val the value to inspect.
     */
    isValue(val) {
        return ((typeof val !== 'undefined') &&
            (val !== null));
    }
    /**
     * Is Plain Object checks if is plain object.
     *
     * @param val the value to inspect.
     */
    isPlainObject(val) {
        return val && val.constructor && val.constructor === {}.constructor;
    }
    /**
     * Minimalistc extend just suits purpose here.
     *
     * @param dest the destination object.
     * @param src the source object.
     */
    extend(dest, ...args) {
        return Object.assign(dest, ...args);
    }
    // FILE SYSTEM //
    /**
     * Resolve Locale resolves the locale or fallback path.
     *
     * @param locale the locale to be resovled.
     * @param directory the directory where locales are stored.
     */
    resolveFile(locale, directory, fallback) {
        fallback = fallback || this.options.localeFallback;
        directory = directory || this.options.directory;
        let path = path_1.resolve(directory, `${locale}.json`);
        const parsed = path_1.parse(path);
        mkdir.sync(parsed.dir); // ensure the directory exists.
        if (fallback && !fs_1.existsSync(path))
            path = path_1.resolve(directory, `${fallback}.json`);
        return path;
    }
    /**
     * Resolve the path for a locale file.
     *
     * @param locale the locale to use for resolving path.
     * @param directory an optional directory for resolving locale file.
     */
    resolvePath(locale, directory) {
        directory = directory || this.options.directory;
        locale = locale || this.options.locale;
        return this.resolveFile(locale, directory);
    }
    // https://hangouts.google.com/hangouts/_/stackbuilders.com/dremachecarey?authuser=0
    /**
     * Reads the locale file.
     *
     * @param locale the active locale.
     * @param directory the directory for locales.
     * @param graceful mutes errors gracefully logs message.
     */
    readLocale(locale, directory, graceful) {
        const path = this.resolvePath(locale, directory);
        this.path = path;
        let obj = {};
        try {
            const str = fs_1.readFileSync(path, 'utf-8');
            if (!str)
                return obj;
            obj = JSON.parse(str);
        }
        catch (ex) {
            obj = {}; // ensure object.
            if (graceful) {
                this.error(ex.message);
            }
            else {
                // If bad format or no path ignore.
                // create empty object and or path
                // on next read. Otherwise throw err.
                if (ex && (!(ex instanceof SyntaxError) && ex.code !== 'ENOENT'))
                    this.error(ex);
            }
        }
        return obj;
    }
    // QUEUE //
    writeFile(path, data, updated, fn) {
        if (typeof updated === 'function') {
            fn = updated;
            updated = undefined;
        }
        if (!path || !data)
            return;
        fs_1.writeFile(path, data, 'utf-8', (err) => {
            if (this.options.onUpdate)
                this.options.onUpdate(err, updated, this);
            if (err)
                this.error(err.message);
            this.queue.shift();
            if (this.queue.length > 0)
                this.processQueue();
            // Call callback if exists.
            if (fn)
                fn();
        });
    }
    /**
     * Adds event to write queue.
     *
     * @param state the current state of options object.
     */
    writeQueue(updated) {
        this.queue.push(updated);
        if (this.queue.length === 1)
            this.processQueue();
    }
    /**
     * Process queued jobs saving to file.
     */
    processQueue(type, err) {
        if (!this.queue.length) {
            this._canExit = true;
            this.onExit(type, err);
            return;
        }
        const updated = this.queue[0];
        const opts = updated.options;
        const serialized = JSON.stringify(this.cache[opts.locale], null, 2);
        const path = this.resolveFile(opts.locale, opts.directory, opts.localeFallback);
        if (!serialized)
            return;
        this.writeFile(path, serialized, updated);
    }
    /**
     * Template Literal allows for localizing __`some localized string ${value}`;
     *
     * @param strings array of template literal strings.
     * @param values template literal args.
     */
    templateLiteral(strings, values) {
        let str = '';
        strings.forEach((el, i) => {
            const arg = values[i];
            str += el;
            if (typeof arg !== 'undefined') {
                str += '%s';
            }
        });
        return this.__(str, ...values);
    }
    // GETTERS //
    get t() {
        return this.__;
    }
    get tn() {
        return this.__n;
    }
    // LOCALIZATION //
    /**
     * Localize common method for localizing strings.
     *
     * @param singular singular string value.
     * @param plural plural string value or count.
     * @param count numeric count for pluralization.
     * @param args format args.
     */
    localize(singular, plural, count, ...args) {
        const cache = this.cache;
        const locale = this.options.locale;
        const isPlural = count > 1 ? true : false;
        const supportsPlural = this.isValue(plural);
        let shouldQueue;
        if (!cache[locale]) { // ensure loaded locale.
            cache[locale] = this.readLocale();
        }
        const existing = cache[locale][singular]; // value already exists.
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
        let val = cache[locale][singular]; // default singular value.
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
        return util_1.format(val, ...args);
    }
    // API METHODS //
    /**
     * A callback function before exit and after queue has been emptied.
     *
     * @param fn a callback function on queue empty and ready to exit.
     */
    onQueueEmpty(fn) {
        this._onQueueEmpty = fn;
    }
    /**
     * Set an option or extends current options.
     *
     * @param key the key or options object to set.
     * @param val the value to set when key is not an object.
     */
    setOption(key, val) {
        const isObj = this.isPlainObject(key);
        let obj = key;
        if (!isObj && !this.isValue(val))
            return;
        if (!isObj) {
            obj = {};
            obj[key] = val;
        }
        this.extend(this.options, obj);
        return this;
    }
    /**
     * Get an option value by key.
     *
     * @param key the option key to get.
     */
    getOption(key) {
        return this.options[key] || null;
    }
    /**
     * Key Exists inspects cached checking if key already exists.
     *
     * @param key the key to check if exists.
     * @param locale the locale to inspect for key.
     * @param directory optional directory.
     */
    keyExists(key, locale, directory) {
        locale = locale || this.options.locale;
        if (!this.cache[locale]) // ensure loaded locale.
            this.cache[locale] = this.readLocale(locale, directory);
        return this.cache[locale][key];
    }
    /**
     * Sync ensures secondary locales contain same keys of primary from.
     *
     * @param from the locale to sync from default "en".
     */
    sync(from = 'en') {
        from = from.replace(/\.json$/, '.json').toLowerCase();
        const stats = fs_1.statSync(this.options.directory);
        const files = fs_1.readdirSync(this.options.directory, 'utf-8');
        const fromLocale = this.readLocale(from);
        let ctr = 0;
        files.forEach((f, i) => {
            const filename = f.toString().toLowerCase();
            const locale = path_1.basename(filename).replace(/\.json$/, '');
            if (locale !== from) {
                // Load the current found locale.
                const currLocale = this.readLocale(locale, null, true);
                for (const k in fromLocale) {
                    if (!currLocale[k])
                        currLocale[k] = fromLocale[k];
                }
                // Write the file.
                fs_1.writeFileSync(path_1.resolve(this.options.directory, `${locale}.json`), JSON.stringify(currLocale, null, 2));
                console.error(`Synchronized locales: ${from} >> ${locale}`);
            }
        });
    }
    __(val, ...args) {
        if (Array.isArray(val)) // is template literal.
            return this.templateLiteral(val, args);
        return this.localize(val, null, null, ...args);
    }
    /**
     * Localize plurals.
     *
     * @param singular the singular localized value.
     * @param plural the pluralized valued.
     * @param count the count for the plural value.
     * @param args argument formatters.
     */
    __n(singular, plural, count, ...args) {
        return this.localize(singular, plural, count, ...args);
    }
}
exports.Lokales = Lokales;
//# sourceMappingURL=index.js.map