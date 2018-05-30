
import { IMap, LokalesErrorHandler, LokalesUpdateHandler, ILokalesOptions, ILokalesCache, ILokalesItem, ILokalesUpdated, LokalesOptionKeys } from './interfaces';
import { parse, resolve, join } from 'path';
import { readFileSync, writeFile, writeFileSync, stat, statSync, Stats, createReadStream, createWriteStream, readdirSync, unlinkSync, existsSync } from 'fs';
import { spawn } from 'child_process';
import { format } from 'util';
import * as mkdir from 'make-dir';

export * from './interfaces';

const DEFAULTS = {
  directory: './locales',   // directory where locales are stored.
  locale: 'en',             // the active locale.
  localeFallback: 'en',     // a fallback locale when active fails.
  update: true,             // when true allows updates to locale file.
  onUpdate: undefined,      // method on update called good for translating.
  onError: undefined        // called on write queue error.
};

let instance = null; // ensure singleton.

export class Lokales {

  private _backedUp: boolean;
  private _exiting: boolean;
  private _backupQueue: any[];

  path: string; // the active locale path.
  cache: ILokalesCache = {};
  queue: any[] = [];
  options: ILokalesOptions;

  constructor(options?: ILokalesOptions) {
    if (instance)
      return instance;
    this.options = this.extend({}, DEFAULTS, options);
    const optKeys = Object.keys(this.options);
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
  private onExit(type, err) {

    // Loop until queue is empty.
    const checkQueue = () => {
      if (this.queue.length) {
        this.processQueue();
        checkQueue();
      }
      else {
        if (type === 'error' && err)
          throw err;
      }
    };

    // Remove listeners to prevent looping.
    process.removeListener('exit', this.onExit);
    process.removeListener('uncaughtException', this.onExit);

    checkQueue();

  }

  /**
   * Handles module errors.
   *
   * @param err the error to be handled.
   */
  private error(err: string | Error, shouldThrow: boolean = true, noStack: boolean = false) {
    const errorHandler = this.options.onError;
    if (!(err instanceof Error)) {
      const msg = err;
      err = new Error(err);
      err.message = msg;
    }
    if (errorHandler) {
      errorHandler(err);
    }
    else {
      const error = noStack ? err.message : err;
      if (shouldThrow)
        throw error;
      console.error(error);
    }
  }

  /**
   * Keys gets keys for an object.
   *
   * @param obj the object to get keys for.
   */
  private keys(obj: any) {
    if (!this.isPlainObject(obj))
      return [];
    return Object.keys(obj);
  }

  /**
   * Is Value ensures the provided argument is not undefined, NaN, Infinity etc.
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
   * Is Plain Object checks if is plain object.
   *
   * @param val the value to inspect.
   */
  private isPlainObject(val: any) {
    return val && val.constructor && val.constructor === {}.constructor;
  }

  /**
   * Is Number cecks if value is a number.
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
   * Minimalistc extend just suits purpose here.
   *
   * @param dest the destination object.
   * @param src the source object.
   */
  private extend(dest: any, ...args: any[]) {
    return Object.assign(dest, ...args);
  }

  // FILE SYSTEM //

  /**
   * Resolve Locale resolves the locale or fallback path.
   *
   * @param directory the directory where locales are stored.
   * @param locale the locale to be resovled.
   */
  private resolveFile(directory: string, locale: string, fallback?: string) {
    fallback = fallback || this.options.localeFallback;
    let path = resolve(directory, `${locale}.json`);
    const parsed = parse(path);
    mkdir.sync(parsed.dir); // ensure the directory exists.
    if (fallback && !existsSync(path))
      path = resolve(directory, `${fallback}.json`);
    return path;
  }

  /**
   * Resolve the path for a locale file.
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
   * Reads the locale file.
   *
   * @param directory the directory for locales.
   * @param locale the active locale.
   */
  private readLocale(locale?: string, directory?: string) {
    const path = this.resolvePath(directory, locale);
    this.path = path;
    let obj: any = {};
    try {
      const str = readFileSync(path, 'utf-8');
      obj = JSON.parse(str);
    }
    catch (ex) {
      if ((ex instanceof SyntaxError)) {
        ex.message = `locale ${locale} contains invalid syntax, ensure valid JSON.`;
        this.error(ex);
      }
      obj = {}; // ensure object file may not exist yet.
      if (ex && !(ex && ex.code === 'ENOENT')) // if missing ignore otherwise throw.
        this.error(ex);
    }
    return obj;
  }

  // QUEUE //

  /**
   * Adds event to write queue.
   *
   * @param state the current state of options object.
   */
  private writeQueue(updated: ILokalesUpdated) {
    this.queue.push(updated);
    if (this.queue.length === 1)
      this.processQueue();
  }

  /**
   * Process queued jobs saving to file.
   */
  private processQueue() {

    if (!this.queue.length)
      return;

    const updated = this.queue[0];
    const opts: ILokalesOptions = updated.options;
    const serialized = JSON.stringify(this.cache[opts.locale], null, 2);
    const path = this.resolveFile(opts.directory, opts.locale, opts.localeFallback);

    if (!serialized)
      return;

    writeFile(path, serialized, 'utf-8', (err) => {
      if (err)
        this.error(err, false, true); // don't exit continue queue but log error.
      if (opts.onUpdate) {
        opts.onUpdate(err, updated, this);
      }
      this.queue.shift();
      if (this.queue.length > 0)
        this.processQueue();
    });

  }

  /**
   * Template Literal allows for localizing __`some localized string ${value}`;
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
   * Localize common method for localizing strings.
   *
   * @param singular singular string value.
   * @param plural plural string value or count.
   * @param count numeric count for pluralization.
   * @param args format args.
   */
  protected localize(singular: string, plural?: string, count?: number, ...args: any[]) {

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
   * Set an option or extends current options.
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
   * Get an option value by key.
   *
   * @param key the option key to get.
   */
  getOption(key: string) {
    return this.options[key] || null;
  }

  /**
   * Key Exists inspects cached checking if key already exists.
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
   * Backup creates backup copy of locale file.
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
      mkdir.sync(dest); // ensure directory.
      writeFileSync(dest, data, 'utf-8');
    }
    catch (ex) {
      this._backedUp = false;
      this.error(ex);
    }
  }

  /**
   * Purge any backup files in locales directory.
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

    process.stderr.write(`\nLokales successfully purged ${ctr} file(s).\n`);

  }

  /**
   * Localize non plurals.
   *
   * @param val the value to localize.
   * @param args format arguments.
   */
  __(val: string, ...args: any[]): string {
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
  __n(singular: string, plural: string, count?: number, ...args: any[]): string {
    return this.localize(singular, plural, count, ...args);
  }

}