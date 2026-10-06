"use strict";

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const crcTable = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[index] = value >>> 0;
}

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function normalizeArchivePath(value) {
  const clean = String(value).replace(/\\/g, "/");
  if (!clean || clean.startsWith("/") || /^[a-z]:/i.test(clean) || clean.split("/").some((part) => part === ".." || part === "." || part === "")) {
    throw new Error(`Unsafe archive path: ${value}`);
  }
  return clean;
}

function createDeterministicZip(entries) {
  const normalized = entries.map(({ name, data }) => ({ name: normalizeArchivePath(name), data: Buffer.isBuffer(data) ? data : Buffer.from(data) }));
  normalized.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index - 1].name === normalized[index].name) throw new Error(`Duplicate ZIP path: ${normalized[index].name}`);
  }
  if (normalized.length > 0xffff) throw new Error("ZIP64 archives are not supported (too many files).");

  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const fixedDate = 33; // 1980-01-01 in DOS date format.
  for (const entry of normalized) {
    const name = Buffer.from(entry.name, "utf8");
    const raw = entry.data;
    const compressed = zlib.deflateRawSync(raw, { level: 9, strategy: zlib.constants.Z_DEFAULT_STRATEGY, memLevel: 9 });
    const checksum = crc32(raw);
    if (raw.length > 0xffffffff || compressed.length > 0xffffffff || offset > 0xffffffff) throw new Error("ZIP64 archives are not supported (file or archive too large).");

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(fixedDate, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(fixedDate, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(normalized.length, 8);
  end.writeUInt16LE(normalized.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function extractZipBuffer(zip, destination) {
  const minEnd = Math.max(0, zip.length - 0xffff - 22);
  let endOffset = -1;
  for (let cursor = zip.length - 22; cursor >= minEnd; cursor -= 1) {
    if (zip.readUInt32LE(cursor) === 0x06054b50) { endOffset = cursor; break; }
  }
  if (endOffset < 0) throw new Error("ZIP end-of-central-directory record was not found.");
  const entryCount = zip.readUInt16LE(endOffset + 10);
  const directorySize = zip.readUInt32LE(endOffset + 12);
  const directoryOffset = zip.readUInt32LE(endOffset + 16);
  if (directoryOffset + directorySize > endOffset) throw new Error("ZIP central directory is outside the archive bounds.");
  fs.mkdirSync(destination, { recursive: true });
  let cursor = directoryOffset;
  const names = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error(`Invalid ZIP central directory entry ${index + 1}.`);
    const flags = zip.readUInt16LE(cursor + 8);
    const method = zip.readUInt16LE(cursor + 10);
    const expectedCrc = zip.readUInt32LE(cursor + 16);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const uncompressedSize = zip.readUInt32LE(cursor + 24);
    const filenameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const name = zip.subarray(cursor + 46, cursor + 46 + filenameLength).toString("utf8");
    const safeName = normalizeArchivePath(name);
    if (flags & 1) throw new Error(`Encrypted ZIP entry is not supported: ${safeName}`);
    cursor += 46 + filenameLength + extraLength + commentLength;

    if (zip.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Invalid local ZIP header for ${safeName}.`);
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = zip.subarray(dataOffset, dataOffset + compressedSize);
    const data = method === 0 ? Buffer.from(compressed) : method === 8 ? zlib.inflateRawSync(compressed) : null;
    if (!data) throw new Error(`ZIP compression method ${method} is not supported for ${safeName}.`);
    if (data.length !== uncompressedSize || crc32(data) !== expectedCrc) throw new Error(`ZIP integrity check failed for ${safeName}.`);

    const output = path.resolve(destination, ...safeName.split("/"));
    if (!output.startsWith(`${path.resolve(destination)}${path.sep}`)) throw new Error(`Archive path escapes extraction directory: ${safeName}`);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, data, { flag: "wx" });
    names.push(safeName);
  }
  return names.sort();
}

function walkFiles(root, relativeRoot = root, found = []) {
  for (const item of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, item.name);
    const relative = path.relative(relativeRoot, absolute).split(path.sep).join("/");
    if (item.isDirectory()) walkFiles(absolute, relativeRoot, found);
    else if (item.isFile()) found.push({ absolute, relative });
    else if (item.isSymbolicLink()) throw new Error(`Release input contains an unsupported symbolic link: ${relative}`);
  }
  return found.sort((left, right) => left.relative < right.relative ? -1 : left.relative > right.relative ? 1 : 0);
}

module.exports = { crc32, normalizeArchivePath, createDeterministicZip, extractZipBuffer, walkFiles };
