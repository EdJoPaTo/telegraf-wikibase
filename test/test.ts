import {KeyValueInMemory} from '@edjopato/datastore';
import Telegraf from 'telegraf';
import test, {ExecutionContext} from 'ava';
import WikidataEntityStore, {EntityEntry} from 'wikidata-entity-store';

import TelegrafWikibase, {Options, MiddlewareProperty} from '../source';

interface Context {
	wb: MiddlewareProperty;
	session?: {
		__wikibase_language_code?: string;
	};
}

test('can be used as middleware', t => {
	const bot = new Telegraf('');
	t.notThrows(() => {
		bot.use(new TelegrafWikibase(new WikidataEntityStore()).middleware());
	});
});

async function macro(
	t: ExecutionContext,
	options: Options,
	pre: (ctx: Context) => Promise<void> | void,
	env: (ctx: Context, t: ExecutionContext) => Promise<void> | void,
	update: any = {}
): Promise<void> {
	const entityStore = new KeyValueInMemory<EntityEntry>();
	entityStore.set('Q5', {
		entity: {
			type: 'item',
			id: 'Q5'
		},
		lastUpdate: 0
	});
	entityStore.set('Q2', {
		entity: {
			type: 'item',
			id: 'Q2',
			labels: {
				de: 'Erde',
				en: 'earth'
			}
		},
		lastUpdate: 0
	});
	entityStore.set('Q146', {
		entity: {
			type: 'item',
			id: 'Q146',
			labels: {
				de: 'Hauskatze',
				en: 'house cat'
			}
		},
		lastUpdate: 0
	});

	const store = new WikidataEntityStore({
		entityStore
	});
	await store.addResourceKeyDict({human: 'Q5', earth: 'Q2'});

	const bot = new Telegraf('');
	bot.use(async (ctx: any, next) => {
		ctx.session = {};
		await pre(ctx);
		return next && next();
	});

	bot.use(new TelegrafWikibase(store, options).middleware());

	bot.use(async (ctx: any) => {
		await env(ctx, t);
	});

	await bot.handleUpdate(update);
}

test('context has wb object', macro, {}, () => {}, (ctx, t) => {
	t.truthy(ctx.wb);
});

test('contextKey can be changed', macro, {
	contextKey: 'wd'
}, () => {}, (ctx: any, t) => {
	t.falsy(ctx.wb);
	t.truthy(ctx.wd);
});

test('fallback language is default language', macro, {}, () => {}, (ctx, t) => {
	t.is(ctx.wb.locale(), 'en');
});

test('language is read from ctx.from', macro, {}, () => {}, (ctx, t) => {
	t.is(ctx.wb.locale(), 'de');
}, {message: {from: {language_code: 'de'}}});

test('language from ctx.from is saved on session', macro, {}, () => {}, (ctx, t) => {
	t.is(ctx.session!.__wikibase_language_code, 'de');
}, {message: {from: {language_code: 'de'}}});

test('language is read from session', macro, {}, ctx => {
	ctx.session!.__wikibase_language_code = 'am';
}, (ctx, t) => {
	t.is(ctx.wb.locale(), 'am');
}, {message: {from: {language_code: 'de'}}});

test('language does not fail without session', macro, {}, ctx => {
	delete ctx.session;
}, (ctx, t) => {
	t.is(ctx.wb.locale(), 'de');
}, {message: {from: {language_code: 'de'}}});

test('locale can be set', macro, {}, () => {}, (ctx, t) => {
	ctx.wb.locale('de');
	t.is(ctx.session!.__wikibase_language_code, 'de');
});

test('get reader works', macro, {}, () => {}, (ctx, t) => {
	const reader = ctx.wb.r('human');
	t.is(reader.label(), 'Q5');
});

test('localeProgress available', macro, {}, () => {}, (ctx, t) => {
	t.is(ctx.wb.localeProgress('de'), 2 / 3);
});

test('localeProgress unavailable is 0', macro, {}, () => {}, (ctx, t) => {
	t.is(ctx.wb.localeProgress('am'), 0);
});

test('localeProgress of user', macro, {}, () => {}, (ctx, t) => {
	t.is(ctx.wb.locale(), 'en', 'sanity check');
	t.is(ctx.wb.localeProgress(), 2 / 3);
});

test('allLocaleProgress', macro, {}, () => {}, (ctx, t) => {
	t.deepEqual(ctx.wb.allLocaleProgress(), {
		de: 2 / 3,
		en: 2 / 3
	});
});

test('availableLocales', macro, {}, () => {}, (ctx, t) => {
	t.deepEqual(ctx.wb.availableLocales(), [
		'de', 'en'
	]);
});

test('availableLocales with high standards', macro, {}, () => {}, (ctx, t) => {
	t.deepEqual(ctx.wb.availableLocales(1), []);
});

test('availableLocales on class itself', macro, {}, () => {}, (_ctx, t) => {
	const store = new WikidataEntityStore();
	t.deepEqual(new TelegrafWikibase(store).availableLocales(), []);
});
