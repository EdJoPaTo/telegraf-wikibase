# telegraf-wikibase

[![NPM Version](https://img.shields.io/npm/v/telegraf-wikibase.svg)](https://www.npmjs.com/package/telegraf-wikibase)
[![node](https://img.shields.io/node/v/telegraf-wikibase.svg)](https://www.npmjs.com/package/telegraf-wikibase)

> Telegraf/grammY Middleware to use Wikibase entities (like Wikidata ones) in your users language

This library is inspired by [telegraf-i18n](https://github.com/telegraf/telegraf-i18n) and was made to work with [Wikidata](https://wikidata.org/).

HINT: [wikibase-sdk](https://github.com/maxlath/wikibase-sdk) went from being `wikidata-sdk` to be usable for Wikibase in general.
As this process is ongoing this library only supports Wikidata currently.
General Wikibase support is wished for but not worked on currently. (Feel free to create a Pull Request.)

## Install

```bash
npm install telegraf-wikibase
```

## Usage

```ts
import {TelegrafWikibase} from 'telegraf-wikibase';

const twb = new TelegrafWikibase()
twb.addResourceKeys({human: 'Q5', earth: 'Q2'})

bot.use(twb)

bot.command('foo', async ctx => {
  const reader = await ctx.wb.r('human')
  return ctx.reply(`Hey ${reader.label()}!`)
  // returns 'Hey Human!'; 'Hey Mensch!'; … depending on the users language
})
```

The middleware adds `.wb` to the Context `ctx`.

## API

### Constructor

```ts
bot.use(new TelegrafWikibase())
bot.use(new TelegrafWikibase(store: Store<EntitySimplified>, options))
```

`store` to access requested `resourceKeys` or entity IDs (Q-Numbers).

#### options

```ts
const options = {
  contextKey: 'wd'
}
```

`contextKey` determines the key where to reach the Context Methods.
Defaults to `wb` (`ctx.wb.reader`)

### Context Methods

#### locale

```ts
ctx.wb.locale(): string
```

Returns current `languageCode` of the user.

```ts
ctx.wb.locale(languageCode: string): string
```

Set the `languageCode` to the `ctx.session` of the user.
Still returns the (newly set) `languageCode` of the user.

#### reader

```ts
async ctx.wb.reader(key: string): Promise<WikidataEntityReader>
```

Returns the [`WikidataEntityReader`](https://github.com/EdJoPaTo/wikidata-entity-reader).
Use it with `.label()`, `.description()` and so on…
