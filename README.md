# Lokales

Barebones i18n localization written in TypeScript. Similar to [y18n](https://github.com/yargs/y18n) but with a few improvements, written in TypeScript and handles errors better preventing corrupt or empty locale files. Other than that about the same.

## Quick Start

```ts
import { Lokales } from 'lokales';

const lokales = new Lokales({ /* your options */ });
```

OR ES5

```js
const Lokales = require('lokales').Lokales;

const lokales = new Lokales({ /* your options */ });
```

### Usage

**Singular**

```ts
lokales.__('Hello my name is %s.', 'Joe');
// Result > Hello my name is Joe.
```

**Plural**

```ts
lokales.__('I have %d cat', 'I have %d cats', 2, 'Joe');
// Result > I have 2 cats.
```

**Literal**

```ts
const color = 'blue';
lokales.__`My favorite color is ${color}.`;
// Result > My favorite color is blue.
```

## API

<table>
  <thead><tr><td>Method</td><td>Arguments</td><td>Description</td></tr><thead>
  <tbody>
    <tr><td>__</td><td>val: string, ...args: any[]</td><td>Singular localization.</td></tr>
    <tr><td>__n</td><td>singular: string, plural: string, count: number, ...args: any[]</td><td>Plural localization.</td></tr>
    <tr><td>setOption</td><td>key: LokalesOptionKeys | ILokalesOptions, val: any</td><td>Sets an option by key/value or options object.</td></tr>
    <tr><td>getOption</td><td>key: string</td><td>Gets an existing option.</td></tr>
    <tr><td>keyExists</td><td>key: string, locale?: string, directory?: string</td><td>Checks if key exists in locale.</td></tr>
  </tbody>
</table>


## License

See [LICENSE.md](LICENSE.md)