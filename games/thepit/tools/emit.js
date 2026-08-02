#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
/**
 * The Pit validation-artifact emitter — a thin wrapper over the shared emit machinery
 * in tools/emit-core.js (arg grammar, state.bin/state.json writer, hashing). This file
 * holds only the Pit-specific extra: the BOOT-GAP report.
 *
 * THE WHOLE POINT is the BOOT GAP. The Machine runs only the frozen translated oracle;
 * when it m.call()s a ROM address with no translated routine yet, that throws
 * UnregisteredRoutine. This catches it and reports EXACTLY which address, at which
 * frame/cycle — that address is the next routine to translate. Reaching the frame
 * target instead means the boot + main loop are complete enough to run that far.
 *
 *   --frames N        frames to emit (default 200)
 *   --state-out DIR   output dir (default <game>/out/emit)
 *   --poke / --input  ADDR=VAL@FRAME / PORT=BITS@FRAME  (see tools/emit-core.js)
 *   --rom PATH        maincpu image (default <game>/rom/maincpu.bin)
 *
 * A short run (a boot gap before the target) writes the frames it produced, prints the
 * gap, and exits NONZERO — a short artifact must never read as complete.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Machine, CYCLES_PER_FRAME, UnregisteredRoutine } from "../machine.js";
import {
  STATE_DUMP_SIZE,
  WORK_RAM_BASE, WORK_RAM_SIZE,
  COLOR_RAM_BASE, COLOR_RAM_SIZE,
  VIDEO_RAM_BASE, VIDEO_RAM_SIZE,
  ATTRSPR_BASE, ATTRSPR_SIZE,
  UnmappedAccess,
} from "../../../boards/thepit/memory.js";
import {
  parseEmitArgs, writeStateArtifact, hex4, distinctCount,
} from "../../../tools/emit-core.js";

const GAME_DIR = dirname(dirname(fileURLToPath(import.meta.url))); // games/thepit

const REGIONS = [
  { name: "work", start: hex4(WORK_RAM_BASE), len: WORK_RAM_SIZE },
  { name: "color", start: hex4(COLOR_RAM_BASE), len: COLOR_RAM_SIZE },
  { name: "video", start: hex4(VIDEO_RAM_BASE), len: VIDEO_RAM_SIZE },
  { name: "attrspr", start: hex4(ATTRSPR_BASE), len: ATTRSPR_SIZE },
];

async function main() {
  const args = parseEmitArgs(process.argv, {
    defaults: {
      rom: join(GAME_DIR, "rom", "maincpu.bin"),
      frames: 200,
      stateOut: join(GAME_DIR, "out", "emit"),
    },
  });
  // The Pit runs a fixed frame budget — it does not support DK's "all" sentinel.
  if (!Number.isInteger(args.frames) || args.frames < 1) {
    throw new Error(`--frames expects a positive integer, got ${args.frames}`);
  }
  const rom = new Uint8Array(readFileSync(args.rom));

  const machine = await Machine.create(rom);
  machine.inputTape = args.inputs.length ? args.inputs : null;
  machine.pokes = args.pokes.length ? args.pokes : null;
  const want = args.frames;
  // runFrames keeps whatever it captured and records why it stopped, so a boot gap
  // yields a short-but-valid artifact rather than nothing.
  const frames = machine.runFrames(want);

  const err = machine.stopError;
  const bytes = writeStateArtifact(args.stateOut, frames, {
    stateDumpSize: STATE_DUMP_SIZE, regions: REGIONS,
  });
  console.log(
    `wrote ${frames.length} frame(s) x ${STATE_DUMP_SIZE} bytes ` +
      `(${bytes} bytes) -> ${join(args.stateOut, "state.bin")}`,
  );
  console.log(
    `  ${distinctCount(frames)} DISTINCT state(s) ` +
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
