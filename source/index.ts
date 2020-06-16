import {Cache} from '@edjopato/datastore';
import {EntitySimplified} from 'wikidata-sdk-got/dist/source/wikibase-sdk-types';
import {getEntitiesSimplified} from 'wikidata-sdk-got';
import {isEntityId} from 'wikibase-types';
import WikidataEntityReader from 'wikidata-entity-reader';

export * from './resource-keys';

type ReaderFunc = (keyOrEntityId: string) => Promise<WikidataEntityReader>;

interface MinimalContext {
	readonly from?: {
		readonly language_code?: string;
	};

	readonly session?: {
		__wikibase_language_code?: string;
	};
}

type MaybePromise<T> = T | Promise<T>;
interface Store<T> {
	readonly get: (key: string) => MaybePromise<T | undefined>;
	readonly set: (key: string, value: T, ttl?: number) => MaybePromise<unknown>;
}

export interface MiddlewareProperty {
	readonly allLocaleProgress: () => Promise<Record<string, number>>;
	readonly availableLocales: (percentageOfLabelsRequired?: number) => Promise<readonly string[]>;
	readonly localeProgress: (languageCode?: string, useBaseLanguageCode?: boolean) => Promise<number>;
	readonly locale: (languageCode?: string) => string;
	readonly reader: ReaderFunc;
	readonly preload: (keysOrEntityIds: readonly string[]) => Promise<void>;
}

export interface Options {
	readonly contextKey?: string;

	/**
	 * User Agent which is used to query the items
	 */
	readonly userAgent?: string;
}

export class TelegrafWikibase {
	private readonly _resourceKeys: Map<string, string> = new Map();

	private readonly _entityCache: Cache<EntitySimplified>;

	private readonly _defaultLanguageCode: string;

	private readonly _contextKey: string;

	constructor(
		store: Store<EntitySimplified> = new Map(),
		options: Options = {}
	) {
		this._defaultLanguageCode = 'en';
		this._contextKey = options.contextKey ?? 'wb';

		this._entityCache = new Cache({bulkQuery: async ids => {
			return getEntitiesSimplified({ids}, {headers: {'user-agent': options.userAgent ?? 'some unspecified project depending on github.com/EdJoPaTo/telegraf-wikibase'}});
		}}, {
			store,
			ttl: 2 * 60 * 60 * 1000 // 2 hours
		});
	}

	addResourceKeys(resourceKeys: Readonly<Record<string, string>>): void {
		for (const key of Object.keys(resourceKeys)) {
			const newValue = resourceKeys[key];
			const existingValue = this._resourceKeys.get(key);
			if (existingValue && existingValue !== newValue) {
				throw new Error(`key ${key} already exists with a different value: ${newValue} !== ${existingValue}`);
			}

			this._resourceKeys.set(key, newValue);
		}
	}

	entityIdFromKey(keyOrEntityId: string): string {
		const resourceKeyEntityId = this._resourceKeys.get(keyOrEntityId);
		if (resourceKeyEntityId) {
			return resourceKeyEntityId;
		}

		if (!isEntityId(keyOrEntityId)) {
			throw new Error(`Argument is neither a resourceKey or an entity id: ${String(keyOrEntityId)}`);
		}

		return keyOrEntityId;
	}

	/**
	 * Generate the reader. Set the languageCode as the generated readers default language code.
	 */
	async reader(keyOrEntityId: string, languageCode: string): Promise<WikidataEntityReader> {
		const entityId = this.entityIdFromKey(keyOrEntityId);
		const entity = await this._entityCache.get(entityId);
		return new WikidataEntityReader(entity, languageCode);
	}

	/**
	 * Preload a bunch of entities in one run.
	 * This is more effective than getting a bunch of entities on their own.
	 * @param keysOrEntityIds keys or entity ids to be preloaded
	 */
	async preload(keysOrEntityIds: readonly string[]): Promise<void> {
		const entityIds = keysOrEntityIds.map(o => this.entityIdFromKey(o));
		await this._entityCache.getMany(entityIds);
	}

	async localeProgress(languageCode: string, useBaseLanguageCode = true): Promise<number> {
		const code = useBaseLanguageCode ? languageCode.split('-')[0] : languageCode;
		const progress = await this.allLocaleProgress();
		return progress[code] || 0;
	}

	async allLocaleProgress(): Promise<Record<string, number>> {
		const allResourceKeyEntityIds = [...this._resourceKeys.values()];
		const all = await this._entityCache.getMany(allResourceKeyEntityIds);
		const allEntries = Object.values(all);

		const localeProgress = allEntries
			.flatMap(o => Object.keys(o.labels ?? {}))
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
			.reduce((coll: Record<string, number>, add) => {
				if (!coll[add]) {
					coll[add] = 0;
				}

				coll[add] += 1 / allEntries.length;
				return coll;
			}, {});

		return localeProgress;
	}

	async availableLocales(percentageOfLabelsRequired = 0.5): Promise<readonly string[]> {
		const localeProgress = await this.allLocaleProgress();
		return Object.keys(localeProgress)
			.filter(o => localeProgress[o] > percentageOfLabelsRequired)
			.sort((a, b) => a.localeCompare(b));
	}

	middleware(): (ctx: MinimalContext, next: () => Promise<void>) => Promise<void> {
		return async (ctx, next) => {
			if (ctx.session && !ctx.session.__wikibase_language_code && ctx.from?.language_code) {
				ctx.session.__wikibase_language_code = ctx.from.language_code;
			}

			await this.preload([...this._resourceKeys.values()]);

			const middlewareProperty: MiddlewareProperty = {
				reader: async key => this.reader(key, this._lang(ctx)),
				preload: async (keysOrEntityIds: readonly string[]) => this.preload(keysOrEntityIds),
				allLocaleProgress: async () => this.allLocaleProgress(),
				availableLocales: async (percentageOfLabelsRequired = 0.5) => this.availableLocales(percentageOfLabelsRequired),
				localeProgress: async (languageCode?: string, useBaseLanguageCode?: boolean) => this.localeProgress(languageCode ?? this._lang(ctx), useBaseLanguageCode),
				locale: (languageCode?: string) => {
					if (languageCode && ctx.session) {
						ctx.session.__wikibase_language_code = languageCode;
						return languageCode;
					}

					return this._lang(ctx);
				}
			};

			(ctx as any)[this._contextKey] = middlewareProperty;
			return next();
		};
	}

	/*
	 * Get the users language code.
	 */
	private _lang(ctx: MinimalContext): string {
		return ctx.session?.__wikibase_language_code ?? ctx.from?.language_code ?? this._defaultLanguageCode;
	}
}
