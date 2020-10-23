import IORedis from 'ioredis'
import { Readable } from 'stream'
import { RedisRStream } from './rstream'
import { RedisWStream, StreamOptions } from './wstream'

import { byteLength } from './size'
import { digest } from './digest'
export { byteLength, digest }

export class StreamIORedis extends IORedis {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(...args: any[]) {
    super(...args)
  }

  readStream(key: string): RedisRStream {
    return new RedisRStream(this, key, { highWaterMark: 1024 * 1024 }) // 1 MB chunks
  }

  writeStream(key: string, options?: StreamOptions): RedisWStream {
    return new RedisWStream(this, key, { ...options, highWaterMark: 1024 * 1024 }) // 1 MB chunks
  }

  writeStreamPromise(stream: Readable, key: string, options?: StreamOptions): Promise<RedisWStream> {
    const wstream = new RedisWStream(this, key, { ...options, highWaterMark: 1024 * 1024 }) // 1 MB chunks
    return new Promise((resolve) => {
      stream.pipe(wstream).on('finish', () => resolve(wstream))
    })
  }
}