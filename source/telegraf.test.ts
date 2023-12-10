import {deepStrictEqual, ok, strictEqual} from 'node:assert';
import {test} from 'node:test';
import {type Context as BaseContext, Telegraf} from 'telegraf';
import {
	type MiddlewareProperty,
	type Options,
	TelegrafWikibase,
} from './index.js';

type Context = {
	readonly wb: MiddlewareProperty;
	session?: {
		__wikibase_language_code?: string;
	};
};

type MyContext = Context & BaseContext;

await test('Telegraf', async t => {
	await t.test('can be used as middleware', () => {
		const bot = new Telegraf<MyContext>('123:ABC');
		const entityStore = new Map();
		(entityStore as any).ttlSupport = true;
		const twb = new TelegrafWikibase({store: entityStore});
		bot.use(twb.middleware());
	});

	const macro = async (
		title: string,
		options: Options,
		pre: (ctx: Context) => Promise<void> | void,
		env: (ctx: Context) => Promise<void> | void,
		update: any = {},
	) =>
		t.test(title, async () => {
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
				await env(ctx);
			});

			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			await bot.handleUpdate(update);
		});

	await macro('context has wb object', {}, () => {}, ctx => {
		ok(ctx.wb);
	});

	await macro(
		'contextKey can be changed',
		{
			contextKey: 'wd',
		},
		() => {},
		ctx => {
			ok(!ctx.wb);
			// @ts-expect-error changed key but not in type
			ok(ctx.wd);
		},
	);

	await macro('fallback language is default language', {}, () => {}, ctx => {
		strictEqual(ctx.wb.locale(), 'en');
	});

	await macro('language is read from ctx.from', {}, () => {}, ctx => {
		strictEqual(ctx.wb.locale(), 'de');
	}, {message: {from: {language_code: 'de'}}});

	await macro(
		'language from ctx.from is saved on session',
		{},
		() => {},
		ctx => {
			strictEqual(ctx.session?.__wikibase_language_code, 'de');
		},
		{message: {from: {language_code: 'de'}}},
	);

	await macro('language is read from session', {}, ctx => {
		ctx.session!.__wikibase_language_code = 'am';
	}, ctx => {
		strictEqual(ctx.wb.locale(), 'am');
	}, {message: {from: {language_code: 'de'}}});

	await macro('language does not fail without session', {}, ctx => {
		delete ctx.session;
	}, ctx => {
		strictEqual(ctx.wb.locale(), 'de');
	}, {message: {from: {language_code: 'de'}}});

	await macro('locale can be set', {}, () => {}, ctx => {
		ctx.wb.locale('de');
		strictEqual(ctx.session?.__wikibase_language_code, 'de');
	});

	await macro('get reader works', {}, () => {}, async ctx => {
		const reader = await ctx.wb.reader('human');
		strictEqual(reader.label(), 'Q5');
	});

	await macro('localeProgress available', {}, () => {}, async ctx => {
		strictEqual(await ctx.wb.localeProgress('de'), 2 / 3);
	});

	await macro(
		'localeProgress available sublanguage',
		{},
		() => {},
		async ctx => {
			strictEqual(await ctx.wb.localeProgress('de-ch'), 2 / 3);
		},
	);

	await macro(
		'localeProgress available sublanguage but doesnt uses base-language',
		{},
		() => {},
		async ctx => {
			strictEqual(await ctx.wb.localeProgress('de-ch', false), 1 / 3);
		},
	);

	await macro('localeProgress unavailable is 0', {}, () => {}, async ctx => {
		strictEqual(await ctx.wb.localeProgress('am'), 0);
	});

	await macro('localeProgress of user', {}, () => {}, async ctx => {
		strictEqual(ctx.wb.locale(), 'en', 'sanity check');
		strictEqual(await ctx.wb.localeProgress(), 2 / 3);
	});

	await macro('allLocaleProgress', {}, () => {}, async ctx => {
		deepStrictEqual(await ctx.wb.allLocaleProgress(), {
			de: 2 / 3,
			'de-ch': 1 / 3,
			en: 2 / 3,
		});
	});

	await macro('availableLocales', {}, () => {}, async ctx => {
		deepStrictEqual(await ctx.wb.availableLocales(), ['de', 'en']);
	});

	await macro(
		'availableLocales with high standards',
		{},
		() => {},
		async ctx => {
			deepStrictEqual(await ctx.wb.availableLocales(1), []);
		},
	);

	await t.test(
		'availableLocales on class itself',
		async () => {
			const entityStore = new Map();
			(entityStore as any).ttlSupport = true;
			const twb = new TelegrafWikibase({store: entityStore});
			deepStrictEqual(await twb.availableLocales(), []);
		},
	);
});
