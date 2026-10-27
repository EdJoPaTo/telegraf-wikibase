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
	const result: Record<string, Entity> = {};
	// eslint-disable-next-line @typescript-eslint/await-thenable
	for await (const url of urls) {
		const response = await fetch(url, fetchOptions);
		if (!response.ok) {
			const body = await response.text();
			console.error(
				'Wikidata request failed',
				response.status,
				response.statusText,
				body,
			);
			continue;
		}

		const jsonBody = await response.json() as {
			entities: Readonly<Record<string, Entity>>;
		};
		Object.assign(result, jsonBody.entities);
	}

	return result;
}
