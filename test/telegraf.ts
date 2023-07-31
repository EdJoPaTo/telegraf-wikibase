import {type Context as BaseContext, Telegraf} from 'telegraf';
import test, {type ExecutionContext} from 'ava';
import {type MiddlewareProperty, type Options, TelegrafWikibase} from '../source/index.js';

type Context = {
	readonly wb: MiddlewareProperty;
	session?: {
		__wikibase_language_code?: string;
	};
};

type MyContext = Context & BaseContext;

test('can be used as middleware', t => {
	const bot = new Telegraf<MyContext>('123:ABC');
	t.notThrows(() => {
		bot.use(new TelegrafWikibase().middleware());
	});
});

const macro = test.macro(async (t,
	options: Options,
	pre: (ctx: Context) => Promise<void> | void,
	env: (ctx: Context, t: ExecutionContext) => Promise<void> | void,
	update: any = {},
) => {
	const entityStore = new Map();
	(entityStore as any).ttlSupport = true;
	entityStore.set('Q5', {
		type: 'item',
		id: 'Q5',
	});
	entityStore.set('Q2', {
		type: 'item',
		id: 'Q2',
		labels: {
			de: 'Erde',
			'de-ch': 'Erde',
			en: 'earth',
		},
	});
	entityStore.set('Q146', {
		type: 'item',
		id: 'Q146',
		labels: {
			de: 'Hauskatze',
			en: 'house cat',
		},
	});

	const bot = new Telegraf<MyContext>('123:ABC');
	(bot as any).botInfo = {};
	bot.use(async (ctx, next) => {
		ctx.session = {};
		await pre(ctx);
		return next();
	});

	const twb = new TelegrafWikibase({store: entityStore, ...options});
	twb.addResourceKeys({human: 'Q5', earth: 'Q2', cat: 'Q146'});

	bot.use(twb.middleware());

	bot.use(async ctx => {
		await env(ctx, t);
	});

	// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
	await bot.handleUpdate(update);
});

test('context has wb object', macro, {}, () => {}, (ctx, t) => {
	t.truthy(ctx.wb);
});

test('contextKey can be changed', macro, {
	contextKey: 'wd',
}, () => {}, (ctx, t) => {
	t.falsy(ctx.wb);
	// @ts-expect-error changed key but not in type
	t.truthy(ctx.wd);
});

test('fallback language is default language', macro, {}, () => {}, (ctx, t) => {
	t.is(ctx.wb.locale(), 'en');
});

test('language is read from ctx.from', macro, {}, () => {}, (ctx, t) => {
	t.is(ctx.wb.locale(), 'de');
}, {message: {from: {language_code: 'de'}}});

test('language from ctx.from is saved on session', macro, {}, () => {}, (ctx, t) => {
	t.is(ctx.session?.__wikibase_language_code, 'de');
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
	t.is(ctx.session?.__wikibase_language_code, 'de');
});

test('get reader works', macro, {}, () => {}, async (ctx, t) => {
	const reader = await ctx.wb.reader('human');
	t.is(reader.label(), 'Q5');
});

test('localeProgress available', macro, {}, () => {}, async (ctx, t) => {
	t.is(await ctx.wb.localeProgress('de'), 2 / 3);
});

test('localeProgress available sublanguage', macro, {}, () => {}, async (ctx, t) => {
	t.is(await ctx.wb.localeProgress('de-ch'), 2 / 3);
});

test('localeProgress available sublanguage but doesnt uses base-language', macro, {}, () => {}, async (ctx, t) => {
	t.is(await ctx.wb.localeProgress('de-ch', false), 1 / 3);
});

test('localeProgress unavailable is 0', macro, {}, () => {}, async (ctx, t) => {
	t.is(await ctx.wb.localeProgress('am'), 0);
});

test('localeProgress of user', macro, {}, () => {}, async (ctx, t) => {
	t.is(ctx.wb.locale(), 'en', 'sanity check');
	t.is(await ctx.wb.localeProgress(), 2 / 3);
});

test('allLocaleProgress', macro, {}, () => {}, async (ctx, t) => {
	t.deepEqual(await ctx.wb.allLocaleProgress(), {
		de: 2 / 3,
		'de-ch': 1 / 3,
		en: 2 / 3,
	});
});

test('availableLocales', macro, {}, () => {}, async (ctx, t) => {
	t.deepEqual(await ctx.wb.availableLocales(), ['de', 'en']);
});

test('availableLocales with high standards', macro, {}, () => {}, async (ctx, t) => {
	t.deepEqual(await ctx.wb.availableLocales(1), []);
});

test('availableLocales on class itself', macro, {}, () => {}, async (_ctx, t) => {
	t.deepEqual(await new TelegrafWikibase().availableLocales(), []);
});
