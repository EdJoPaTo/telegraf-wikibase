import WikidataEntityReader from 'wikidata-entity-reader';
import WikidataEntityStore from 'wikidata-entity-store';

type KeyFunc<Result> = (key: string) => Result;
type ReaderFunc = KeyFunc<WikidataEntityReader>;
type Session = {__wikibase_language_code?: string} | undefined;

export interface MiddlewareProperty {
	readonly allLocaleProgress: () => Record<string, number>;
	readonly availableLocales: (percentageOfLabelsRequired?: number) => readonly string[];
	readonly localeProgress: (languageCode?: string, useBaseLanguageCode?: boolean) => number;
	readonly locale: (languageCode?: string) => string;
	readonly r: ReaderFunc;
	readonly reader: ReaderFunc;
	readonly store: WikidataEntityStore;
}

export interface Options {
	readonly contextKey?: string;
}

export default class TelegrafWikibase {
	private readonly _defaultLanguageCode: string;

	private readonly _contextKey: string;

	constructor(
		private readonly _store: WikidataEntityStore,
		options: Options = {}
	) {
		this._defaultLanguageCode = 'en';
		this._contextKey = options.contextKey ?? 'wb';
	}

	localeProgress(languageCode: string, useBaseLanguageCode = true): number {
		const code = useBaseLanguageCode ? languageCode.split('-')[0] : languageCode;
		return this.allLocaleProgress()[code] || 0;
	}

	allLocaleProgress(): Record<string, number> {
		const allEntries = this._store.allEntities();
		const localeProgress = allEntries
			.flatMap(o => Object.keys(o.labels ?? {}))
			.reduce((coll: Record<string, number>, add) => {
				if (!coll[add]) {
					coll[add] = 0;
				}

				coll[add] += 1 / allEntries.length;
				return coll;
			}, {});

		return localeProgress;
	}

	availableLocales(percentageOfLabelsRequired = 0.1): readonly string[] {
		const localeProgress = this.allLocaleProgress();
		return Object.keys(localeProgress)
			.filter(o => localeProgress[o] > percentageOfLabelsRequired)
			.sort((a, b) => a.localeCompare(b));
	}

	middleware(): (ctx: any, next: () => Promise<void>) => Promise<void> {
		return async (ctx, next) => {
			// TODO: generalize the session attribute
			const session = ctx.session as Session;
			if (session && !session.__wikibase_language_code && ctx.from) {
				session.__wikibase_language_code = ctx.from.language_code;
			}

			const readerFunc: ReaderFunc = key => this._reader(key, this._lang(ctx));

			const middlewareProperty: MiddlewareProperty = {
				r: readerFunc,
				reader: readerFunc,
				store: this._store,
				allLocaleProgress: () => this.allLocaleProgress(),
				availableLocales: (percentageOfLabelsRequired = 0.1) => this.availableLocales(percentageOfLabelsRequired),
				localeProgress: (languageCode?: string, useBaseLanguageCode?: boolean) => this.localeProgress(languageCode ?? this._lang(ctx), useBaseLanguageCode),
				locale: (languageCode?: string) => {
					if (languageCode && session) {
						session.__wikibase_language_code = languageCode;
						return languageCode;
					}

					return this._lang(ctx);
				}
			};

			ctx[this._contextKey] = middlewareProperty;
			return next();
		};
	}

	/**
	 * Generate the reader. Set the languageCode as the generated readers default language code.
	 */
	private _reader(key: string, languageCode: string): WikidataEntityReader {
		return new WikidataEntityReader(this._store.entity(key), languageCode);
	}

	/*
	 * Get the users language code.
	 */
	private _lang(ctx: any): string {
		let lang: string | undefined;

		// TODO: generalize the session attribute
		const session = ctx.session as Session;
		if (session) {
			lang = session.__wikibase_language_code;
		}

		if (!lang && ctx.from) {
			lang = ctx.from.language_code;
		}

		if (!lang) {
			lang = this._defaultLanguageCode;
		}

		return lang;
	}
}

// For CommonJS default export support
module.exports = TelegrafWikibase;
module.exports.default = TelegrafWikibase;
