import stream from 'stream'
import { fromStream } from 'hasha'

export const digest = async (stream: stream.Readable): Promise<string> => {
    return await fromStream(stream, { algorithm: 'sha1' })
}
