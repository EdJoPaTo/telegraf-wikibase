import {arrayFilterUnique} from 'array-filter-unique';
import type {Entity} from 'wikibase-sdk';
import {wdk} from 'wikibase-sdk/wikidata.org';

type Wbk = typeof wdk;
type GetManyEntitiesOptions = Readonly<Parameters<Wbk['getManyEntities']>[0]>;

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
			const body = await response.json() as {entities: Readonly<Record<string, Entity>>};
			return body.entities;
		}),
	);

	return Object.fromEntries(
		entityDictionaryArray.flatMap(o => Object.entries(o)),
	);
}
