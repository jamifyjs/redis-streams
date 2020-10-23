import { StreamIORedis } from './index'
import { createWriteStream, createReadStream } from 'fs'
import { PassThrough } from 'stream'
import crypto from 'crypto'
import { byteLength } from './size'
import { digest } from './digest'

const absolutePathSource = './images/photo-1603401209268-11752b61f182'

test('should return done writing with buffer', async () => {

  const bufferToRedis = async (key: string): Promise<string> => {
    const client = new StreamIORedis()

    const stream = createReadStream(`${absolutePathSource}-00.jpg`)
    const chunks: Uint8Array[] = []
    for await (const chunk of stream) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)
    client.setBuffer(key, buffer)

    return 'done writing'
  }

  expect(await bufferToRedis("keytoSaveTo-buffer-1")).toBe('done writing')
})

test('should return done writing with stream', async () => {
  const streamToRedis = async (key: string): Promise<string> => {
    const client = new StreamIORedis()

    return await new Promise((resolve) => {
      const stream = client.writeStream(key)
      createReadStream(`${absolutePathSource}-01.jpg`)
        .pipe(stream)
        .on('finish', function () {
          resolve('done writing')
        })
    })
  }

  expect(await streamToRedis("keytoSaveTo-1")).toBe('done writing')
})

test('should record byteLength during writing', async () => {
  const streamToRedis = async (key: string): Promise<number> => {
    const client = new StreamIORedis()
    const stream = createReadStream(`${absolutePathSource}-01.jpg`)

    const p1 = client.writeStreamPromise(stream, key)
    const p2 = byteLength(stream)

    await p1
    return await p2
  }

  expect(await streamToRedis("keytoSaveTo-1")).toBe(8773834)
})

test('should record digest HASHA during writing', async () => {
  const streamToRedis = async (key: string): Promise<string> => {
    const client = new StreamIORedis()
    const stream = createReadStream(`${absolutePathSource}-01.jpg`)

    const p1 = new Promise((resolve) => {
      stream.pipe(client.writeStream(key))
        .on('finish', function () {
          resolve('done writing')
        })
    })
    const p2 = digest(stream)

    if ('done writing' === await p1) {
      return await p2
    }
    return ''
  }

  expect(await streamToRedis("keytoSaveTo-1")).toBe('8269ea228b794d557d3dc2c6682c5715f4f9ec2f')
})


test('should return done reading with buffer', async () => {
  const bufferFromRedis = async (key: string): Promise<string> => {
    const client = new StreamIORedis()

    return await new Promise(async (resolve) => {
      const stream = createWriteStream(`${absolutePathSource}-10.jpg`)
      const buffer = await client.getBuffer(key)
      stream.write(buffer)
      stream.on('finish', () => {
        resolve('done reading')
      })
      stream.end()
    })
  }

  expect(await bufferFromRedis("keytoSaveTo-buffer-1")).toBe('done reading')
})

test('should return done reading with stream', async () => {
  const streamFromRedis = async (key: string): Promise<string> => {
    const client = new StreamIORedis()

    return await new Promise((resolve) => {
      client.readStream(key)
        .pipe(createWriteStream(`${absolutePathSource}-11.jpg`))
        .on('finish', function () {
          resolve('done reading')
        })
    })
  }

  const result = await streamFromRedis("keytoSaveTo-1")
  expect(result).toBe('done reading')
})

test('should record byteLength during reading', async () => {
  const streamToRedis = async (key: string): Promise<number> => {
    const client = new StreamIORedis()
    const stream = client.readStream(key)

    const p1 = new Promise((resolve) => {
      stream
        .pipe(createWriteStream(`${absolutePathSource}-12.jpg`))
        .on('finish', function () {
          resolve('done reading')
        })
    })
    const p2 = byteLength(stream)

    if ('done reading' === await p1) {
      return await p2
    }
    return 0
  }

  expect(await streamToRedis("keytoSaveTo-1")).toBe(8773834)
})

test('should record digest HASHA during reading', async () => {
  const streamToRedis = async (key: string): Promise<string> => {
    const client = new StreamIORedis()
    const stream = client.readStream(key)

    const p1 = new Promise((resolve) => {
      stream
        .pipe(createWriteStream(`${absolutePathSource}-13.jpg`))
        .on('finish', function () {
          resolve('done reading')
        })
    })
    const p2 = digest(stream)

    if ('done reading' === await p1) {
      return await p2
    }
    return ''
  }

  expect(await streamToRedis("keytoSaveTo-1")).toBe('8269ea228b794d557d3dc2c6682c5715f4f9ec2f')
})

// replicate original wstrem tests
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
  expect(() => { throwsErr() }).toThrow('RedisWStream requires client and key')
})
