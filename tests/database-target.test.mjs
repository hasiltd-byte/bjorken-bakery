import test from 'node:test';
import assert from 'node:assert/strict';
import {databaseName} from '../lib/server/database-target.mjs';
test('use the dedicated Atlas database from the URI without falling back to Cotta',()=>{
 assert.equal(databaseName('mongodb+srv://user:password@example.invalid/bjorken_dev'),'bjorken_dev');
 assert.equal(databaseName('mongodb://127.0.0.1:27028/bjorken'),'bjorken');
 assert.equal(databaseName('mongodb+srv://example.invalid/'),'bjorken');
 assert.equal(databaseName('mongodb+srv://example.invalid/cotta','bjorken_test'),'bjorken_test');
 for(const name of ['cotta','admin','test','bjorken/other','bjorken.other'])assert.throws(()=>databaseName('mongodb+srv://example.invalid/'+name));
});
