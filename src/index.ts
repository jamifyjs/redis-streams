import IORedis from 'ioredis'
import { Readable, pipeline } from 'stream'
import { RedisRStream } from './rstream'
import { RedisWStream, StreamOptions } from './wstream'

export { imageSize, ImageSizeResult } from './utils'

export class StreamIORedis extends IORedis {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(...args: any[]) {
    super(...args)
  }

  readStream(key: string): RedisRStream {
    return new RedisRStream(this, key, { highWaterMark: 1024 * 1024 }) // 1 MB chunks
  }

  writeStream(key?: string | null, options?: StreamOptions): RedisWStream {
    return new RedisWStream(this, key, { highWaterMark: 1024 * 1024, ...options })
  }

  writeStreamPromise(stream: Readable, key?: string | null, options?: StreamOptions): Promise<RedisWStream> {
    const wstream = this.writeStream(key, { algorithm: 'sha1', ...options })
    return new Promise(
      resolve => pipeline(stream, wstream, () => resolve(wstream))
    )
  }

}