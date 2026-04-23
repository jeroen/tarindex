# tarindex

Index files in a `.tar`, `.tar.gz`, or `.tar.zst` archive, recording filenames and byte offsets. Input type is detected automatically.

## Installation

```sh
npm install tarindex
```

## Command line

```sh
npx tarindex archive.tar.gz
npx tarindex archive.tar.zst [output.json]
```

If no input file is given, stdin is used:

```sh
curl -sSL https://cran.r-project.org/src/contrib/Archive/jose/jose_1.0.tar.gz | npx tarindex
```

Output is written to stdout, or to a file if two arguments are given:

```json
{
  "files": [
    { "filename": "mypackage/DESCRIPTION", "start": 512, "end": 548 },
    { "filename": "mypackage/R/code.R", "start": 1536, "end": 1563 }
  ],
  "remote_package_size": 3072
}
```

## JavaScript API

```js
import tarindex from 'tarindex';
import { createReadStream } from 'node:fs';

const result = await tarindex(createReadStream('archive.tar.gz'));
console.log(result.files);
// [
//   { filename: 'mypackage/DESCRIPTION', start: 512, end: 548 },
//   { filename: 'mypackage/R/code.R', start: 1536, end: 1563 },
// ]
console.log(result.remote_package_size); // total bytes consumed
```

The `start` and `end` values are byte offsets within the **decompressed** tar stream.


## Use with Emscripten WORKERFS

Emscripten's [WORKERFS](https://emscripten.org/docs/api_reference/Filesystem-API.html#id2) filesystem lets you mount a tar archive inside a web worker, giving compiled C/C++ code read-only access to its files without copying the entire archive into memory. Mounting a package requires a `metadata` JSON object (normally produced by `file_packager --separate-metadata`) alongside a `Blob` of the raw archive data.

`tarindex` generates that metadata object directly from the tar archive:

```js
const [metaRes, blobRes] = await Promise.all([
  fetch('archive.tar.gz.json'),  // output of tarindex
  fetch('archive.tar.gz'),
]);
const metadata = await metaRes.json();
const blob = await blobRes.blob();

FS.mkdir('/pkg');
FS.mount(WORKERFS, { packages: [{ metadata, blob }] }, '/pkg');
```
