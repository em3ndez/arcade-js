#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
/**
 * The Pit RENDER emitter — the JS side of the pixel gate (game #2).
 *
 * Boots the JS machine WITH the tile/palette ROMs, runs it for N frames, and at
 * every frame boundary snapshots boards/thepit/video.js renderFrame() into a
 * frames.rgb in the SAME wire format the MAME golden and DK's emit.js use:
 *   256x224 RGB888, row-major, top-left origin, UNROTATED, headerless
 *   concatenation, 172032 bytes/frame + a frames.json index.
 *
 * FRAME MAPPING (matches the frozen framediff offset of +1):
 *   renders[N] = renderFrame() evaluated on the memory at boundary N = render of
 *   state[N] (the image the RAM produces after frames 0..N-1 have executed).
 *   MAME's AVI writer LAGS ONE FRAME, so AVI[N] is the image of emulated frame
 *   N-1 ≈ render(state[N]) = renders[N]. framediff maps JS[M] -> golden[M+1], so
 *   JS[M] must be render(state[M+1]): we DROP the power-on render[0] and write
 *   renders[1..] as the JS frames. Same count relationship as DK — K captured
 *   state frames yield K-1 painted frames.
 *
 * gfx/proms are assembled from the romset parts named in games/thepit/manifest.js
 * (gfx = p9.ic9@0x0000 + p8.ic8@0x1000 in a 0x1800 image with a 0x0800-0x0FFF
 * gap; proms = 82s123.ic4), each verified against the manifest sha256 so a wrong
 * or damaged romset fails loudly rather than mis-rendering.
 *
 *   --frames N     frames to run (default 305 ≈ 5s at 60.606Hz -> 304 painted)
 *   --rom PATH     maincpu image (default <game>/rom/maincpu.bin)
 *   --romset DIR   dir holding the gfx/proms parts
 *   --frames-out D output dir (default <game>/out/emit)
 *
 * HONEST ABOUT SCOPE, like emit.js: a short run (a boot gap before the target)
 * writes the frames it DID produce, prints the stop reason, and exits NON-ZERO.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Machine, UnregisteredRoutine } from "../machine.js";
import { UnmappedAccess } from "../../../boards/thepit/memory.js";
import manifest from "../manifest.js";

const GAME_DIR = dirname(dirname(fileURLToPath(import.meta.url))); // games/thepit
const BYTES_PER_FRAME = 256 * 224 * 3; // 172032, the frame contract
const hex4 = (v) => `0x${(v & 0xffff).toString(16).padStart(4, "0")}`;
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

// The romset that carries the gfx/proms parts (session scratchpad by default).
const DEFAULT_ROMSET =
  "/private/tmp/claude-502/-Users-qarl-project-arcade2/" +
  "f4c9de89-1f90-4173-9b14-5c0e5a2e8d2d/scratchpad/mameroms/thepitu1";

function parseArgs(argv) {
  const args = {
    rom: join(GAME_DIR, "rom", "maincpu.bin"),
    romset: DEFAULT_ROMSET,
    frames: 305,
    framesOut: join(GAME_DIR, "out", "emit"),
  };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case "--rom": args.rom = argv[++i]; break;
      case "--romset": args.romset = argv[++i]; break;
      case "--frames": {
        const v = Number(argv[++i]);
        if (!Number.isInteger(v) || v < 2) {
          throw new Error(`--frames expects an integer >= 2, got ${argv[i]}`);
        }
        args.frames = v;
        break;
      }
      case "--frames-out": args.framesOut = argv[++i]; break;
      default: throw new Error(`unknown argument: ${argv[i]}`);
    }
  }
  return args;
}

/**
 * Assemble one manifest ROM image from its named parts, placing each part at its
 * declared offset (default: end-to-end) into a `size`-byte buffer, then verify
 * the whole image against the manifest sha256.
 */
function assembleImage(name, spec, romsetDir) {
  const buf = new Uint8Array(spec.size);
  let cursor = 0;
  spec.parts.forEach((part, i) => {
    const data = new Uint8Array(readFileSync(join(romsetDir, part)));
    const off = spec.offsets ? spec.offsets[i] : cursor;
    buf.set(data, off);
    cursor = off + data.length;
  });
  const got = sha256(buf);
  if (got !== spec.sha256) {
    throw new Error(
      `${name}: assembled image sha256 ${got} != manifest ${spec.sha256} ` +
        `(wrong or damaged romset in ${romsetDir}?)`,
    );
  }
  return buf;
}

function writeFrames(dir, shots) {
  mkdirSync(dir, { recursive: true });
  const buf = Buffer.concat(shots.map((f) => Buffer.from(f)));
  writeFileSync(join(dir, "frames.rgb"), buf);
  writeFileSync(
    join(dir, "frames.json"),
    JSON.stringify(
      {
        width: 256, height: 224, bytes_per_frame: BYTES_PER_FRAME,
        pixel_format: "RGB888", origin: "top-left", count: shots.length,
        frames: shots.map((f, i) => ({ i, sha256: sha256(Buffer.from(f)) })),
      },
      null, 2,
    ) + "\n",
  );
  return buf.length;
}

async function main() {
  const args = parseArgs(process.argv);
  const rom = new Uint8Array(readFileSync(args.rom));
  const gfx = assembleImage("gfx", manifest.rom.images.gfx, args.romset);
  const proms = assembleImage("proms", manifest.rom.images.proms, args.romset);

  const machine = await Machine.create(rom, { gfx, proms });

  // Capture a rendered frame at every state boundary by piggy-backing on the
  // dumpState the boundary loop already calls (state[0] power-on, then one per
  // frame). renders[] stays in exact lockstep with machine.frames[].
  const renders = [];
  const origDump = machine.dumpState.bind(machine);
  machine.dumpState = () => {
    renders.push(machine.renderFrame());
    return origDump();
  };

  const want = args.frames;
  const frames = machine.runFrames(want);
  const err = machine.stopError;

  if (renders.length !== frames.length) {
    throw new Error(
      `render/state lockstep broken: ${renders.length} renders vs ${frames.length} states`,
    );
  }

  // Drop the power-on render[0]; JS[M] = renders[M+1] to line up with AVI[M+1]
  // under the frozen +1 offset. A K-state run yields K-1 painted frames.
  const shots = renders.slice(1);
  if (shots.length === 0) {
    throw new Error("no frames painted: a render is dropped for power-on, so N states -> N-1 frames");
  }
  const bytes = writeFrames(args.framesOut, shots);
  const distinct = new Set(shots.map((f) => sha256(Buffer.from(f)))).size;
  console.log(
    `wrote ${shots.length} frame(s) x ${BYTES_PER_FRAME} bytes (${bytes} bytes) ` +
      `-> ${join(args.framesOut, "frames.rgb")}\n` +
      `  ${distinct} DISTINCT image(s) — the frame count is inflated by repetition, ` +
      "the distinct count is not",
  );

  if (err instanceof UnregisteredRoutine) {
    console.error(
      `\nBOOT GAP: unregistered routine at ${hex4(err.addr)} after ` +
        `${frames.length} states / ${shots.length} painted frames.`,
    );
    return 1;
  }
  if (err instanceof UnmappedAccess) {
    console.error(`\nSTOP: unmapped memory access — ${err.message}.`);
    return 1;
  }
  if (err) {
    console.error(`\nSTOP: ${machine.stoppedBy}.`);
    return 1;
  }
  if (frames.length < want) {
    console.error(
      `\nNOTE: asked for ${want} states, produced only ${frames.length} with no ` +
        "recorded stop reason — investigate before trusting this run.",
    );
    return 1;
  }

  console.log(
    `\nCLEAN: rendered ${shots.length} frames with no translation gap. ` +
      "Pixel-diff frames.rgb against the MAME golden to validate.",
  );
  return 0;
}

process.exit(await main());
