# Lokales

Barebones i18n localization written in TypeScript. Similar to [y18n](https://github.com/yargs/y18n) but with a few improvements, handles errors better preventing corrupt or empty locale files. Other than that about the same.

## Quick Start

Initialize using ES5 or ES6/TypeScript Imports.

```ts
import { Lokales } from 'lokales';
const lokales = new Lokales({ /* your options */ });
```

**OR ES5**

```js
const Lokales = require('lokales').Lokales;
const lokales = new Lokales({ /* your options */ });
```

**Singular**

Singular example passing key and format values.

```ts
lokales.__('Hello my name is %s.', 'Joe');
// Result > Hello my name is Joe.
```

**Plural**

Plural example passing singular key, plural key, count and format values.

```ts
lokales.__n('I have %d cat', 'I have %d cats', 2, 'Joe');
// Result > I have 2 cats.
```

**Literal**

Template literal example.

```ts
const color = 'blue';
lokales.__`My favorite color is ${color}.`;
// Result > My favorite color is blue.
```

## Options

Options can also be set using the **lokales.setOption(key, value)** method.

<table>
  <thead><tr><td>Key</td><td>Description</td></tr><thead>
  <tbody>
    <tr><td>directory</td><td>The directory where locales are stored.</td></tr>
    <tr><td>locale</td><td>The active locale to be used.</td></tr>
    <tr><td>update</td><td>When true localization file is updated when key is unknown.</td></tr>
    <tr><td>onUpdate</td><td>Custom callback called on locale file updated.</td></tr>
    <tr><td>onError</td><td>Custom callback called on error.</td></tr>
  </tbody>
</table>

## API

Simple API for plural or singular localization along with get and set for options.

<table>
  <thead><tr><td>Method</td><td>Arguments</td><td>Description</td></tr><thead>
  <tbody>
    <tr><td>__</td><td>val: string, ...args: any[]</td><td>Singular localization.</td></tr>
    <tr><td>__n</td><td>singular: string, plural: string, count: number, ...args: any[]</td><td>Plural localization.</td></tr>
    <tr><td>setOption</td><td>key: LokalesOptionKeys | ILokalesOptions, val: any</td><td>Sets an option by key/value or options object.</td></tr>
    <tr><td>getOption</td><td>key: string</td><td>Gets an existing option.</td></tr>
    <tr><td>keyExists</td><td>key: string, locale?: string, directory?: string</td><td>Checks if key exists in locale.</td></tr>
    <tr><td>backup</td><td>src: string</td><td>Backup a locale by path.</td></tr>
    <tr><td>purge</td><td>n/a</td><td>Purges and backup files.</td></tr>
  </tbody>
</table>

## Advanced Usage

In some cases it may be useful to call a translate API after your primary localization file is updated. For example upon updating the en.json locale you may with to update perhaps the es, fr, ru or it locales. Here's an example using [Google Translate](https://googlecloudplatform.github.io/google-cloud-node/#/docs/translate/1.0.0/translate).

**IMPORTANT**

A quick note about the below example. One key piece missing below for the sake of brevity is some sort of method to serialialize and deserialize the string to be translated. This is because the translate API won't typically know what to do with %s or %d. You can simply iterate the string and replace these tokens with tokens your translate API will ignore. The restructure the data after translation.

```ts
import { Lokales } from 'lokales';
import { translate } from '@google-cloud';
import { writeFile } from 'fs';
import { join } from 'path';

const lokales = new Lokales({ onUpdate: onUpdate });
const trans = translate({
  key: 'YOUR_API_KEY'
});

/**
 * On Update
 * : Called when process queue updated locale.
 *
 * Updated Object Contains:
 * singular: string;  // The singular key string.
 * plural: string;    // The plural key if provided or null.
 * count: number;     // The count when plural is used.
 * args: [];          // The original format arguments passed.
 * options: {}        // Snapshot of options. (see options above for details)
 */
function onUpdate(err, updated, instance) {

  if (err)
    throw err; // do something with error.

  const value = updated.singular // you might check for plural here but for simplicity.
  const options = updated.options;
  const lang = 'es'; // the lang we want to translate to.
  const translated: any = {}; // object to store translated values.

  trans.translate(value, lang, (err, res) => {

    if (err)
      throw err;

    if (!Array.isArray(res)) // ensure our result is an array.
      res = [res];

    res.forEach((s, i) => {
      translated[s] = s; // see above important note.
    });

    const savePath = path.join(options.directory, lang + '.json');
    const serialized = JSON.stringify(translated, null, 2);

    fs.writeFile(savePath, serialized, (err) => {
      // do something with/if error.
      // or
      // log success etc.
    });

  });

}
```

## Docs

See [https://origin1tech.github.io/lokales/](https://origin1tech.github.io/lokales/)

## License

See [LICENSE.md](LICENSE.md)