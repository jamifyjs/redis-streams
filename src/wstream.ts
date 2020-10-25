import stream from 'stream'
import IORedis, { Pipeline } from 'ioredis'

import { createHash, randomBytes, Hash } from 'crypto'

const RANDOM_BYTES_LENGTH = 15

export interface StreamOptions extends stream.WritableOptions {
  clientMulti?: Pipeline
  digestKey?: boolean
  algorithm?: string
}

export class RedisWStream extends stream.Writable {
  redisClient: IORedis.Redis
  redisKey?: string | null
  redisTempKey: string
  redisClientMulti?: Pipeline
  redisCrypto?: Hash
  redisDigest?: string
  redisLength: number

  constructor(redisClient: IORedis.Redis, key?: string | null, { highWaterMark, clientMulti, algorithm }: StreamOptions = {}) {
    if (!(redisClient && (key || algorithm))) throw new Error('RedisWStream requires client, key or options.algorithm')
    super({ highWaterMark })

    this.redisClient = redisClient
    this.redisKey = key
    this.redisTempKey = 'RedisWStream.' + randomBytes(RANDOM_BYTES_LENGTH).toString('base64')
    this.redisClientMulti = clientMulti
    this.redisLength = 0

    this.redisCrypto = algorithm && createHash(algorithm) || undefined
    this.redisClient.set(this.redisTempKey, '', error => {
      if (error) throw error
    })
  }

  _write(chunk: string | Buffer, encoding: BufferEncoding, cb: (error?: Error | null) => void): void {
    this.redisClient.append(this.redisTempKey, chunk, error => cb(error))
    this.redisCrypto?.update(chunk)
    this.redisLength += chunk.length
  }

  _final(cb: (error?: Error | null) => void): void {
    this.redisDigest = this.redisCrypto?.digest('hex')
    const key = this.redisDigest || this.redisKey || this.redisTempKey
    this.redisClientMulti?.rename(this.redisTempKey, key)
      ? cb()
      : this.redisClient.rename(this.redisTempKey, key, cb)
  }
}
