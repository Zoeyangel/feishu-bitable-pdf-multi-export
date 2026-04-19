import { strict as assert } from 'node:assert';
import { matchesPiNumberFieldName } from '../src/utils/piFieldMatcher';

assert.equal(matchesPiNumberFieldName('PI号'), true, 'PI号 should match');
assert.equal(matchesPiNumberFieldName('✅PI'), true, '✅PI should match');
assert.equal(matchesPiNumberFieldName('Shipping method'), false, 'Shipping method must not match PI field');

console.log('piFieldMatcher test passed');
