import {arrayFilterUnique} from 'array-filter-unique';
// eslint-disable-next-line n/file-extension-in-import
import {wdk} from 'wikibase-sdk/wikidata.org';
import type {Entity} from 'wikibase-types';

type Wbk = typeof wdk;

export declare type Property =
	| 'info'
	| 'sitelinks'
	| 'sitelinks/urls'
	| 'aliases'
	| 'labels'
	| 'descriptions'
	| 'claims'
	| 'datatype';
export type GetManyEntitiesOptions = Readonly<Parameters<Wbk['getManyEntities']>[0]>;
export declare type ClaimSimplified = unknown;
export type EntitySimplified = {
	readonly type: string;
	readonly id: string;
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

	const entities: Record<string, Entity> = {};
	for (const entry of entityDictionaryArray) {
		for (const [key, value] of Object.entries(entry)) {
			entities[key] = value;
		}
	}

	return entities;
}

export async function getEntitiesSimplified(
	options: GetManyEntitiesOptions,
	fetchOptions: RequestInit = {},
): Promise<Record<string, EntitySimplified>> {
	const entities = await getEntities(options, fetchOptions);
	return wdk.simplify.entities(entities) as Record<string, EntitySimplified>;
}
