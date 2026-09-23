// Zips ../extension into public/bot-collapse.zip. No dependencies.
// Only the extension folder is zipped, never the repo root, so .env can't leak.
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateRawSync } from "node:zlib";

const siteDir = fileURLToPath(new URL("..", import.meta.url));
const extDir = join(siteDir, "..", "extension");
const outFile = join(siteDir, "public", "bot-collapse.zip");

// Belt and braces: skip anything that looks like a secret even inside extension/.
const BLOCKED = [/^\./, /\.pem$/, /\.key$/, /^node_modules$/];

if (!existsSync(join(extDir, "manifest.json"))) {
  rmSync(outFile, { force: true });
  console.warn("zip-extension: extension/manifest.json not found, skipping zip (download link will 404).");
  process.exit(0);
}

const files = [];
function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    if (BLOCKED.some((re) => re.test(name))) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push({ name: relative(extDir, path).split(sep).join("/"), data: readFileSync(path) });
  }
}
walk(extDir);

// Minimal ZIP writer (deflate, no zip64): see PKWARE APPNOTE sections 4.3.7, 4.3.12, 4.3.16.
// Fixed timestamp keeps the zip byte-identical across builds.
const DOS_DATE_1980_01_01 = 0x0021 << 16;
const local = [];
const central = [];
let offset = 0;
for (const { name, data } of files) {
  const nameBuf = Buffer.from(name, "utf8");
  const packed = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);

  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0);
  lh.writeUInt16LE(20, 4); // version needed
  lh.writeUInt16LE(0x0800, 6); // UTF-8 names
  lh.writeUInt16LE(8, 8); // deflate
  lh.writeUInt32LE(DOS_DATE_1980_01_01, 10); // time/date
  lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(packed.length, 18);
  lh.writeUInt32LE(data.length, 22);
  lh.writeUInt16LE(nameBuf.length, 26);
  local.push(lh, nameBuf, packed);

  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0);
  ch.writeUInt16LE(20, 4); // version made by
  ch.writeUInt16LE(20, 6);
  ch.writeUInt16LE(0x0800, 8);
  ch.writeUInt16LE(8, 10);
  ch.writeUInt32LE(DOS_DATE_1980_01_01, 12);
  ch.writeUInt32LE(crc, 16);
  ch.writeUInt32LE(packed.length, 20);
  ch.writeUInt32LE(data.length, 24);
  ch.writeUInt16LE(nameBuf.length, 28);
  ch.writeUInt32LE(offset, 42);
  central.push(ch, nameBuf);

  offset += lh.length + nameBuf.length + packed.length;
}
const centralBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralBuf.length, 12);
end.writeUInt32LE(offset, 16);

writeFileSync(outFile, Buffer.concat([...local, centralBuf, end]));
console.log(`zip-extension: wrote ${files.length} files to public/bot-collapse.zip`);
for (const { name } of files) console.log(`  ${name}`);
