
import { ILokalesOptions, ILokalesCache, ILokalesUpdated, LokalesOptionKeys, IMap, ILokalesResult } from './interfaces';
import { parse, resolve, basename } from 'path';
import { readFileSync, writeFile, writeFileSync, stat, statSync, readdirSync, existsSync } from 'fs';
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

export class Lokales {

  // private _cache: any;
  private _canExit = false;
  private _onQueueEmpty: Function = () => { };

  path: string; // the active locale path.
  cache: ILokalesCache = {};
  queue: any[] = [];
  options: ILokalesOptions;

  constructor(options?: ILokalesOptions) {

    this.options = this.extend({}, DEFAULTS, options);
    process.on('exit', this.onExit.bind(this, 'exit'));

  }

  // UTILS //

  /**
   * Exit handler ensures graceful exit writing any in queue.
   */
  private onExit(type, err) {

    if (this._canExit) return;

    this._canExit = true;

    // Remove event listeners.
    process.removeListener('exit', this.onExit);

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
    }

  }

  /**
   * Handles module errors.
   *
   * @param err the error to be handled.
   */
  private error(err: string | Error) {
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
   * @param locale the locale to be resovled.
   * @param directory the directory where locales are stored.
   */
  private resolveFile(locale: string, directory?: string, fallback?: string) {
    fallback = fallback || this.options.localeFallback;
    directory = directory || this.options.directory;
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
  private readLocale(locale?: string, directory?: string, graceful?: boolean) {

    const path = this.resolvePath(locale, directory);
    this.path = path;
    let obj: any = {};

    try {
      const str = readFileSync(path, 'utf-8');
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

  private writeFile(path: string, data: string, updated?: IMap<any> | Function, fn?) {

    if (typeof updated === 'function') {
      fn = updated;
      updated = undefined;
    }

    if (!path || !data)
      return;

    writeFile(path, data, 'utf-8', (err) => {

      if (this.options.onUpdate)
        this.options.onUpdate(err, <IMap<any>>updated, this);

      if (err)
        this.error(err.message);

      this.queue.shift();

      if (this.queue.length > 0)
        this.processQueue();

      // Call callback if exists.
      if (fn) fn();

    });

  }

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
  private processQueue(type?: string, err?: any) {

    if (!this.queue.length) {
      this._canExit = true;
      this.onExit(type, err);
      return;
    }

    const updated = this.queue[0];
    const opts: ILokalesOptions = updated.options;
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
  private templateLiteral(strings: string[], values: any[]): string;

  /**
   * Template Literal allows for localizing __`some localized string ${value}`;
   *
   * @param strings array of template literal strings.
   * @param values template literal args.
   */
  private templateLiteral(strings: string[], values: any[], noFormat: boolean): ILokalesResult;

  private templateLiteral(strings: string[], values: any[], noFormat?: boolean) {
    let str = '';
    strings.forEach((el, i) => {
      const arg = values[i];
      str += el;
      if (typeof arg !== 'undefined') {
        str += '%s';
      }
    });
    if (noFormat)
      return this.__x(str, ...values);
    return this.__(str, ...values);
  }

  // GETTERS //

  get t() {
    return this.__;
  }

  get tn() {
    return this.__n;
  }

  get tx() {
    return this.__x;
  }

  get tnx() {
    return this.__nx;
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
  protected localize(singular: string, plural: string, count: number, ...args: any[]): ILokalesResult {

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

    return {
      val: val,
      args: args
    };

  }

  // API METHODS //

  /**
   * A callback function before exit and after queue has been emptied.
   *
   * @param fn a callback function on queue empty and ready to exit.
   */
  onQueueEmpty(fn: Function) {
    this._onQueueEmpty = fn;
  }

  flush() {
    this.queue = [];
    this._canExit = true;
  }

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
   * Sync ensures secondary locales contain same keys of primary from.
   *
   * @param from the locale to sync from default "en".
   */
  sync(from: string = 'en') {

    from = from.replace(/\.json$/, '.json').toLowerCase();

    const stats = statSync(this.options.directory);
    const files = readdirSync(this.options.directory, 'utf-8');

    const fromLocale = this.readLocale(from);
    let ctr = 0;

    files.forEach((f, i) => {

      const filename = f.toString().toLowerCase();
      const locale = basename(filename).replace(/\.json$/, '');

      if (locale !== from) {

        // Load the current found locale.
        const currLocale = this.readLocale(locale, null, true);

        for (const k in fromLocale) {
          if (!currLocale[k])
            currLocale[k] = fromLocale[k];
        }

        // Write the file.
        writeFileSync(resolve(this.options.directory, `${locale}.json`), JSON.stringify(currLocale, null, 2));

        console.error(`Synchronized locales: ${from} >> ${locale}`);

      }

    });

  }

  /**
   * Localize non plurals template strings.
   *
   * @param val the value to localize.
   * @param args format arguments.
   */
  __(val: TemplateStringsArray, ...args: any[]): string;

  /**
   * Localize non plural string.
   *
   * @param val the value to localize.
   * @param args format arguments.
   */
  __(val: string, ...args: any[]): string;

  __(val: string | TemplateStringsArray, ...args: any[]): string {
    if (Array.isArray(val)) // is template literal.
      return this.templateLiteral(val, args);
    const result = this.localize(<string>val, null, null, ...args);
    return format(result.val, ...result.args);
  }

  /**
   * Localize non plural string unformated as object.
   *
   * @param val the value to localize.
   * @param args format arguments.
   */
  __x(val: string | TemplateStringsArray, ...args: any[]): ILokalesResult {
    if (Array.isArray(val)) // is template literal.
      return this.templateLiteral(val, args, true);
    return this.localize(<string>val, null, null, ...args);
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
    const result = this.localize(singular, plural, count, ...args);
    return format(result.val, ...result.args);
  }

  /**
  * Localize plurals unformated as object.
  *
  * @param singular the singular localized value.
  * @param plural the pluralized valued.
  * @param count the count for the plural value.
  * @param args argument formatters.
  */
  __nx(singular: string, plural: string, count?: number, ...args: any[]): ILokalesResult {
    return this.localize(singular, plural, count, ...args);
  }

}