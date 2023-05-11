import test from 'ava';
import {resourceKeysFromYaml} from '../source/resource-keys.js';

test('empty yaml', t => {
	t.deepEqual(resourceKeysFromYaml(''), {});
});

test('flat key values', t => {
	const input = `
key: Q42
foo: Q1337
	`;
	t.deepEqual(resourceKeysFromYaml(input), {
		key: 'Q42',
		foo: 'Q1337',
	});
});

test('deep key values', t => {
	const input = `
foo:
    bar: Q42
flat: Q1337
	`;
	t.deepEqual(resourceKeysFromYaml(input), {
		'foo.bar': 'Q42',
		flat: 'Q1337',
	});
});

test('garbage input fails in yaml package', t => {
	t.throws(() => {
		resourceKeysFromYaml(':');
	});
});
