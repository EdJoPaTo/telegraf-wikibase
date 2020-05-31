# telegraf-wikibase

[![NPM Version](https://img.shields.io/npm/v/telegraf-wikibase.svg)](https://www.npmjs.com/package/telegraf-wikibase)
[![node](https://img.shields.io/node/v/telegraf-wikibase.svg)](https://www.npmjs.com/package/telegraf-wikibase)
[![Build Status](https://travis-ci.com/EdJoPaTo/telegraf-wikibase.svg?branch=master)](https://travis-ci.com/EdJoPaTo/telegraf-wikibase)
[![Dependency Status](https://david-dm.org/EdJoPaTo/telegraf-wikibase/status.svg)](https://david-dm.org/EdJoPaTo/telegraf-wikibase)
[![Peer Dependency Status](https://david-dm.org/EdJoPaTo/telegraf-wikibase/peer-status.svg)](https://david-dm.org/EdJoPaTo/telegraf-wikibase?type=peer)
[![Dev Dependency Status](https://david-dm.org/EdJoPaTo/telegraf-wikibase/dev-status.svg)](https://david-dm.org/EdJoPaTo/telegraf-wikibase?type=dev)

> Telegraf Middleware to use Wikibase entities (like Wikidata ones) in your users language

This library is inspired by [telegraf-i18n](https://github.com/telegraf/telegraf-i18n) and was made to work with [Wikidata](https://wikidata.org/).


HINT: [wikibase-sdk](https://github.com/maxlath/wikibase-sdk) just went from being wikidata-sdk to be usable for wikibase in general.
As this process is ongoing this library only supports wikidata currently.
General Wikibase support is planned (soon…) and will propably only effect [WikidataEntityStore](https://github.com/EdJoPaTo/wikidata-entity-store)s interface.


## Install

```
$ npm install telegraf-wikibase telegraf wikidata-entity-reader
```


## Usage

```js
const TelegrafWikibase = require('telegraf-wikibase');

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

`store` to access requested resourceKeys or entity ids (Q-Numbers).

#### options

```ts
const options = {
	contextKey: 'wd'
}
```

`contextKey` determines the key where to reach the Context Methods.
Defaults to wb (`ctx.wb.reader`)


### Context Methods

#### locale

```ts
ctx.wb.locale(): string
```

Returns the currently set languageCode of the user.


```ts
ctx.wb.locale(languageCode: string): string
```
Set the languageCode to the `ctx.session` of the user.
Still returns the (newly set) languageCode of the user.

#### reader

```ts
async ctx.wb.reader(key: string): Promise<WikidataEntityReader>
async ctx.wb.r(key: string): Promise<WikidataEntityReader>
```

Returns the [`WikidataEntityReader`](https://github.com/EdJoPaTo/wikidata-entity-reader).
Use it with `.label()`, `.description()` and so on…
