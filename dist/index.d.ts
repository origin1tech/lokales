import { ILokalesOptions, ILokalesCache, LokalesOptionKeys } from './interfaces';
export * from './interfaces';
export declare class Lokales {
    private _backedUp;
    private _exiting;
    private _backupQueue;
    path: string;
    cache: ILokalesCache;
    queue: any[];
    options: ILokalesOptions;
    constructor(options?: ILokalesOptions);
    /**
     * Exit handler ensures graceful exit writing any in queue.
     */
    private onExit(type, err);
    /**
     * Handles module errors.
     *
     * @param err the error to be handled.
     */
    private error(err, shouldThrow?, noStack?);
    /**
     * Keys gets keys for an object.
     *
     * @param obj the object to get keys for.
     */
    private keys(obj);
    /**
     * Is Value ensures the provided argument is not undefined, NaN, Infinity etc.
     *
     * @param val the value to inspect.
     */
    private isValue(val);
    /**
     * Is Plain Object checks if is plain object.
     *
     * @param val the value to inspect.
     */
    private isPlainObject(val);
    /**
     * Is Number cecks if value is a number.
     *
     * @param val the value to be checked.
     */
    private isNumber(val);
    /**
     * Minimalistc extend just suits purpose here.
     *
     * @param dest the destination object.
     * @param src the source object.
     */
    private extend(dest, ...args);
    /**
     * Resolve Locale resolves the locale or fallback path.
     *
     * @param locale the locale to be resovled.
     * @param directory the directory where locales are stored.
     */
    private resolveFile(locale, directory, fallback?);
    /**
     * Resolve the path for a locale file.
     *
     * @param locale the locale to use for resolving path.
     * @param directory an optional directory for resolving locale file.
     */
    private resolvePath(locale?, directory?);
    /**
     * Reads the locale file.
     *
     * @param locale the active locale.
     * @param directory the directory for locales.
     */
    private readLocale(locale?, directory?, ignoreErrors?);
    /**
     * Adds event to write queue.
     *
     * @param state the current state of options object.
     */
    private writeQueue(updated);
    /**
     * Process queued jobs saving to file.
     */
    private processQueue();
    /**
     * Template Literal allows for localizing __`some localized string ${value}`;
     *
     * @param strings array of template literal strings.
     * @param values template literal args.
     */
    private templateLiteral(strings, values);
    readonly t: (val: string, ...args: any[]) => string;
    readonly tn: (singular: string, plural: string, count?: number, ...args: any[]) => string;
    /**
     * Localize common method for localizing strings.
     *
     * @param singular singular string value.
     * @param plural plural string value or count.
     * @param count numeric count for pluralization.
     * @param args format args.
     */
    protected localize(singular: string, plural?: string, count?: number, ...args: any[]): string;
    /**
     * Set an option or extends current options.
     *
     * @param key the key or options object to set.
     * @param val the value to set when key is not an object.
     */
    setOption(key: LokalesOptionKeys | ILokalesOptions, val: any): this;
    /**
     * Get an option value by key.
     *
     * @param key the option key to get.
     */
    getOption(key: string): any;
    /**
     * Key Exists inspects cached checking if key already exists.
     *
     * @param key the key to check if exists.
     * @param locale the locale to inspect for key.
     * @param directory optional directory.
     */
    keyExists(key: string, locale?: string, directory?: string): any;
    /**
     * Sync ensures secondary locales contain same keys of primary from.
     *
     * @param from the locale to sync from default "en".
     */
    sync(from?: string): void;
    /**
     * Localize non plurals.
     *
     * @param val the value to localize.
     * @param args format arguments.
     */
    __(val: string, ...args: any[]): string;
    /**
     * Localize plurals.
     *
     * @param singular the singular localized value.
     * @param plural the pluralized valued.
     * @param count the count for the plural value.
     * @param args argument formatters.
     */
    __n(singular: string, plural: string, count?: number, ...args: any[]): string;
}
