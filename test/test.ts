import Telegraf from 'telegraf';
import test, {ExecutionContext} from 'ava';
import WikidataEntityStore from 'wikidata-entity-store';

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
	const store = new WikidataEntityStore({
		entityStore: new Map([
			['Q5', {
				type: 'item',
				id: 'Q5'
			}],
			['Q2', {
				type: 'item',
				id: 'Q2',
				labels: {
					de: 'Erde',
					en: 'earth'
				}
			}],
			['Q146', {
				type: 'item',
				id: 'Q146',
				labels: {
					de: 'Hauskatze',
					en: 'house cat'
				}
			}]
		])
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

test('availableLocales', macro, {}, () => {}, (ctx, t) => {
	t.deepEqual(ctx.wb.availableLocales(), [
		'de', 'en'
	]);
});

test('availableLocales with high standards', macro, {}, () => {}, (ctx, t) => {
	t.deepEqual(ctx.wb.availableLocales(1.0), []);
});

test('availableLocales on class itself', macro, {}, () => {}, (_ctx, t) => {
	const store = new WikidataEntityStore();
	t.deepEqual(new TelegrafWikibase(store).availableLocales(), []);
});
