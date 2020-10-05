import {mapToRecord, arrayToRecord} from '@edjopato/datastore';
import yamlToObjectPathRecord from 'yaml-to-object-path-record';

export function resourceKeysFromMap(entries: Readonly<ReadonlyMap<string, string>>): Record<string, string> {
	return mapToRecord(entries);
}

export function resourceKeysFromArray(entries: ReadonlyArray<{readonly key: string; readonly value: string}>): Record<string, string> {
	return arrayToRecord(entries);
}

export function resourceKeysFromYaml(yamlString: string): Record<string, string> {
	return yamlToObjectPathRecord(yamlString);
}
