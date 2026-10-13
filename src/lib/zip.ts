import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { pipeline } from "node:stream/promises";
import type { Writable } from "node:stream";

/**
 * 极简 ZIP 读写（零依赖）。
 *
 * 为什么不装 `archiver` / `jszip`：
 * 我们只需要「写一个 zip」和「读一个 zip」两件事，而 ZIP 的存储格式足够简单
 * （本地头 + 数据 + 中央目录 + EOCD），压缩/解压直接用 Node 内置的 zlib。
 * 为这点需求引一个依赖（外加一串传递依赖）不划算 —— 项目一贯的取向是能自写就自写。
 *
 * ## 只实现了我们真正用得到的部分
 *
 * - **写**：`store`（原样存）与 `deflate`（压缩）两种方法。
 *   二进制文件（图片/视频/安装包）本来就已经压过了，再 deflate 一遍只浪费时间，
 *   所以走 store；JSON 走 deflate，通常能小一个数量级。
 * - **读**：按中央目录定位条目，支持 store 与 deflate。
 * - **不做 ZIP64**。4GB 是 ZIP 的经典上限，超过就明确报错让用户取消勾选大文件，
 *   而不是悄悄写出一份坏包。条目数上限同理（65535）。
 *
 * ## 两个容易踩的点
 *
 * 1. store 的条目在写本地头时还不知道 CRC 与大小，所以置 `FLAG_DATA_DESCRIPTOR`，
 *    把 CRC/大小写在数据后面的「数据描述符」里（这是 ZIP 规范内的标准做法，
 *    unzip / 7z / 系统自带解压都能正确识别）。
 * 2. 文件名统一置 UTF-8 标志位，否则中文路径在 Windows 上会变乱码。
 */

const SIG_LOCAL = 0x04034b50;
const SIG_DESCRIPTOR = 0x08074b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;

const FLAG_DATA_DESCRIPTOR = 0x0008;
const FLAG_UTF8 = 0x0800;

/** ZIP 经典格式的硬上限（未启用 ZIP64 时的 32 位字段） */
export const ZIP_MAX_SIZE = 0xffffffff;
export const ZIP_MAX_ENTRIES = 0xffff;

export class ZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipError";
  }
}

// ---------- CRC32 ----------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

/** 增量计算 CRC32：把上一次的返回值再传进来即可续算。 */
export function crc32(buffer: Buffer, seed = 0): number {
  let value = (seed ^ 0xffffffff) >>> 0;
  for (let index = 0; index < buffer.length; index += 1) {
    value = CRC_TABLE[(value ^ buffer[index]) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

// ---------- 时间戳 ----------

/** 转成 ZIP 的 MS-DOS 时间格式（1980 年起，秒只有 2 秒精度）。 */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time:
      ((date.getHours() & 0x1f) << 11) |
      ((date.getMinutes() & 0x3f) << 5) |
      ((date.getSeconds() >> 1) & 0x1f),
    date: (((year - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f),
  };
}

// ---------- 写入 ----------

type EntryRecord = {
  name: Buffer;
  flags: number;
  method: number;
  crc: number;
  compressedSize: number;
  size: number;
  offset: number;
  time: number;
  date: number;
};

/**
 * 流式 ZIP 写入器。
 *
 * 数据边写边落，不在内存里攒整包 —— 备份包里可能有几百 MB 的图片和视频。
 * 所有 `add*` 方法都必须按顺序 await，写入顺序即压缩包内的顺序。
 */
export class ZipWriter {
  private readonly out: Writable;
  private readonly entries: EntryRecord[] = [];
  private offset = 0;
  private closed = false;

  constructor(out: Writable) {
    this.out = out;
  }

  private async push(buffer: Buffer): Promise<void> {
    if (this.closed) {
      throw new ZipError("ZIP 已经结束写入");
    }
    const next = this.offset + buffer.byteLength;
    if (next > ZIP_MAX_SIZE) {
      throw new ZipError("备份包超过 4GB 上限，请取消勾选「软件安装包」后重试");
    }
    this.offset = next;

    await new Promise<void>((resolve, reject) => {
      this.out.write(buffer, (error) => (error ? reject(error) : resolve()));
    });
  }

  private assertRoom(): void {
    if (this.entries.length >= ZIP_MAX_ENTRIES) {
      throw new ZipError(`备份包条目数超过 ${ZIP_MAX_ENTRIES} 上限`);
    }
  }

  private localHeader(record: Omit<EntryRecord, "offset">, withDescriptor: boolean): Buffer {
    const header = Buffer.alloc(30);
    header.writeUInt32LE(SIG_LOCAL, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(record.flags, 6);
    header.writeUInt16LE(record.method, 8);
    header.writeUInt16LE(record.time, 10);
    header.writeUInt16LE(record.date, 12);
    // 走数据描述符时，这三个字段先写 0，真实值跟在数据后面
    header.writeUInt32LE(withDescriptor ? 0 : record.crc, 14);
    header.writeUInt32LE(withDescriptor ? 0 : record.compressedSize, 18);
    header.writeUInt32LE(withDescriptor ? 0 : record.size, 22);
    header.writeUInt16LE(record.name.byteLength, 26);
    header.writeUInt16LE(0, 28);
    return header;
  }

  /** 写入一个内存里的条目；JSON 这类文本建议 compress=true。 */
  async addBuffer(name: string, data: Buffer, compress = true): Promise<void> {
    this.assertRoom();

    const nameBuffer = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const method = compress ? METHOD_DEFLATE : METHOD_STORE;
    const payload = compress ? zlib.deflateRawSync(data, { level: 6 }) : data;
    const stamp = dosDateTime(new Date());
    const offset = this.offset;

    const record: EntryRecord = {
      name: nameBuffer,
      flags: FLAG_UTF8,
      method,
      crc,
      compressedSize: payload.byteLength,
      size: data.byteLength,
      offset,
      time: stamp.time,
      date: stamp.date,
    };

    await this.push(this.localHeader(record, false));
    await this.push(nameBuffer);
    await this.push(payload);

    this.entries.push(record);
  }

  /**
   * 写入磁盘上的文件（store，不压缩）。
   * 边读边算 CRC，读完再补数据描述符，全程不把文件读进内存。
   */
  async addFile(name: string, absolutePath: string): Promise<void> {
    this.assertRoom();

    const stat = await fsp.stat(absolutePath);
    const nameBuffer = Buffer.from(name, "utf8");
    const stamp = dosDateTime(stat.mtime);
    const offset = this.offset;

    const record: EntryRecord = {
      name: nameBuffer,
      flags: FLAG_UTF8 | FLAG_DATA_DESCRIPTOR,
      method: METHOD_STORE,
      crc: 0,
      compressedSize: 0,
      size: 0,
      offset,
      time: stamp.time,
      date: stamp.date,
    };

    await this.push(this.localHeader(record, true));
    await this.push(nameBuffer);

    let crc = 0;
    let total = 0;
    const source = fs.createReadStream(absolutePath, { highWaterMark: 1 << 20 });
    for await (const chunk of source) {
      const buffer = chunk as Buffer;
      crc = crc32(buffer, crc);
      total += buffer.byteLength;
      await this.push(buffer);
    }

    const descriptor = Buffer.alloc(16);
    descriptor.writeUInt32LE(SIG_DESCRIPTOR, 0);
    descriptor.writeUInt32LE(crc, 4);
    descriptor.writeUInt32LE(total, 8);
    descriptor.writeUInt32LE(total, 12);
    await this.push(descriptor);

    record.crc = crc;
    record.compressedSize = total;
    record.size = total;
    this.entries.push(record);
  }

  /**
   * 写入中央目录与 EOCD，并结束输出流。之后不能再 add。
   *
   * 这里负责 `end()`：调用方拿到的是一根管道，只有源头正常结束，
   * 下游（HTTP 响应 / 文件流）才知道「包写完了」。
   */
  async finish(): Promise<void> {
    if (this.closed) {
      return;
    }

    const centralOffset = this.offset;
    for (const entry of this.entries) {
      const header = Buffer.alloc(46);
      header.writeUInt32LE(SIG_CENTRAL, 0);
      header.writeUInt16LE(20, 4); // version made by
      header.writeUInt16LE(20, 6); // version needed
      header.writeUInt16LE(entry.flags, 8);
      header.writeUInt16LE(entry.method, 10);
      header.writeUInt16LE(entry.time, 12);
      header.writeUInt16LE(entry.date, 14);
      header.writeUInt32LE(entry.crc, 16);
      header.writeUInt32LE(entry.compressedSize, 20);
      header.writeUInt32LE(entry.size, 24);
      header.writeUInt16LE(entry.name.byteLength, 28);
      header.writeUInt16LE(0, 30); // extra
      header.writeUInt16LE(0, 32); // comment
      header.writeUInt16LE(0, 34); // disk start
      header.writeUInt16LE(0, 36); // internal attrs
      header.writeUInt32LE(0, 38); // external attrs
      header.writeUInt32LE(entry.offset, 42);

      await this.push(header);
      await this.push(entry.name);
    }

    const centralSize = this.offset - centralOffset;

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(SIG_EOCD, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(this.entries.length, 8);
    eocd.writeUInt16LE(this.entries.length, 10);
    eocd.writeUInt32LE(centralSize, 12);
    eocd.writeUInt32LE(centralOffset, 16);
    eocd.writeUInt16LE(0, 20);
    await this.push(eocd);

    this.closed = true;
    await new Promise<void>((resolve, reject) => {
      this.out.end((error?: Error | null) => (error ? reject(error) : resolve()));
    });
  }
}

// ---------- 读取 ----------

export type ZipEntry = {
  name: string;
  method: number;
  crc: number;
  compressedSize: number;
  size: number;
  /** 该条目数据在文件里的起始偏移 */
  dataOffset: number;
};

const EOCD_MIN_LENGTH = 22;
/** EOCD 后面最多可能跟 64KB 的注释，所以从文件尾部往前找签名 */
const EOCD_SEARCH_LENGTH = EOCD_MIN_LENGTH + 0xffff;

/** 解析中央目录。只读头部，不解压数据。 */
export async function readZipEntries(filePath: string): Promise<ZipEntry[]> {
  const handle = await fsp.open(filePath, "r");
  try {
    const stat = await handle.stat();
    if (stat.size < EOCD_MIN_LENGTH) {
      throw new ZipError("不是有效的 ZIP 文件（文件过小）");
    }

    const tailLength = Math.min(stat.size, EOCD_SEARCH_LENGTH);
    const tail = Buffer.alloc(tailLength);
    await handle.read(tail, 0, tailLength, stat.size - tailLength);

    let eocdAt = -1;
    for (let index = tail.length - EOCD_MIN_LENGTH; index >= 0; index -= 1) {
      if (tail.readUInt32LE(index) === SIG_EOCD) {
        eocdAt = index;
        break;
      }
    }
    if (eocdAt < 0) {
      throw new ZipError("不是有效的 ZIP 文件（找不到中央目录）");
    }

    const count = tail.readUInt16LE(eocdAt + 10);
    const centralSize = tail.readUInt32LE(eocdAt + 12);
    const centralOffset = tail.readUInt32LE(eocdAt + 16);

    if (centralOffset === ZIP_MAX_SIZE || centralSize === ZIP_MAX_SIZE) {
      throw new ZipError("不支持 ZIP64 格式的备份包");
    }
    if (centralSize === 0) {
      return [];
    }

    const central = Buffer.alloc(centralSize);
    await handle.read(central, 0, centralSize, centralOffset);

    const entries: ZipEntry[] = [];
    let cursor = 0;

    for (let index = 0; index < count; index += 1) {
      if (cursor + 46 > central.length || central.readUInt32LE(cursor) !== SIG_CENTRAL) {
        throw new ZipError("ZIP 中央目录已损坏");
      }

      const method = central.readUInt16LE(cursor + 10);
      const crc = central.readUInt32LE(cursor + 16);
      const compressedSize = central.readUInt32LE(cursor + 20);
      const size = central.readUInt32LE(cursor + 24);
      const nameLength = central.readUInt16LE(cursor + 28);
      const extraLength = central.readUInt16LE(cursor + 30);
      const commentLength = central.readUInt16LE(cursor + 32);
      const localOffset = central.readUInt32LE(cursor + 42);
      const name = central.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");

      cursor += 46 + nameLength + extraLength + commentLength;

      if (compressedSize === ZIP_MAX_SIZE || size === ZIP_MAX_SIZE) {
        throw new ZipError(`不支持 ZIP64 格式的条目：${name}`);
      }
      // 目录条目本身没有数据，跳过
      if (name.endsWith("/")) {
        continue;
      }

      // 本地头的 extra 长度可能与中央目录不同，必须以本地头为准
      const local = Buffer.alloc(30);
      await handle.read(local, 0, 30, localOffset);
      if (local.readUInt32LE(0) !== SIG_LOCAL) {
        throw new ZipError(`ZIP 条目已损坏：${name}`);
      }
      const localNameLength = local.readUInt16LE(26);
      const localExtraLength = local.readUInt16LE(28);

      entries.push({
        name,
        method,
        crc,
        compressedSize,
        size,
        dataOffset: localOffset + 30 + localNameLength + localExtraLength,
      });
    }

    return entries;
  } finally {
    await handle.close();
  }
}

/** 条目名 → 安全的相对路径；拒绝绝对路径与目录穿越。 */
export function safeEntryRelative(name: string): string {
  const normalized = name.replaceAll("\\", "/").replace(/^\/+/, "");
  const segments = normalized.split("/");

  if (
    !normalized ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new ZipError(`备份包里含有非法路径：${name}`);
  }
  return normalized;
}

/** 把单个条目解压到内存（只用于 backup.json 这种小文件）。 */
export async function readZipEntryBuffer(filePath: string, entry: ZipEntry): Promise<Buffer> {
  const handle = await fsp.open(filePath, "r");
  try {
    const raw = Buffer.alloc(entry.compressedSize);
    if (entry.compressedSize > 0) {
      await handle.read(raw, 0, entry.compressedSize, entry.dataOffset);
    }

    const data =
      entry.method === METHOD_DEFLATE ? zlib.inflateRawSync(raw) : raw;

    if (data.byteLength !== entry.size) {
      throw new ZipError(`条目大小不符：${entry.name}`);
    }
    if (crc32(data) !== entry.crc) {
      throw new ZipError(`条目校验失败（CRC 不符）：${entry.name}`);
    }
    return data;
  } finally {
    await handle.close();
  }
}

/**
 * 把单个条目流式解压到目标文件。
 * store 的条目直接按字节区间拷贝，不解压也不进内存。
 */
export async function extractZipEntry(
  filePath: string,
  entry: ZipEntry,
  targetPath: string
): Promise<void> {
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });

  if (entry.size === 0) {
    await fsp.writeFile(targetPath, Buffer.alloc(0));
    return;
  }

  const end = entry.dataOffset + entry.compressedSize - 1;
  const source = fs.createReadStream(filePath, { start: entry.dataOffset, end });
  const target = fs.createWriteStream(targetPath);

  if (entry.method === METHOD_DEFLATE) {
    await pipeline(source, zlib.createInflateRaw(), target);
  } else if (entry.method === METHOD_STORE) {
    await pipeline(source, target);
  } else {
    throw new ZipError(`不支持的解压方式（method=${entry.method}）：${entry.name}`);
  }

  const stat = await fsp.stat(targetPath);
  if (stat.size !== entry.size) {
    await fsp.rm(targetPath, { force: true });
    throw new ZipError(`解压后大小不符：${entry.name}`);
  }
}
