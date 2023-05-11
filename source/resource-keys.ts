import {type EntityId, isEntityId} from 'wikibase-sdk';
import * as yaml from 'js-yaml';
// @ts-expect-error there are no types
import tableize from 'tableize-object';

export function resourceKeysFromMap(
	entries: Readonly<ReadonlyMap<string, EntityId>>,
): Record<string, EntityId> {
	return Object.fromEntries(entries.entries());
}

export function resourceKeysFromArray(
	entries: ReadonlyArray<{readonly key: string; readonly value: EntityId}>,
): Record<string, EntityId> {
	const arrified = entries.map(({key, value}) => [key, value] as const);
	return Object.fromEntries(arrified);
}

export function resourceKeysFromYaml(
	yamlString: string,
): Record<string, EntityId> {
	const yamlObject = yaml.load(yamlString);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-call
	const dict = tableize(yamlObject) as Record<string, EntityId>;
	const nonEntityIds = Object.values(dict).filter(o => !isEntityId(o));
	if (nonEntityIds.length > 0) {
		throw new Error(
			'loaded yaml contains values which are not EntityIds: ' + JSON.stringify(nonEntityIds),
		);
	}

	return dict;
}
