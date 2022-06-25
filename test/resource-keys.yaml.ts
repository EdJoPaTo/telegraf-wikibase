import test from 'ava';
import {resourceKeysFromYaml} from '../source/resource-keys.js';

test('empty yaml', t => {
	t.deepEqual(resourceKeysFromYaml(''), {});
});

test('flat key values', t => {
	const input = `
key: value
foo: bar
	`;
	t.deepEqual(resourceKeysFromYaml(input), {
		key: 'value',
		foo: 'bar',
	});
});

test('deep key values', t => {
	const input = `
foo:
    bar: test please ignore
flat: value
	`;
	t.deepEqual(resourceKeysFromYaml(input), {
		'foo.bar': 'test please ignore',
		flat: 'value',
	});
});

test('garbage input fails in yaml package', t => {
	t.throws(() => {
		resourceKeysFromYaml(':');
	});
});
