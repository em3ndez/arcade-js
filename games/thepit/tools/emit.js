#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
/**
 * The Pit boot-gap finder + state emitter.
 *
 * Boots the JS machine from reset and runs it for N frames, dumping the 4352-byte
 * per-frame RAM state (work 0x8000 / colour 0x8800 / video 0x9000 / attr+sprite
 * 0x9800, in that order) to games/thepit/out/emit/state.bin — the same layout and
 * ordering as the MAME golden (games/thepit/out/golden/state.bin).
 *
 * THE WHOLE POINT is the BOOT GAP. The Machine runs only the frozen translated
 * oracle; when it m.call()s a ROM address that has no translated routine yet, that
 * throws UnregisteredRoutine. This tool catches it and reports EXACTLY which
 * address, at which frame/cycle — that address is the next routine to translate.
 * Reaching the frame target instead means the boot + main loop are complete enough
 * to run that far.
 *
 *   --frames N     frames to emit (default 200)
 *   --rom PATH     maincpu image (default <game>/rom/maincpu.bin)
 *   --state-out D  output dir (default <game>/out/emit)
 *
 * HONEST ABOUT SCOPE, like DK's emit.js: a short run (a boot gap before the target)
 * writes the frames it DID produce, prints the gap, and exits NON-ZERO. A short
 * artifact must never exit 0 and read as complete.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Machine, CYCLES_PER_FRAME, UnregisteredRoutine } from "../machine.js";
import {
  STATE_DUMP_SIZE,
  WORK_RAM_BASE, WORK_RAM_SIZE,
  COLOR_RAM_BASE, COLOR_RAM_SIZE,
  VIDEO_RAM_BASE, VIDEO_RAM_SIZE,
  ATTRSPR_BASE, ATTRSPR_SIZE,
} from "../../../boards/thepit/memory.js";
import { UnmappedAccess } from "../../../boards/thepit/memory.js";

const GAME_DIR = dirname(dirname(fileURLToPath(import.meta.url))); // games/thepit
const hex4 = (v) => `0x${(v & 0xffff).toString(16).padStart(4, "0")}`;
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

function parseArgs(argv) {
  const args = {
    rom: join(GAME_DIR, "rom", "maincpu.bin"),
    frames: 200,
    stateOut: join(GAME_DIR, "out", "emit"),
  };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case "--rom": args.rom = argv[++i]; break;
      case "--frames": {
        const v = Number(argv[++i]);
        if (!Number.isInteger(v) || v < 1) {
          throw new Error(`--frames expects a positive integer, got ${argv[i]}`);
        }
        args.frames = v;
        break;
      }
      case "--state-out": args.stateOut = argv[++i]; break;
      default: throw new Error(`unknown argument: ${argv[i]}`);
    }
  }
  return args;
}

const REGIONS = [
  { name: "work", start: hex4(WORK_RAM_BASE), len: WORK_RAM_SIZE },
  { name: "color", start: hex4(COLOR_RAM_BASE), len: COLOR_RAM_SIZE },
  { name: "video", start: hex4(VIDEO_RAM_BASE), len: VIDEO_RAM_SIZE },
  { name: "attrspr", start: hex4(ATTRSPR_BASE), len: ATTRSPR_SIZE },
];

function writeState(dir, frames) {
  mkdirSync(dir, { recursive: true });
  const bin = Buffer.concat(frames.map((f) => Buffer.from(f)));
  writeFileSync(join(dir, "state.bin"), bin);
  writeFileSync(
    join(dir, "state.json"),
    JSON.stringify(
      {
        bytes_per_frame: STATE_DUMP_SIZE,
        count: frames.length,
        regions: REGIONS,
        frames: frames.map((f, i) => ({ i, sha256: sha256(Buffer.from(f)) })),
      },
      null,
      2,
    ) + "\n",
  );
  return bin.length;
}

async function main() {
  const args = parseArgs(process.argv);
  const rom = new Uint8Array(readFileSync(args.rom));

  const machine = await Machine.create(rom);
  const want = args.frames;
  // runFrames keeps whatever it captured and records why it stopped, so a boot
  // gap yields a short-but-valid artifact rather than nothing.
  const frames = machine.runFrames(want);

  const err = machine.stopError;
  const bytes = writeState(args.stateOut, frames);
  console.log(
    `wrote ${frames.length} frame(s) x ${STATE_DUMP_SIZE} bytes ` +
      `(${bytes} bytes) -> ${join(args.stateOut, "state.bin")}`,
  );
  console.log(
    `  ${new Set(frames.map((f) => sha256(Buffer.from(f)))).size} DISTINCT state(s) ` +
      "— the frame count is inflated by the boot busy-delay, the distinct count is not",
  );

  if (err instanceof UnregisteredRoutine) {
    console.error(
      `\nBOOT GAP: unregistered routine at ${hex4(err.addr)} after ` +
        `${frames.length} frames / ${machine.cycles} cycles` +
        (err.retHint === undefined ? "" : ` (return addr on stack ≈ ${hex4(err.retHint)})`) +
        `\n  -> translate loc_${(err.addr & 0xffff).toString(16).padStart(4, "0")}.js next.`,
    );
    return 1;
  }
  if (err instanceof UnmappedAccess) {
    console.error(
      `\nSTOP: unmapped memory access — ${err.message} after ` +
        `${frames.length} frames / ${machine.cycles} cycles (fix boards/thepit/memory.js).`,
    );
    return 1;
  }
  if (err) {
    console.error(
      `\nSTOP: ${machine.stoppedBy} after ${frames.length} frames / ${machine.cycles} cycles.`,
    );
    return 1;
  }
  if (frames.length < want) {
    console.error(
      `\nNOTE: asked for ${want} frames, produced only ${frames.length} and did not ` +
        "record a stop reason — investigate before trusting this run.",
    );
    return 1;
  }

  console.log(
    `\nCLEAN: booted and ran ${frames.length} frames ` +
      `(~${(machine.cycles / CYCLES_PER_FRAME).toFixed(1)} frames of cycles) with no ` +
      "translation gap. Diff state.bin against the MAME golden to validate.",
  );
  return 0;
}

process.exit(await main());
