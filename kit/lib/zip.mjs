// Minimal ZIP writer/reader (deflate, no zip64) so packing and offline install work without any external tool.
import { deflateRawSync, inflateRawSync } from 'node:zlib'
import * as zlib from 'node:zlib'

const CRC_TABLE = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
        let c = n
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        t[n] = c >>> 0
    }
    return t
})()

function crc32(buf) {
    if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0
    let c = 0xffffffff
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
}

function dosTime(date) {
    const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
    const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    return { time, day }
}

// entries: [{ name: 'folder/file.js', data: Buffer, mtime?: Date }]
export function createZip(entries) {
    const locals = []
    const centrals = []
    let offset = 0
    for (const entry of entries) {
        const name = Buffer.from(entry.name.replace(/\\/g, '/'), 'utf8')
        const data = entry.data
        const deflated = deflateRawSync(data, { level: 9 })
        const useDeflate = deflated.length < data.length
        const body = useDeflate ? deflated : data
        const crc = crc32(data)
        const { time, day } = dosTime(entry.mtime || new Date())

        const local = Buffer.alloc(30)
        local.writeUInt32LE(0x04034b50, 0)
        local.writeUInt16LE(20, 4)
        local.writeUInt16LE(0x0800, 6)            // UTF-8 names
        local.writeUInt16LE(useDeflate ? 8 : 0, 8)
        local.writeUInt16LE(time, 10)
        local.writeUInt16LE(day, 12)
        local.writeUInt32LE(crc, 14)
        local.writeUInt32LE(body.length, 18)
        local.writeUInt32LE(data.length, 22)
        local.writeUInt16LE(name.length, 26)
        local.writeUInt16LE(0, 28)
        locals.push(local, name, body)

        const central = Buffer.alloc(46)
        central.writeUInt32LE(0x02014b50, 0)
        central.writeUInt16LE(20, 4)
        central.writeUInt16LE(20, 6)
        central.writeUInt16LE(0x0800, 8)
        central.writeUInt16LE(useDeflate ? 8 : 0, 10)
        central.writeUInt16LE(time, 12)
        central.writeUInt16LE(day, 14)
        central.writeUInt32LE(crc, 16)
        central.writeUInt32LE(body.length, 20)
        central.writeUInt32LE(data.length, 24)
        central.writeUInt16LE(name.length, 28)
        central.writeUInt32LE(offset, 42)
        centrals.push(central, name)
        offset += local.length + name.length + body.length
    }
    const centralSize = centrals.reduce((s, b) => s + b.length, 0)
    const end = Buffer.alloc(22)
    end.writeUInt32LE(0x06054b50, 0)
    end.writeUInt16LE(entries.length, 8)
    end.writeUInt16LE(entries.length, 10)
    end.writeUInt32LE(centralSize, 12)
    end.writeUInt32LE(offset, 16)
    return Buffer.concat([...locals, ...centrals, end])
}

export function readZip(buffer) {
    let eocd = buffer.length - 22
    while (eocd >= 0 && buffer.readUInt32LE(eocd) !== 0x06054b50) eocd--
    if (eocd < 0) throw new Error('not a zip file')
    const count = buffer.readUInt16LE(eocd + 10)
    let ptr = buffer.readUInt32LE(eocd + 16)
    const entries = []
    for (let i = 0; i < count; i++) {
        const method = buffer.readUInt16LE(ptr + 10)
        const size = buffer.readUInt32LE(ptr + 20)
        const nameLen = buffer.readUInt16LE(ptr + 28)
        const extraLen = buffer.readUInt16LE(ptr + 30)
        const commentLen = buffer.readUInt16LE(ptr + 32)
        const localOffset = buffer.readUInt32LE(ptr + 42)
        const name = buffer.toString('utf8', ptr + 46, ptr + 46 + nameLen)
        const lNameLen = buffer.readUInt16LE(localOffset + 26)
        const lExtraLen = buffer.readUInt16LE(localOffset + 28)
        const start = localOffset + 30 + lNameLen + lExtraLen
        const raw = buffer.subarray(start, start + size)
        if (!name.endsWith('/')) {
            const data = method === 8 ? inflateRawSync(raw) : method === 0 ? Buffer.from(raw) : null
            if (!data) throw new Error(`unsupported compression in ${name}`)
            entries.push({ name, data })
        }
        ptr += 46 + nameLen + extraLen + commentLen
    }
    return entries
}
