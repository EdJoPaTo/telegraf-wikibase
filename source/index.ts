import WikidataEntityReader from 'wikidata-entity-reader';
import WikidataEntityStore from 'wikidata-entity-store';

type KeyFunc<Result> = (key: string) => Result;
type ReaderFunc = KeyFunc<WikidataEntityReader>;

export interface MiddlewareProperty {
	locale: (languageCode?: string) => string;
	r: ReaderFunc;
	reader: ReaderFunc;
	store: WikidataEntityStore;
}

export interface Options {
	contextKey?: string;
}

export default class TelegrafWikibase {
	private readonly _defaultLanguageCode = 'en';

	private readonly _contextKey: string = 'wb';

	constructor(
		private readonly store: WikidataEntityStore,
		options: Options = {}
	) {
		if (options.contextKey) {
			this._contextKey = options.contextKey;
		}
	}

	middleware(): (ctx: any, next: any) => void {
		return (ctx, next) => {
			const readerFunc: ReaderFunc = key => this._reader(key, this._lang(ctx));

			const middlewareProperty: MiddlewareProperty = {
				r: readerFunc,
				reader: readerFunc,
				store: this.store,
				locale: (languageCode?: string) => {
					if (languageCode && ctx.session) {
						ctx.session.__wikibase_language_code = languageCode;
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
		return new WikidataEntityReader(this.store.entity(key), languageCode);
	}

	/*
	 * Get the users language code.
	 */
	private _lang(ctx: any): string {
		let lang;

		// TODO: generalize the session attribute
		if (ctx.session) {
			lang = ctx.session.__wikibase_language_code;
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
