import {mapToRecord, arrayToRecord} from '@edjopato/datastore';
import * as yaml from 'js-yaml';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const tableize = require('tableize-object');

export function resourceKeysFromMap(entries: Readonly<ReadonlyMap<string, string>>): Record<string, string> {
	return mapToRecord(entries);
}

export function resourceKeysFromArray(entries: ReadonlyArray<{readonly key: string; readonly value: string}>): Record<string, string> {
	return arrayToRecord(entries);
}

export function resourceKeysFromYaml(yamlString: string): Record<string, string> {
	const yamlObject = yaml.safeLoad(yamlString);
	const dict: Record<string, string> = tableize(yamlObject);
	return dict;
}
