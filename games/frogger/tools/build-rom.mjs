// SPDX-License-Identifier: GPL-3.0-only
//
// Assemble the Frogger ROM images from your own dump. Game-local (NOT the generic tools/build-rom.mjs)
// because two MAME load-time transforms must be baked in, which the generic concat tool cannot do:
//   - maincpu: the three program ROMs total 0x3000; PAD to 0x4000 with 0x00 (MAME zero-fills the
//     unpopulated 0x3000-0x3FFF of the "maincpu" region; boards/frogger/memory.js requires 0x4000).
//   - gfx: frogger.607 (plane0) verbatim, then frogger.606 (plane1) with a D0<->D1 data-line swap over
//     all 0x800 bytes: bitswap<8>(b,7,6,5,4,3,2,0,1) == (b & 0xFC) | ((b>>1)&1) | ((b<<1)&2).
//     This is decode_frogger_gfx (galaxian.cpp:8705); the board's tile/sprite decode does NOT swap.
// The ROM data is copyrighted and never committed; this rebuilds it locally and verifies each image
// against its pinned sha256 + size from manifest.js, so a wrong or damaged romset fails loudly.
//
// Usage: node games/frogger/tools/build-rom.mjs [path/to/setdir-or-zip]
//        default source: $ROMZIP, else ~/Downloads/frogger (the loose MAME set dir), else ~/Downloads/frogger.zip

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const gameDir = dirname(here); // games/frogger
const manifest = (await import(pathToFileURL(join(gameDir, "manifest.js")))).default;

const HOME = process.env.HOME || "";
const src = process.argv[2] || process.env.ROMZIP ||
  (existsSync(join(HOME, "Downloads", "frogger")) ? join(HOME, "Downloads", "frogger")
    : join(HOME, "Downloads", manifest.rom.zip));

const romDir = join(gameDir, "rom");
mkdirSync(romDir, { recursive: true });

// Resolve a source directory of loose part files: unzip a zip to a temp dir, or use the set dir as-is.
let work = null;
let partDir;
try {
  if (existsSync(src) && statSync(src).isDirectory()) {
    partDir = src;
  } else {
    work = mkdtempSync(join(tmpdir(), "frogger-rombuild-"));
    const parts = Object.values(manifest.rom.images).flatMap((s) => s.parts);
    execFileSync("unzip", ["-o", "-j", src, ...parts, "-d", work], { stdio: ["ignore", "ignore", "inherit"] });
    partDir = work;
  }

  const swapD0D1 = (b) => (b & 0b11111100) | ((b >> 1) & 1) | ((b << 1) & 2);

  // Per-image assembly. Default is plain concat; maincpu pads to size; gfx swaps its plane1.
  const assemble = {
    maincpu(parts, size) {
      const buf = Buffer.alloc(size, 0x00); // 0x00 pad == MAME region zero-fill for 0x3000-0x3FFF
      let off = 0;
      for (const p of parts) { const d = readFileSync(join(partDir, p)); d.copy(buf, off); off += d.length; }
      return buf;
    },
    gfx(parts) {
      const plane0 = readFileSync(join(partDir, parts[0])); // frogger.607, verbatim
      const raw = readFileSync(join(partDir, parts[1]));     // frogger.606, D0<->D1 swapped
      const plane1 = Buffer.from(raw);
      for (let i = 0; i < plane1.length; i++) plane1[i] = swapD0D1(raw[i]);
      return Buffer.concat([plane0, plane1]);
    },
    proms(parts) {
      return Buffer.concat(parts.map((p) => readFileSync(join(partDir, p))));
    },
  };

  let ok = true;
  for (const [name, spec] of Object.entries(manifest.rom.images)) {
    const build = assemble[name];
    if (!build) throw new Error(`no assembler for image "${name}"`);
    const buf = build(spec.parts, spec.size);
    writeFileSync(join(romDir, `${name}.bin`), buf);
    const got = createHash("sha256").update(buf).digest("hex");
    const good = got === spec.sha256 && buf.length === spec.size;
    if (!good) ok = false;
    console.log(`${good ? "OK " : "BAD"}  ${name}.bin  ${buf.length}B  ${got}`);
    if (!good) console.error(`     expected ${spec.size}B ${spec.sha256}`);
  }
  console.log(ok
    ? `\n✓ frogger ROM assembled & verified → ${romDir}`
    : `\n✗ verification FAILED — wrong or damaged romset`);
  process.exit(ok ? 0 : 1);
} catch (e) {
  console.error(`\n✗ ROM build failed: ${e.message}`);
  console.error(`  (is "${src}" a valid frogger set dir or zip?)`);
  process.exit(1);
} finally {
  if (work) rmSync(work, { recursive: true, force: true });
}
