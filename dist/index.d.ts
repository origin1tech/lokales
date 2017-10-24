import { ILokalesOptions, ILokalesCache, LokalesOptionKeys } from './interfaces';
export * from './interfaces';
export declare class Lokales {
    private _backedUp;
    private _exiting;
    cache: ILokalesCache;
    queue: any[];
    options: ILokalesOptions;
    constructor(options?: ILokalesOptions);
    /**
     * On Exit.
     * Ensures graceful exit writing any in queue.
     *
     * @param code the error code on process exit or exception.
     */
    private onExit(code);
    /**
     * Error
     * : Handles module errors.
     *
     * @param err the error to be handled.
     */
    private error(err);
    /**
     * Keys
     * : Gets keys for an object.
     *
     * @param obj the object to get keys for.
     */
    private keys(obj);
    /**
     * Is Value
     * : Ensures the provided argument is not undefined, NaN, Infinity etc.
     *
     * @param val the value to inspect.
     */
    private isValue(val);
    /**
     * Is Plain Object
     * : Checks if is plain object.
     *
     * @param val the value to inspect.
     */
    private isPlainObject(val);
    /**
     * Is Number
     * : Checks if value is a number.
     *
     * @param val the value to be checked.
     */
    private isNumber(val);
    /**
     * Extend
     * : Minimalistc extend just suits purpose here.
     *
     * @param dest the destination object.
     * @param src the source object.
     */
    private extend(dest, ...args);
    /**
     * Path Exists
     * : Checks if a file or directory exists.
     *
     * @param path the path to inspect if exists.
     * @param fn a callback function on result.
     */
    private pathExists(path, isDir?, fn?);
    /**
     * Resolve Path
     * : Resolves the path for a locale file.
     *
     * @param locale the locale to use for resolving path.
     * @param directory an optional directory for resolving locale file.
     */
    private resolvePath(locale?, directory?);
    /**
     * Resolve Locale
     * : Resolves the locale or fallback path.
     *
     * @param directory the directory where locales are stored.
     * @param locale the locale to be resovled.
     */
    private resolveFile(directory, locale, fallback?);
    /**
     * Read Locale
     * : Reads the locale file.
     *
     * @param directory the directory for locales.
     * @param locale the active locale.
     */
    private readLocale(locale?, directory?);
    /**
     * Write Queue
     * : Adds options state to write queue for processing.
     *
     * @param state the current state of options object.
     */
    private writeQueue(updated);
    /**
     * Process Queue
     * : Processes queued jobs saving to file.
     */
    private processQueue();
    /**
     * Template Literal
     * : Allows for localizing __`some localized string ${value}`;
     *
     * @param strings array of template literal strings.
     * @param values template literal args.
     */
    private templateLiteral(strings, values);
    readonly t: (val: string, ...args: any[]) => string;
    readonly tn: (singular: string, plural: string, count?: number, ...args: any[]) => string;
    /**
     * Localize
     * : Common method for localizing strings.
     *
     * @param singular singular string value.
     * @param plural plural string value or count.
     * @param count numeric count for pluralization.
     * @param args format args.
     */
    private localize(singular, plural?, count?, ...args);
    /**
     * Set Option
     * : Sets an option or extends current options.
     *
     * @param key the key or options object to set.
     * @param val the value to set when key is not an object.
     */
    setOption(key: LokalesOptionKeys | ILokalesOptions, val: any): this;
    /**
     * Get Option
     * : Gets an option value by key.
     *
     * @param key the option key to get.
     */
    getOption(key: string): any;
    /**
     * Key Exists
     * : Inspects cached checking if key already exists.
     *
     * @param key the key to check if exists.
     * @param locale the locale to inspect for key.
     * @param directory optional directory.
     */
    keyExists(key: string, locale?: string, directory?: string): any;
    /**
     * Backup
     * : Creates backup copy of file.
     *
     * @param src the original source path to be backed up.
     */
    backup(src: string): void;
    /**
     * Purge
     * : Purges any backup files in locales directory.
     */
    purge(): void;
    __(val: string, ...args: any[]): string;
    __n(singular: string, plural: string, count?: number, ...args: any[]): string;
}
