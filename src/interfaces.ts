
import { Lokales } from './';

export type LokalesErrorHandler = (err?: Error) => void;
export type LokalesUpdateHandler = (err?: Error, updated?: ILokalesUpdated, lokales?: Lokales) => void;
export type LokalesOptionKeys = 'directory' | 'locale' | 'localeFallback' | 'update' | 'onUpdate' | 'onError';

export interface IMap<T> {
  [key: string]: T;
}

export interface ILokalesOptions {
  directory?: string;
  locale?: string;
  localeFallback?: string;
  update?: boolean;
  stripAnsi?: boolean;
  onUpdate?: LokalesUpdateHandler;
  onError?: LokalesErrorHandler;
}

export interface ILokalesUpdated {
  singular?: string;
  plural?: string;
  count?: number;
  args?: any[];
  options?: ILokalesOptions;
}

export interface ILokalesItem {
  one: string;
  other: string;
}

export interface ILokalesResult {
  val: string;
  args: any[];
}

export interface ILokalesCache extends IMap<ILokalesItem | string> { }
