import {Cache, TtlKeyValueInMemory} from '@edjopato/datastore';
import {getEntitiesSimplified, EntitySimplified} from 'wikidata-sdk-got';
import {isEntityId} from 'wikibase-types';
import WikidataEntityReader from 'wikidata-entity-reader';

export * from './resource-keys';

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
	readonly ttlSupport?: boolean;
	readonly get: (key: string) => MaybePromise<T | undefined>;
	readonly set: (key: string, value: T, ttl?: number) => MaybePromise<unknown>;
}

export interface MiddlewareProperty {
	readonly allLocaleProgress: () => Promise<Record<string, number>>;
	readonly availableLocales: (percentageOfLabelsRequired?: number) => Promise<readonly string[]>;
	readonly localeProgress: (languageCode?: string, useBaseLanguageCode?: boolean) => Promise<number>;
	readonly locale: (languageCode?: string) => string;
	readonly reader: (keyOrEntityId: string, language?: string) => Promise<WikidataEntityReader>;
	readonly preload: (keysOrEntityIds: readonly string[]) => Promise<void>;
}

export interface Options {
	/**
	 * Key under which the MiddlewareProperty can be accessed in the ctx. Defaults to ctx.wb
	 */
	readonly contextKey?: string;

	/**
	 * Logs when entities are queried as they are not (anymore) in the cache.
	 * Helps with debugging: When there are a bulk of single queries they could have preloaded first.
	 */
	readonly logQueriedEntityIds?: boolean;

	/**
	 * Store object which keeps the entities. Can be used to store more persistent than in memory.
	 * In order to always use up to date wikidata entities use a store with ttl support.
	 */
	readonly store?: Store<EntitySimplified>;

	/**
	 * Time to live of entities within the cache in milliseconds.
	 * When the time is passed the entity will be removed from the cache.
	 * When not set this defaults to 6 hours.
	 */
	readonly ttl?: number;

	/**
	 * User Agent which is used to query the items
	 */
	readonly userAgent?: string;
}

const DEFAULT_TTL = 6 * 60 * 60 * 1000; // 6 hours

export class TelegrafWikibase {
	private readonly _resourceKeys = new Map<string, string>();

	private readonly _entityCache: Cache<EntitySimplified>;

	private readonly _defaultLanguageCode: string;

	private readonly _contextKey: string;

	private readonly _ttl: number;

	constructor(
		options: Options = {},
	) {
		this._defaultLanguageCode = 'en';
		this._contextKey = options.contextKey ?? 'wb';

		const store: Store<EntitySimplified> = options.store ?? new TtlKeyValueInMemory();
		if (!store.ttlSupport) {
			console.log('TelegrafWikibase', 'consider using a store with ttl support');
		}

		this._ttl = options.ttl ?? DEFAULT_TTL;

		this._entityCache = new Cache({bulkQuery: async ids => {
			if (options.logQueriedEntityIds) {
				console.log('TelegrafWikibase getEntities', ids.length, ids);
			}

			return getEntitiesSimplified({ids}, {headers: {'user-agent': options.userAgent ?? 'some unspecified project depending on github.com/EdJoPaTo/telegraf-wikibase'}});
		}}, {
			store,
			ttl: this._ttl,
		});
	}

	addResourceKeys(resourceKeys: Readonly<Record<string, string>>): void {
		for (const [key, newValue] of Object.entries(resourceKeys)) {
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
	 * Will update the resource keys regularly so they are always available.
	 * @param errorHandler Will be called when the updating failed
	 */
	async startRegularResourceKeyUpdate(errorHandler?: (error: unknown) => void | Promise<void>): Promise<NodeJS.Timeout> {
		await this._entityCache.getMany([...this._resourceKeys.values()], true);

		return setInterval(async () => {
			try {
				await this._entityCache.getMany([...this._resourceKeys.values()], true);
			} catch (error: unknown) {
				if (errorHandler) {
					await errorHandler(error);
				}
			}
		}, this._ttl * 0.95);
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
		const code = useBaseLanguageCode ? languageCode.split('-')[0]! : languageCode;
		const progress = await this.allLocaleProgress();
		return progress[code] ?? 0;
	}

	async allLocaleProgress(): Promise<Record<string, number>> {
		const allResourceKeyEntityIds = [...this._resourceKeys.values()];
		const all = await this._entityCache.getMany(allResourceKeyEntityIds);
		const allEntries = Object.values(all);

		const localeProgress = allEntries
			.flatMap(o => Object.keys(o.labels ?? {}))
			// eslint-disable-next-line unicorn/no-array-reduce, @typescript-eslint/prefer-readonly-parameter-types
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
		return Object.entries(localeProgress)
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
			.filter(([_locale, progress]) => progress > percentageOfLabelsRequired)
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
			.map(([locale]) => locale)
			.sort((a, b) => a.localeCompare(b));
	}

	middleware(): (ctx: MinimalContext, next: () => Promise<void>) => Promise<void> {
		return async (ctx, next) => {
			if (ctx.session && !ctx.session.__wikibase_language_code && ctx.from?.language_code) {
				ctx.session.__wikibase_language_code = ctx.from.language_code;
			}

			await this.preload([...this._resourceKeys.values()]);

			const middlewareProperty: MiddlewareProperty = {
				reader: async (key, language) => this.reader(key, language ?? this._lang(ctx)),
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
				},
			};

			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
