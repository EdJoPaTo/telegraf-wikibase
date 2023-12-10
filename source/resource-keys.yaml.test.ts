import {deepStrictEqual, throws} from 'node:assert';
import {test} from 'node:test';
import {resourceKeysFromYaml} from './resource-keys.js';

await test('resourceKeysFromYaml', async t => {
	const macro = async (
		title: string,
		input: string,
		expected: ReturnType<typeof resourceKeysFromYaml>,
	) =>
		t.test(title, () => {
			deepStrictEqual(resourceKeysFromYaml(input), expected);
		});

	await macro('empty yaml', '', {});

	await macro(
		'flat key values',
		`
key: Q42
foo: Q1337
`,
		{
			key: 'Q42',
			foo: 'Q1337',
		},
	);

	await macro(
		'deep key values',
		`
foo:
    bar: Q42
flat: Q1337
`,
		{
			'foo.bar': 'Q42',
			flat: 'Q1337',
		},
	);

	await t.test('garbage input fails in yaml package', () => {
		throws(() => {
			resourceKeysFromYaml(':');
		});
	});
});
