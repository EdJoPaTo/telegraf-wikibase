import {arrayFilterUnique} from 'array-filter-unique';
import {simplify} from 'wikibase-sdk';
// eslint-disable-next-line n/file-extension-in-import
import {wdk} from 'wikibase-sdk/wikidata.org';
import type {Entity} from 'wikibase-types';

type Wbk = typeof wdk;

export type GetManyEntitiesOptions = Readonly<Parameters<Wbk['getManyEntities']>[0]>;
export type EntityId = GetManyEntitiesOptions['ids'][number];
export declare type ClaimSimplified = unknown;
export type EntitySimplified = {
	readonly type: string;
	readonly id: EntityId;
	readonly modified?: string;
	readonly aliases?: Readonly<Record<string, readonly string[]>>;
	readonly claims?: Readonly<Record<string, readonly ClaimSimplified[]>>;
	readonly descriptions?: Readonly<Record<string, string>>;
	readonly labels?: Readonly<Record<string, string>>;
	readonly sitelinks?: Readonly<Record<string, string>>;
};

export async function getEntities(
	options: GetManyEntitiesOptions,
	fetchOptions: RequestInit = {},
): Promise<Record<string, Entity>> {
	const urls = wdk.getManyEntities({
		...options,
		format: 'json',
		ids: options.ids.filter(arrayFilterUnique()),
	});
	const entityDictionaryArray = await Promise.all(
		urls.map(async o => {
			const response = await fetch(o, fetchOptions);
			const body = await response.json() as {entities: unknown};
			return body.entities as Readonly<Record<string, Entity>>;
		}),
	);

	return Object.fromEntries(
		entityDictionaryArray.flatMap(o => Object.entries(o)),
	);
}

export async function getEntitiesSimplified(
	options: GetManyEntitiesOptions,
	fetchOptions: RequestInit = {},
): Promise<Record<string, EntitySimplified>> {
	const entities = await getEntities(options, fetchOptions);
	// @ts-expect-error typings are missing currently for simplify.entities
	// eslint-disable-next-line @typescript-eslint/no-unsafe-call
	return simplify.entities(entities) as Record<string, EntitySimplified>;
}
