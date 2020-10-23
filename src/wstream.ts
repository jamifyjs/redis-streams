import stream from 'stream'
import IORedis, { Pipeline } from 'ioredis'

import { randomBytes } from 'crypto'
const RANDOM_BYTES_LENGTH = 15

export interface StreamOptions extends stream.WritableOptions {
    clientMulti?: Pipeline
}

export class RedisWStream extends stream.Writable {
  redisClient: IORedis.Redis
  redisKey: string
  redisTempKey: string
  redisClientMulti?: Pipeline

  constructor(redisClient: IORedis.Redis, key: string, streamOptions: StreamOptions = {}) {
    if (!(redisClient && key)) throw new Error('RedisWStream requires client and key')
    super(streamOptions)

    this.redisClient = redisClient
    this.redisKey = key
    this.redisTempKey = key + '.' + randomBytes(RANDOM_BYTES_LENGTH).toString('base64')
    this.redisClientMulti = streamOptions?.clientMulti

    this.redisClient.set(this.redisTempKey, '', (error: Error | null) => {
      if (error) throw error
    })
  }

  _write(chunk: string | Buffer, encoding: BufferEncoding, cb: (error?: Error | null) => void): void {
    this.redisClient.append(this.redisTempKey, chunk, (error: Error | null) => {
       cb(error)
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  end(...args: [chunk?: any, encoding?: BufferEncoding, cb?: () => void] | [chunk?: any, cb?: () => void] | [cb?: () => void]): void {
    let [ chunk, encoding, cb ] = args

    if (typeof chunk === 'function') {
      cb = chunk
      chunk = undefined
      encoding = undefined
    } else if (typeof encoding === 'function') {
      cb = encoding
      encoding = undefined
    }
    
    const done = (error: Error | null) => {
      if (error) {
        if (cb) return cb()
        else throw error
      }
      super.end(cb)
    }

    const rename =  (error: Error | null | undefined) => {
      if (error) return done(error)
      if (this.redisClientMulti) {
        this.redisClientMulti.rename(this.redisTempKey, this.redisKey)
        done(null)
      } else {
        this.redisClient.rename(this.redisTempKey, this.redisKey, done)
      }
    }

    if(!chunk) chunk = ''
    if(chunk && encoding) {
      this.write(chunk, encoding, (error: Error | null | undefined) => rename(error))
    } else {
      this.write(chunk, (error: Error | null | undefined) => rename(error))
    }
  }
}