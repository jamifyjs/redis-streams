import { Readable } from 'stream'
import probe, { ProbeResult as ImageSizeResult } from 'probe-image-size'

export { ImageSizeResult }
export const imageSize = async (stream: Readable): Promise<ImageSizeResult> => {
    return await probe(stream)
}
