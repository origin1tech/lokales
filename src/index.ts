
import { IMap, LokalesErrorHandler, LokalesUpdateHandler, ILokalesOptions, ILokalesCache, ILokalesItem, ILokalesUpdated, LokalesOptionKeys } from './interfaces';
import { parse, resolve, join } from 'path';
import { readFileSync, writeFile, writeFileSync, stat, statSync, Stats, createReadStream, createWriteStream, readdirSync, unlinkSync } from 'fs';
import { format } from 'util';
import { EOL } from 'os';

export * from './interfaces';

const DEFAULTS = {
  directory: './locales',   // directory where locales are stored.
  locale: 'en',             // the active locale.
  localeFallback: 'en',     // a fallback locale when active fails.
  update: true,             // when true allows updates to locale file.
  backup: true,             // when true backup copy of active locale is created.
  onUpdate: undefined,      // method on update called good for translating.
  onError: undefined        // called on write queue error.
};

let instance = null; // ensure singleton.

export class Lokales {

  private _backedUp: boolean;
  private _exiting: boolean;

  cache: ILokalesCache = {};
  queue: any[] = [];
  options: ILokalesOptions;

  constructor(options?: ILokalesOptions) {
    if (instance)
      return instance;
    this.options = this.extend({}, DEFAULTS, options);
    process.on('exit', this.onExit.bind(this));
    instance = this;
  }

  // UTILS //

  /**
   * On Exit.
   * Ensures graceful exit writing any in queue.
   *
   * @param code the error code on process exit or exception.
   */
  private onExit(code) {
    if (this.queue.length && !this._exiting) {
      this.processQueue();
    }
  }

  /**
   * Error
   * : Handles module errors.
   *
   * @param err the error to be handled.
   */
  private error(err: string | Error) {
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
    }
    else {
      console.log();
      throw err;
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
        return statSync(path).isFile();
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
   * Resolve Path
   * : Resolves the path for a locale file.
   *
   * @param locale the locale to use for resolving path.
   * @param directory an optional directory for resolving locale file.
   */
  private resolvePath(locale?: string, directory?: string) {
    directory = directory || this.options.directory;
    locale = locale || this.options.locale;
    return this.resolveFile(directory, locale);
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
      this.error(`failed to load locales path ${parsed.dir}, ensure the directory exists.`);
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
  private readLocale(locale?: string, directory?: string) {
    const path = this.resolvePath(directory, locale);
    let obj: any = {};
    try {
      const str = readFileSync(path, 'utf-8');
      if (this.options.backup) // backup a copy of the locale.
        this.backup(path, str);
      obj = JSON.parse(str);
    }
    catch (ex) {
      if (ex instanceof SyntaxError) {
        ex.message = `locale ${locale} contains invalid syntax, ensure valid JSON.`;
        this.error(ex);
      }
      obj = {}; // ensure object file may not exist yet.
      if (ex && !(ex && ex.code === 'ENOENT')) // ignore missing locale we'll create it.
        this.error(ex);
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
  private writeQueue(updated: ILokalesUpdated) {
    this.queue.push(updated);
    if (this.queue.length === 1)
      this.processQueue();
  }

  /**
   * Process Queue
   * : Processes queued jobs saving to file.
   */
  private processQueue() {

    const updated = this.queue[0];
    const opts: ILokalesOptions = updated.options;
    const path = this.resolveFile(opts.directory, opts.locale, opts.localeFallback);
    const serialized = JSON.stringify(this.cache[opts.locale], null, 2);

    if (!serialized)
      return;

    writeFile(path, serialized, 'utf-8', (err) => {
      if (err)
        this.error(err); // don't exit continue queue but log error.
      if (opts.onUpdate) {
        opts.onUpdate(err, updated, this);
      }
      this.queue.shift();
      if (this.queue.length > 0)
        this.processQueue();
    });

  }

  /**
   * Template Literal
   * : Allows for localizing __`some localized string ${value}`;
   *
   * @param strings array of template literal strings.
   * @param values template literal args.
   */
  private templateLiteral(strings: string[], values: any[]) {
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

    if (!cache[locale]) { // ensure loaded locale.
      cache[locale] = this.readLocale();
    }

    const existing = cache[locale][singular]; // value already exists.

    if (!existing && this.options.update) {

      if (!supportsPlural) { // singular localization.
        cache[locale][singular] = singular;
      }
      else {
        cache[locale][singular] = { // plural localization.
          one: singular,
          other: plural
        };
      }

      shouldQueue = true;

    }

    if (existing && supportsPlural &&   // ensure key is object.
      this.options.update &&
      !this.isPlainObject(cache[locale][singular])) {
      cache[locale][singular] = {
        one: singular,
        other: plural
      };
      shouldQueue = true;
    }

    let val = cache[locale][singular];  // default singular value.

    if (supportsPlural) { // supports plural
      if (isPlural)
        val = cache[locale][singular].other; // get plural value.
      else
        val = cache[locale][singular].one; // get singular.
    }

    if (shouldQueue)  // add write to queue to reflect changes.
      this.writeQueue({
        singular: singular,
        plural: plural,
        count: count,
        args: args,
        options: this.options
      });

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
  setOption(key: LokalesOptionKeys | ILokalesOptions, val: any) {
    const isObj = this.isPlainObject(key);
    let obj: any = key;
    if (!isObj && !this.isValue(val))
      return;
    if (!isObj) {
      obj = {};
      obj[<string>key] = val;
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
   * Key Exists
   * : Inspects cached checking if key already exists.
   *
   * @param key the key to check if exists.
   * @param locale the locale to inspect for key.
   * @param directory optional directory.
   */
  keyExists(key: string, locale?: string, directory?: string) {

    locale = locale || this.options.locale;

    if (!this.cache[locale])  // ensure loaded locale.
      this.cache[locale] = this.readLocale(locale, directory);

    return this.cache[locale][key];

  }

  /**
   * Backup
   * : Creates backup copy of file.
   *
   * @param src the original source path to be backed up.
   */
  backup(src: string, data: string | object) {
    src = src || this.resolvePath();
    if (this.isPlainObject(data))
      data = JSON.stringify(data);
    try {
      const parsed = parse(src);
      const dest = join(parsed.dir, parsed.name + '.bak' + parsed.ext);
      writeFileSync(dest, data, 'utf-8');
    }
    catch (ex) {
      this._backedUp = false;
      this.error(ex);
    }
  }

  /**
   * Purge
   * : Purges any backup files in locales directory.
   */
  purge() {
    const stats = statSync(this.options.directory);
    const files = readdirSync(this.options.directory, 'utf-8');
    let ctr = 0;
    files.forEach((f, i) => {
      if (/bak\.json$/.test(f.toString())) {
        unlinkSync(join(this.options.directory, f.toString()));
        ctr++;
      }
    });
    console.log();
    console.log(`successfully purged ${ctr} file(s).`);
    console.log();
  }

  __(val: string, ...args: any[]): string {
    if (Array.isArray(val)) // is template literal.
      return this.templateLiteral(val, args);
    return this.localize(val, null, null, ...args);
  }

  __n(singular: string, plural: string, count?: number, ...args: any[]): string {
    return this.localize(singular, plural, count, ...args);
  }

}