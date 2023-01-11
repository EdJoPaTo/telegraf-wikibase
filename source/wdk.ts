import {type Entity} from 'wikibase-types';
import {arrayFilterUnique} from 'array-filter-unique';
// @ts-expect-error there are no types
import wdk from 'wikidata-sdk';

export declare type Property =
	| 'info'
	| 'sitelinks'
	| 'sitelinks/urls'
	| 'aliases'
	| 'labels'
	| 'descriptions'
	| 'claims'
	| 'datatype';
export declare type UrlResultFormat = 'json';
export type GetEntitiesOptions = {
	readonly ids: string | readonly string[];
	readonly languages?: string | readonly string[];
	readonly props?: Property | readonly Property[];
	readonly format?: UrlResultFormat;
};
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
	options: GetEntitiesOptions,
	fetchOptions: RequestInit = {},
): Promise<Record<string, Entity>> {
	const allIds = Array.isArray(options.ids) ? options.ids : [options.ids];
	const ids = allIds.filter(arrayFilterUnique());

	const saneOptions: GetEntitiesOptions = {
		...options,
		format: 'json',
		ids,
	};

	// eslint-disable-next-line @typescript-eslint/no-unsafe-call
	const urls = wdk.getManyEntities(saneOptions) as readonly string[];
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
	options: GetEntitiesOptions,
	fetchOptions: RequestInit = {},
): Promise<Record<string, EntitySimplified>> {
	const entities = await getEntities(options, fetchOptions);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-call
	return wdk.simplify.entities(entities) as Record<string, EntitySimplified>;
}
