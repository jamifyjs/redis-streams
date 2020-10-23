import stream from 'stream'

export const byteLength = async (stream: stream.Readable): Promise<number> => {
    let size = 0
    for await (const chunk of stream) {
        size += chunk.byteLength
    }
    return size
}
