import {Cache, TtlKeyValueInMemory} from '@edjopato/datastore';
import {type Entity, type EntityId, isEntityId} from 'wikibase-sdk';
import {WikibaseEntityReader} from 'wikidata-entity-reader';
import {getEntities} from './wdk.js';

export type {WikibaseEntityReader} from 'wikidata-entity-reader';

export * from './resource-keys.js';

type MinimalContext = {
	readonly from?: {
		readonly language_code?: string;
	};

	readonly session?: {
		__wikibase_language_code?: string;
	};
};

type MaybePromise<T> = T | Promise<T>;
type Store<T> = {
	readonly ttlSupport?: boolean;
	readonly get: (key: string) => MaybePromise<T | undefined>;
	readonly set: (key: string, value: T, ttl?: number) => MaybePromise<unknown>;
};

export type MiddlewareProperty = {
	readonly allLocaleProgress: () => Promise<Record<string, number>>;
	readonly availableLocales: (percentageOfLabelsRequired?: number) => Promise<readonly string[]>;
	readonly localeProgress: (languageCode?: string, useBaseLanguageCode?: boolean) => Promise<number>;
	readonly locale: (languageCode?: string) => string;
	readonly reader: (keyOrEntityId: string, language?: string) => Promise<WikibaseEntityReader>;
	readonly preload: (keysOrEntityIds: readonly string[]) => Promise<void>;
};

export type Options = {
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
	readonly store?: Store<Entity>;

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
};

const DEFAULT_TTL = 6 * 60 * 60 * 1000; // 6 hours
const DEFAULT_USER_AGENT = 'some unspecified project depending on github.com/EdJoPaTo/telegraf-wikibase';

export class TelegrafWikibase {
	public readonly contextKey: string;

	public readonly ttl: number;

	readonly #resourceKeys = new Map<string, EntityId>();

	readonly #entityCache: Cache<EntityId, Entity>;

	constructor(
		options: Options = {},
	) {
		this.contextKey = options.contextKey ?? 'wb';
		this.ttl = options.ttl ?? DEFAULT_TTL;

		const store: Store<Entity> = options.store ?? new TtlKeyValueInMemory();
		if (!store.ttlSupport) {
			console.log(
				'TelegrafWikibase consider using a store with ttl support',
			);
		}

		const headers = new Headers();
		headers.set('user-agent', options.userAgent ?? DEFAULT_USER_AGENT);

		this.#entityCache = new Cache<EntityId, Entity>({
			async bulkQuery(ids) {
				if (options.logQueriedEntityIds) {
					console.log('TelegrafWikibase getEntities', ids.length, ids);
				}

				return getEntities({ids: [...ids]}, {headers});
			},
		}, {
			store,
			ttl: this.ttl,
		});
	}

	addResourceKeys(resourceKeys: Readonly<Record<string, EntityId>>): void {
		for (const [key, newValue] of Object.entries(resourceKeys)) {
			const existingValue = this.#resourceKeys.get(key);
			if (existingValue && existingValue !== newValue) {
				throw new Error(
					`key ${key} already exists with a different value: ${newValue} !== ${existingValue}`,
				);
			}

			this.#resourceKeys.set(key, newValue);
		}
	}

	entityIdFromKey(keyOrEntityId: string): EntityId {
		const resourceKeyEntityId = this.#resourceKeys.get(keyOrEntityId);
		if (resourceKeyEntityId) {
			return resourceKeyEntityId;
		}

		if (!isEntityId(keyOrEntityId)) {
			throw new Error(
				'Argument is neither a resourceKey or an entity id: ' + String(keyOrEntityId),
			);
		}

		return keyOrEntityId;
	}

	/**
	 * Generate the reader. Set the languageCode as the generated readers default language code.
	 */
	async reader(
		keyOrEntityId: string,
		languageCode: string,
	): Promise<WikibaseEntityReader> {
		const entityId = this.entityIdFromKey(keyOrEntityId);
		const entity = await this.#entityCache.get(entityId);
		return new WikibaseEntityReader(entity, languageCode);
	}

	/**
	 * Will update the resource keys regularly so they are always available.
	 * @param errorHandler Will be called when the updating failed
	 */
	async startRegularResourceKeyUpdate(
		errorHandler?: (error: unknown) => void | Promise<void>,
	): Promise<NodeJS.Timer> {
		await this.#entityCache.getMany([...this.#resourceKeys.values()], true);

		return setInterval(async () => {
			try {
				await this.#entityCache.getMany([...this.#resourceKeys.values()], true);
			} catch (error) {
				if (errorHandler) {
					await errorHandler(error);
				}
			}
		}, this.ttl * 0.95);
	}

	/**
	 * Preload a bunch of entities in one run.
	 * This is more effective than getting a bunch of entities on their own.
	 * @param keysOrEntityIds keys or entity ids to be preloaded
	 */
	async preload(keysOrEntityIds: readonly string[]): Promise<void> {
		const entityIds = keysOrEntityIds.map(o => this.entityIdFromKey(o));
		await this.#entityCache.getMany(entityIds);
	}

	async localeProgress(
		languageCode: string,
		useBaseLanguageCode = true,
	): Promise<number> {
		const code = useBaseLanguageCode
			? languageCode.split('-')[0]!
			: languageCode;
		const progress = await this.allLocaleProgress();
		return progress[code] ?? 0;
	}

	async allLocaleProgress(): Promise<Record<string, number>> {
		const allResourceKeyEntityIds = [...this.#resourceKeys.values()];
		const all = await this.#entityCache.getMany(allResourceKeyEntityIds);
		const allEntries = Object.values(all);

		const allLabels = allEntries
			.flatMap(o => Object.keys(('labels' in o && o.labels) ?? {}));

		const localeProgress: Record<string, number> = {};
		for (const add of allLabels) {
			localeProgress[add] ??= 0;
			localeProgress[add] += 1 / allEntries.length;
		}

		return localeProgress;
	}

	async availableLocales(
		percentageOfLabelsRequired = 0.5,
	): Promise<readonly string[]> {
		const localeProgress = await this.allLocaleProgress();
		return Object.entries(localeProgress)
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
			.filter(([_locale, progress]) => progress > percentageOfLabelsRequired)
			// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
			.map(([locale]) => locale)
			.sort((a, b) => a.localeCompare(b));
	}

	middleware(): (
		ctx: MinimalContext,
		next: () => Promise<void>,
	) => Promise<void> {
		return async (ctx, next) => {
			if (ctx.session && ctx.from?.language_code) {
				ctx.session.__wikibase_language_code ||= ctx.from.language_code;
			}

			await this.preload([...this.#resourceKeys.values()]);

			const middlewareProperty: MiddlewareProperty = {
				reader: async (key, language) =>
					this.reader(key, language ?? this._lang(ctx)),
				preload: async (keysOrEntityIds: readonly string[]) =>
					this.preload(keysOrEntityIds),
				allLocaleProgress: async () => this.allLocaleProgress(),
				availableLocales: async (percentageOfLabelsRequired = 0.5) =>
					this.availableLocales(percentageOfLabelsRequired),
				localeProgress: async (languageCode?: string, useBaseLanguageCode?: boolean) =>
					this.localeProgress(languageCode ?? this._lang(ctx), useBaseLanguageCode),
				locale: (languageCode?: string) => {
					if (languageCode && ctx.session) {
						ctx.session.__wikibase_language_code = languageCode;
						return languageCode;
					}

					return this._lang(ctx);
				},
			};

			// @ts-expect-error key indexing an interface without key index
			ctx[this.contextKey] = middlewareProperty;
			return next();
		};
	}

	/*
	 * Get the users language code.
	 */
	private _lang(ctx: MinimalContext): string {
		return ctx.session?.__wikibase_language_code
			?? ctx.from?.language_code
			?? 'en';
	}
}
