import * as yaml from 'js-yaml';
// @ts-expect-error there are no types
import tableize from 'tableize-object';

export function resourceKeysFromMap(
	entries: Readonly<ReadonlyMap<string, string>>,
): Record<string, string> {
	return Object.fromEntries(entries.entries());
}

export function resourceKeysFromArray(
	entries: ReadonlyArray<{readonly key: string; readonly value: string}>,
): Record<string, string> {
	const arrified = entries.map(({key, value}) => [key, value] as const);
	return Object.fromEntries(arrified);
}

export function resourceKeysFromYaml(
	yamlString: string,
): Record<string, string> {
	const yamlObject = yaml.load(yamlString);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-call
	const dict = tableize(yamlObject) as Record<string, string>;
	return dict;
}
