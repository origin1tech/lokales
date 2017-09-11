
import { Lokales } from './';

export type LokalesErrorHandler = (err: Error) => void;
export type LokalesUpdateHandler = (err?: Error, options?: ILokalesOptions, lokales?: Lokales) => void;

export interface IMap<T> {
  [key: string]: T;
}

export interface ILokalesOptions {
  directory?: string;
  locale?: string;
  localeFallback?: string;
  update?: boolean;
  onUpdate?: LokalesUpdateHandler;
  onError?: LokalesErrorHandler;
}

export interface ILokalesUpdateResult {
  singular?: string;
  plural?: string;
  count?: number;
  args?: any[];
}

export interface ILokalesItem {
  one: string;
  other: string;
}

export interface ILokalesCache extends IMap<ILokalesItem | string> { };
