import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import zlib from 'node:zlib';
import tar from 'tar-stream';
import tarindex from '../index.js';

const CLI = fileURLToPath(new URL('../bin/cli.js', import.meta.url));

const TEST_FILES = [
  {name: 'mypackage/DESCRIPTION', content: 'Package: mypackage\nVersion: 1.0.0\n'},
  {name: 'mypackage/R/code.R',    content: 'hello <- function() "world"\n'},
  {name: 'mypackage/man/func.Rd', content: '\\name{hello}\n\\alias{hello}\n'},
];

async function create_tar_buffer() {
  const pack = tar.pack();
  for (const {name, content} of TEST_FILES) {
    pack.entry({name}, content);
  }
  pack.finalize();

  const chunks = [];
  for await (const chunk of pack) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function check_result(result) {
  assert.equal(result.files.length, TEST_FILES.length);

  for (let i = 0; i < TEST_FILES.length; i++) {
    const {name, content} = TEST_FILES[i];
    const entry = result.files[i];
    assert.equal(entry.filename, name);
    assert.equal(entry.end - entry.start, Buffer.byteLength(content));
  }

  // offsets should be monotonically increasing
  for (let i = 1; i < result.files.length; i++) {
    assert.ok(result.files[i].start > result.files[i - 1].end);
  }

  assert.ok(result.remote_package_size > 0);
}

test('plain tar', async () => {
  const buf = await create_tar_buffer();
  const result = await tarindex(Readable.from(buf));
  check_result(result);
});

test('tar.gz', async () => {
  const buf = await create_tar_buffer();
  const gz = zlib.gzipSync(buf);
  const result = await tarindex(Readable.from(gz));
  check_result(result);
});

test('tar.zst', async () => {
  const buf = await create_tar_buffer();
  const zst = zlib.zstdCompressSync(buf);
  const result = await tarindex(Readable.from(zst));
  check_result(result);
});

test('cli reads from stdin when no file argument is given', async () => {
  const buf = await create_tar_buffer();
  const gz = zlib.gzipSync(buf);

  const result = await new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [CLI], {stdio: ['pipe', 'pipe', 'pipe']});
    const chunks = [];
    proc.stdout.on('data', chunk => chunks.push(chunk));
    proc.stderr.on('data', chunk => reject(new Error(Buffer.concat([chunk]).toString())));
    proc.on('close', code => {
      if (code !== 0) return reject(new Error(`CLI exited with code ${code}`));
      resolve(JSON.parse(Buffer.concat(chunks).toString()));
    });
    proc.stdin.end(gz);
  });

  check_result(result);
});

test('all three variants produce identical output', async () => {
  const buf = await create_tar_buffer();
  const gz = zlib.gzipSync(buf);
  const zst = zlib.zstdCompressSync(buf);

  const [r_tar, r_gz, r_zst] = await Promise.all([
    tarindex(Readable.from(buf)),
    tarindex(Readable.from(gz)),
    tarindex(Readable.from(zst)),
  ]);

  assert.deepEqual(r_tar, r_gz);
  assert.deepEqual(r_tar, r_zst);
});
