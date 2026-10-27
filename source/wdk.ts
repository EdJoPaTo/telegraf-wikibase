import {arrayFilterUnique} from 'array-filter-unique';
import {type Entity, type EntityId, WBK} from 'wikibase-sdk';

export function getEntitiesFactory(
	instanceApiEndpoint: string,
	userAgent: string,
): (ids: readonly EntityId[]) => Promise<Record<string, Entity>> {
	// eslint-disable-next-line new-cap
	const wbk = WBK({instance: instanceApiEndpoint});

	const headers = new Headers();
	headers.set('user-agent', userAgent);

	return async ids => {
		const urls = wbk.getManyEntities({
			format: 'json',
			ids: ids.filter(arrayFilterUnique()),
		});

		const result: Record<string, Entity> = {};
		// eslint-disable-next-line @typescript-eslint/await-thenable
		for await (const url of urls) {
			const response = await fetch(url, {headers});
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
	};
}
