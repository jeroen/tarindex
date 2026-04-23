#!/usr/bin/env node
import {createReadStream, writeFileSync} from 'node:fs';
import tarindex from '../index.js';

const input = process.argv[2];
const output = process.argv[3];
const stream = input ? createReadStream(input) : process.stdin;

tarindex(stream).then(function(result) {
  const json = JSON.stringify(result, null, 2);
  if (output) {
    writeFileSync(output, json);
  } else {
    process.stdout.write(json + '\n');
  }
}).catch(function(err) {
  process.stderr.write(err.message + '\n');
  process.exit(1);
});
