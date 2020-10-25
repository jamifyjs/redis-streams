# redis-streams

Extends the redis client [ioredis](https://github.com/luin/ioredis) with streaming functions.
This library allows to read and write data into redis via node streams. The implementation is
inspired by redis-rstream and redis-wstream by [@jeffbski](https://github.com/jeffbski) and
has been simplified and made type safe with TypeScript. This library can be conveniently used
with async/await promise syntax.

The write stream has ben enhanced to include automatic generation of cryptographic hashes
such as 'sha1' and others. Furthermore the redisKey can be automatically set to the self-generated hash
to allow for integrity checks and easy lookups.

The main benefit of streaming is more efficient memory usage and safe-guards against buffer overflows.
Performance gains vary based on your hardware and depend on both data and chunk sizes. The default
chunk size has been set to 1 MB and can be changed through the options. Performance gains in my tests
were ~ 20% for writing into the redis cache and insignificant during reading from redis.

## Installation

```
yarn add @jamify/redis-streams
```

## Quick start

```
import { StreamIORedis } from '@jamify/redis-streams'

const redisClient = StreamIORedis()

redisClient.readStream(key)
  .pipe(createWriteStream('image.jpg'))
  .on('finish', done)

createReadStream('image.jpg')
  .pipe(redisClient.writeStream(key))
  .on('finish', done)

// promise version of writeStream
await writeStreamPromise(createReadStream('image.jpg'), key)

// Save to auto generated sha1 key
await writeStreamPromise(createReadStream('image.jpg'), null, { algorithm: 'sha1' })

```

This will extend the `IORedis client` class with two additional functions:

`readStream(key)` - Get a [Readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable) from redis.

`writeStream(key?, options?)` - Get a [Writable stream](https://nodejs.org/api/stream.html#stream_class_stream_writable) from redis.

`writeStreamPromise(rstream, key?, options?)` - Promise version of `writeStream(key)`

## Utility Functions

```
import { byteLength, digest } from '@jamify/redis-streams'

const redisClient = StreamIORedis()

const rstream = redisClient.readStream(key)

const size = await byteLength(rstream)
const digest = await digest(rstream)

```

## Unit testing

```
yarn test
```

## Credits

- https://github.com/jeffbski/redis-rstream
- https://github.com/jeffbski/redis-wstream
- https://github.com/4front/redis-streams

# Copyright & License

Copyright (c) 2020 Jamify - Released under the [MIT license](LICENSE).
