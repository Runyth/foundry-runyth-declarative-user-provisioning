// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { mkdir } from "node:fs/promises";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

async function collect(root, filter, prefix = "") {
  const files = [];
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = resolve(directory, entry.name);
      const rel = relative(root, absolute).split(sep).join("/");
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile() && filter(rel)) files.push({ absolute, name: `${prefix}${rel}` });
    }
  }
  await walk(root);
  return files;
}

export async function createDeterministicZip({ root, output, prefix = "", filter = () => true }) {
  const files = await collect(resolve(root), filter, prefix);
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const file of files) {
    const data = await readFile(file.absolute);
    const name = Buffer.from(file.name, "utf8");
    const crc = crc32(data);
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(33),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data,
    ]);
    localParts.push(local);
    const central = Buffer.concat([
      u32(0x02014b50), u16(0x0314), u16(20), u16(0x0800), u16(0), u16(0), u16(33),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0o100644 << 16), u32(offset), name,
    ]);
    centralParts.push(central);
    offset += local.length;
  }
  const central = Buffer.concat(centralParts);
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(central.length), u32(offset), u16(0),
  ]);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, Buffer.concat([...localParts, central, end]));
  return { output, files: files.map((file) => file.name), bytes: (await stat(output)).size };
}
