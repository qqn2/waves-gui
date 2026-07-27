'use strict';

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion failed');
}

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) {
    throw new Error(message || `Expected ${actual} to equal ${expected}`);
  }
};

module.exports = assert;
