import stream from 'stream'
import IORedis from 'ioredis'

export class RedisRStream extends stream.Readable {
    redisClient: IORedis.Redis
    redisKey: string
    redisOffset: number
    redisStartOffset: number
    redisLength: number
    redisEnded: boolean

    constructor(redisClient: IORedis.Redis, key: string, streamOptions: stream.ReadableOptions = {}) {
      if (!(redisClient && key)) throw new Error('RedisRStream requires client and key')
      super(streamOptions)
  
      this.redisClient = redisClient
      this.redisKey = key
      this.redisOffset = 0
      this.redisStartOffset = 0
      this.redisLength = 0
      this.redisEnded = false
    }
  
    _read(size: number): void {  
      const startOffset = this.redisOffset
      const endOffset = startOffset + size - 1
  
      this.redisOffset = endOffset + 1
  
      const getrangeCallback = (error: Error | null, buffer: Buffer) => {
        if (buffer) this.redisLength += buffer.length
        if (error) return this.emit('error', error)
  
        const cleanup = () => {
          if (!this.redisEnded) {
            this.redisEnded = true
            this.push(null) // ended
          }
        }
  
        if (!buffer.length) {
          cleanup()
          return
        }
  
        try {
          if (this.push(buffer)) { // continue reading
            if (buffer.length < endOffset - startOffset) {
              cleanup()
              return
            }
            process.nextTick(() => { this._read(size) })
          }
        } catch (error) {
          this.redisEnded = true
          this.emit('error', error)
          return
        }
      }
      this.redisClient.getrangeBuffer(this.redisKey, startOffset, endOffset, getrangeCallback)
    }
  }