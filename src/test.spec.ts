import * as chai from 'chai';
import * as mocha from 'mocha';
import * as rimraf from 'rimraf';
import * as path from 'path';

const expect = chai.expect;
const should = chai.should;
const assert = chai.assert;

import { Lokales } from './';
import { LokalesUpdateHandler } from './interfaces';

const lokales = new Lokales();
const __ = lokales.__.bind(lokales);
const __n = lokales.__n.bind(lokales);

describe('Lokales', () => {

  before((done) => {
    done();
  });

  it('should localize string "Hello my name is %s."', () => {
    const result = __('Hello my name is %s.', 'Bob');
    assert.equal(result, 'Hello my name is Bob.');
  });

  it('should localize plural string "I have %d cats."', () => {
    const result = __n('I have %d cat.', 'I have %d cats.', 2);
    assert.equal(result, 'I have 2 cats.');
  });

  it('should localize to singular string "I have %d cat."', () => {
    const result = __n('I have %d cat.', 'I have %d cats.', 1);
    assert.equal(result, 'I have 1 cat.');
  });

  it('should localize a template literal "My name is ${name} I am ${age}".', () => {
    const name = 'Joe';
    const age = 45;
    const result = __`My name is ${name} I am ${age}.`;
    assert.equal(result, 'My name is Joe I am 45.');
  });

  it('should change the locale to "es".', () => {
    lokales.setOption('locale', 'es');
    assert.equal(lokales.options.locale, 'es');
  });

  it('should get the current locale.', () => {
    assert.equal(lokales.options.locale, 'es');
  });

  after((done) => {
    done();
    //  rimraf(path.dirname(lokales.path), done);
  });


});