import { StreamIORedis, ImageSizeResult } from './index'
import { createWriteStream, createReadStream } from 'fs'
import { PassThrough, pipeline } from 'stream'
import crypto from 'crypto'
import { imageSize } from './utils'

const absolutePathSource = './images/photo-1603401209268-11752b61f182'

/**
 *  Tests for writing streams to the redis cache
 */

test('should return done writing with buffer', async () => {
  const client = new StreamIORedis()

  const stream = createReadStream(`${absolutePathSource}-00.jpg`)
  const chunks: Uint8Array[] = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  const buffer = Buffer.concat(chunks)
  client.setBuffer("keytoSaveTo-buffer-1", buffer)

  expect(buffer.byteLength).toBe(8773834)
})

test('should return done writing with stream', async () => {
  const client = new StreamIORedis()

  const stream = createReadStream(`${absolutePathSource}-01.jpg`)
  const p = client.writeStreamPromise(stream, "keytoSaveTo-1")
  expect((await p).redisLength).toBe(8773834)
})

test('should return done writing with stream, use digest as own key', async () => {
  const client = new StreamIORedis()
  const stream = createReadStream(`${absolutePathSource}-01.jpg`)

  const p1 = client.writeStreamPromise(stream, null, { algorithm: 'sha1' })
  const { redisDigest, redisLength } = await p1
  expect({ redisDigest, redisLength }).toMatchObject({ redisDigest: "8269ea228b794d557d3dc2c6682c5715f4f9ec2f", redisLength: 8773834 })
})

test('should determine image dimensions during writing', async () => {
  const client = new StreamIORedis()
  const stream = createReadStream(`${absolutePathSource}-01.jpg`)

  const p1 = client.writeStreamPromise(stream, "keytoSaveTo-1")
  const p2 = imageSize(stream)

  await p1
  expect(await p2).toMatchObject({ "hUnits": "px", "height": 2642, "mime": "image/jpeg", "type": "jpg", "wUnits": "px", "width": 4466 })
})

/**
 *  Tests for reading streams from the redis cache
 */

test('should return done reading with buffer', async () => {
  const client = new StreamIORedis()
  const stream = createWriteStream(`${absolutePathSource}-10.jpg`)
  const buffer = await client.getBuffer("keytoSaveTo-buffer-1")

  const streamToRedis = new Promise(async (resolve) => {
    stream.write(buffer)
    stream.on('finish', () => resolve('done reading'))
    stream.end()
  })

  expect(await streamToRedis).toBe('done reading')
})

test('should return done reading with stream', async () => {
  const client = new StreamIORedis()
  const rstream = client.readStream("keytoSaveTo-1")
  const wstream = createWriteStream(`${absolutePathSource}-11.jpg`)

  const streamToRedis = await new Promise((resolve) => {
    pipeline(rstream, wstream, () => resolve('done reading'))
  })

  expect({ streamToRedis, redisLength: rstream.redisLength }).toMatchObject({ streamToRedis: "done reading", redisLength: 8773834 })
})

test('should determine image dimensions during reading', async () => {
  const streamToRedis = async (key: string): Promise<ImageSizeResult | null> => {
    const client = new StreamIORedis()
    const stream = client.readStream(key)

    const p1 = new Promise((resolve) => {
      const wstream = createWriteStream(`${absolutePathSource}-14.jpg`)
      pipeline(stream, wstream, () => resolve('done reading'))
    })
    const p2 = imageSize(stream)

    if ('done reading' === await p1) {
      return await p2
    }
    return null
  }

  expect(await streamToRedis("keytoSaveTo-1")).toMatchObject({ "hUnits": "px", "height": 2642, "mime": "image/jpeg", "type": "jpg", "wUnits": "px", "width": 4466 })
})

/**
 *  Replicate some of the original wstream tests
 */

const KEY = 'foo'

test('basic use with string, stream data is stored and finish is fired', function (done) {
  const stream = new PassThrough()
  const client = new StreamIORedis()
  stream
    .pipe(client.writeStream(KEY))
    .on('finish', function () {
      client.get(KEY, (err, data) => {
        if (err) return done(err)
        expect(data).toBe('abcdefghi')
        client.del(KEY, done)
      })
    })
  process.nextTick(() => {
    stream.write('abc')
    stream.write('def')
    stream.end('ghi')
  })
})

test('options.clientMulti provided so rename added to it, user must exec when ready', function (done) {
  const stream = new PassThrough()
  const client = new StreamIORedis()

  const clientMulti = client.multi()
  stream
    .pipe(client.writeStream(KEY, { clientMulti }))
    .on('finish', () => {
      // exec not called on clientMulti so won't exist yet
      client.get(KEY, (err, data) => {
        if (err) return done(err)
        expect(data).toBe(null)
        clientMulti.exec((err) => {
          if (err) return done(err)
          client.get(KEY, (err, data) => {
            if (err) return done(err)
            expect(data).toBe('abcdefghi')
            client.del(KEY, done)
          })
        })
      })
    })
  process.nextTick(() => {
    stream.write('abc')
    stream.write('def')
    stream.end('ghi')
  })
})

test('basic use with Buffer, stream data is stored and finish is fired', function (done) {
  const stream = new PassThrough()
  const client = new StreamIORedis()
  stream
    .pipe(client.writeStream(KEY))
    .on('finish', () => {
      client.getBuffer(KEY, (err, data) => {
        if (err) return done(err)
        expect(data.toString()).toBe('abcdefghi123')
        client.del(KEY, done)
      })
    })
  process.nextTick(() => {
    stream.write(new Buffer('abc'))
    stream.write(new Buffer('def'))
    stream.end(new Buffer('ghi123'))
  })
})

test('basic use with binary data in Buffers', function (done) {
  const stream = new PassThrough()
  const client = new StreamIORedis()

  const CHUNK_SIZE = 64 * 1024 // 64KB
  const DATA_LENGTH = 2 * 1024 * 1024 + 25 // 2,025 KB
  const shasum = crypto.createHash('sha1')
  let bytesToGenerate = DATA_LENGTH

  let resultDigest = ''
  stream
    .pipe(client.writeStream(KEY))
    .on('finish', function () {
      client.getBuffer(KEY, (err, data) => { // use Buffer key so returns Buffer data
        if (err) return done(err)
        const dataDigest = crypto.createHash('sha1').update(data).digest('base64')
        expect(resultDigest).toBe(dataDigest)
        client.del(KEY, done)
      })
    })

  const gen = () => {
    const size = (bytesToGenerate > CHUNK_SIZE) ? CHUNK_SIZE : bytesToGenerate
    const buff = crypto.randomBytes(size)

    shasum.update(buff)
    stream.write(buff)
    bytesToGenerate -= size

    if (!bytesToGenerate) {
      stream.end()
      resultDigest = shasum.digest('base64')
      return
    }
    process.nextTick(() => gen()) // use next tick so doesnt blow stack
  }
  process.nextTick(() => gen()) // kick it off
})

test('all arguments missing for factory, throws error', function () {
  const client = new StreamIORedis()

  const throwsErr = () => {
    const key = ''
    client.writeStream(key)
  }
  expect(() => { throwsErr() }).toThrow('RedisWStream requires client, key or options.algorithm')
})
