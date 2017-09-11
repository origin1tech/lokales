
import { IMap, LokalesErrorHandler, LokalesUpdateHandler, ILokalesOptions, ILokalesCache, ILokalesItem, ILokalesUpdateResult } from './interfaces';
import { parse, resolve } from 'path';
import { readFileSync, writeFile, stat, statSync, Stats } from 'fs';
import { format } from 'util';
import { EOL } from 'os';


const DEFAULTS = {
  directory: './locales',   // directory where locales are stored.
  locale: 'en',             // the active locale.
  localeFallback: 'en',     // a fallback locale when active fails.
  update: true,             // when true allows updates to locale file.
  onUpdate: undefined,      // method on update called good for translating.
  onError: undefined        // called on write queue error.
};

export class Lokales {

  cache: ILokalesCache = {};
  queue: any[] = [];

  options: ILokalesOptions;

  constructor(options?: ILokalesOptions) {
    this.options = this.extend({}, DEFAULTS, options);
    process.on('exit', (code) => {
      if (this.queue.length) // cleanup ensure queue is processed.
        this.processQueue();
    });
  }

  // UTILS //

  /**
   * Error
   * : Handles module errors.
   *
   * @param err the error to be handled.
   * @param exit forces Lokales to exit.
   */
  private error(err: string | Error, exit?: boolean) {

    const errorHandler = this.options.onError;

    if (!(err instanceof Error)) {
      err = new Error(err);
      const stack: any = (err.stack || '').split(EOL);
      const msg = stack.shift();
      if (msg && stack.length)
        err.stack = [msg].concat(stack.slice(1)).join(EOL);
    }

    if (errorHandler) {
      errorHandler(err);
      if (exit)
        process.exit(1);
    }
    else {
      if (exit)
        throw err;
      console.log(err.message);
    }

  }

  /**
   * Keys
   * : Gets keys for an object.
   *
   * @param obj the object to get keys for.
   */
  private keys(obj: any) {
    if (!this.isPlainObject(obj))
      return [];
    return Object.keys(obj);
  }

  /**
   * Is Value
   * : Ensures the provided argument is not undefined, NaN, Infinity etc.
   *
   * @param val the value to inspect.
   */
  private isValue(val: any) {
    return (
      (typeof val !== 'undefined') &&
      (val !== null)
    );
  }

  /**
   * Is Plain Object
   * : Checks if is plain object.
   *
   * @param val the value to inspect.
   */
  private isPlainObject(val: any) {
    return val && val.constructor && val.constructor === {}.constructor;
  }

  /**
   * Is Number
   * : Checks if value is a number.
   *
   * @param val the value to be checked.
   */
  private isNumber(val: any) {
    return (
      typeof val === 'number' &&
      !isNaN(val)
    );
  }

  /**
   * Extend
   * : Minimalistc extend just suits purpose here.
   *
   * @param dest the destination object.
   * @param src the source object.
   */
  private extend(dest: any, ...args: any[]) {
    dest = dest || {};
    while (args.length) {
      const current = args.shift() || {};
      if (this.isPlainObject(current)) {
        for (const k in current) {
          if (this.isValue(current[k]))
            dest[k] = current[k];
        }
      }
    }
    return dest;
  }

  // FILE SYSTEM //

  /**
   * Path Exists
   * : Checks if a file or directory exists.
   *
   * @param path the path to inspect if exists.
   * @param fn a callback function on result.
   */
  private pathExists(path: string, isDir?: boolean | { (exists: boolean) }, fn?: (exists: boolean) => void) {
    if (typeof isDir === 'function') {
      fn = isDir;
      isDir = undefined;
    }
    try {
      if (!fn) {
        if (isDir)
          return statSync(path).isDirectory();
        return statSync(path).isFile()
      }
      stat(path, (e, s) => {
        if (e) {
          if (!fn)
            return false;
          return fn(false);
        }
        if (isDir)
          return s.isDirectory();
        return s.isFile();
      });
    } catch (ex) {
      if (!fn)
        return false;
      fn(false);
    }
  }

  /**
   * Resolve Locale
   * : Resolves the locale or fallback path.
   *
   * @param directory the directory where locales are stored.
   * @param locale the locale to be resovled.
   */
  private resolveFile(directory: string, locale: string, fallback?: string) {
    fallback = fallback || this.options.localeFallback;
    let path = resolve(directory, './', `${locale}.json`);
    if (fallback && !this.pathExists(path))
      path = resolve(directory, './', `${fallback}.json`);
    const parsed = parse(path);
    if (!this.pathExists(parsed.dir, true)) {
      this.error(`failed to load locales path ${parsed.dir}, ensure the directory exists.`, true);
      return;
    }
    return path;
  }

  /**
   * Read Locale
   * : Reads the locale file.
   *
   * @param directory the directory for locales.
   * @param locale the active locale.
   */
  private readLocale(directory?: string, locale?: string) {
    directory = directory || this.options.directory;
    locale = locale || this.options.locale;
    const path = this.resolveFile(directory, locale);
    let obj: any = {};
    try {
      obj = JSON.parse(readFileSync(path, 'utf-8'))
    }
    catch (ex) {
      if (ex instanceof SyntaxError) {
        ex.message = `locale ${locale} contains invalid syntax, ensure valid JSON.`;
        this.error(ex, true);
      }
      obj = {}; // ensure object file may not exist yet.
      if (ex && !(ex && ex.code === 'ENOENT')) // ignore missing locale we'll create it.
        this.error(ex); // report error to warn but don't exit.
    }
    return obj;
  }

  // QUEUE //

  /**
   * Write Queue
   * : Adds options state to write queue for processing.
   *
   * @param state the current state of options object.
   */
  private writeQueue(update: ILokalesUpdateResult, state: ILokalesOptions) {
    this.queue.push([update, state]);
    if (this.queue.length === 1)
      this.processQueue();
  }

  /**
   * Process Queue
   * : Processes queued jobs saving to file.
   */
  private processQueue() {

    const item = this.queue[0];
    const update = item[0];
    const opts: ILokalesOptions = item[1];
    const path = this.resolveFile(opts.directory, opts.locale, opts.localeFallback);
    const serialized = JSON.stringify(this.cache[opts.locale], null, 2);

    if (!serialized)
      return;

    writeFile(path, serialized, 'utf-8', (err) => {
      if (err)
        this.error(err); // don't exit continue queue but log error.
      if (opts.onUpdate)
        opts.onUpdate(update, opts, this);
      this.queue.shift();
      if (this.queue.length > 0)
        this.processQueue();
    });

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
   * Localize
   * : Common method for localizing strings.
   *
   * @param singular singular string value.
   * @param plural plural string value or count.
   * @param count numeric count for pluralization.
   * @param args format args.
   */
  private localize(singular: string, plural?: string, count?: number, ...args: any[]) {

    const cache = this.cache;
    const locale = this.options.locale;
    const isPlural = count > 1 ? true : false;
    const supportsPlural = this.isValue(plural);
    let shouldQueue;

    if (!cache[locale])  // ensure loaded locale.
      cache[locale] = this.readLocale();

    const existing = cache[locale][singular]; // value already exists.

    if (!existing && this.options.update) {

      if (!supportsPlural) { // singular localization.
        cache[locale][singular] = singular;
      }
      else {
        cache[locale][singular] = { // plural localization.
          one: singular,
          other: plural
        }
      }

      shouldQueue = true;

    }

    if (existing && supportsPlural &&   // ensure key is object.
      this.options.update &&
      !this.isPlainObject(cache[locale][singular])) {
      cache[locale][singular] = {
        one: singular,
        other: plural
      }
      shouldQueue = true;
    }

    let val = cache[locale][singular];  // default singular value.

    if (supportsPlural) { // supports plural
      if (isPlural)
        val = cache[locale][singular].other; // get plural value.
      else
        val = cache[locale][singular].one // get singular.
    }

    if (shouldQueue)  // add write to queue to reflect changes.
      this.writeQueue({
        singular: singular,
        plural: plural,
        count: count,
        args: args
      }, this.options);

    if (~val.indexOf('%d'))
      args.push(count);

    return format(val, ...args);

  }

  // API METHODS //

  /**
   * Set Option
   * : Sets an option or extends current options.
   *
   * @param key the key or options object to set.
   * @param val the value to set when key is not an object.
   */
  setOption(key: string, val: any) {
    const isObj = this.isPlainObject(key);
    let obj: any = key;
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
   * Get Option
   * : Gets an option value by key.
   *
   * @param key the option key to get.
   */
  getOption(key: string) {
    return this.options[key] || null;
  }

  /**
   * Template Literal
   * : Allows for localizing __`some localized string ${value}`;
   *
   * @param strings array of template literal strings.
   * @param values template literal args.
   */
  templateLiteral(strings: string[], values: any[]) {
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

  __(val: string, ...args: any[]) {
    if (Array.isArray(val)) // is template literal.
      return this.templateLiteral(val, args);
    return this.localize(val, null, null, ...args);
  }

  __n(singular: string, plural: string, count: number, ...args: any[]) {
    return this.localize(singular, plural, count, ...args);
  }

}