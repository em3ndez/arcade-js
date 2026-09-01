#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
/**
 * Space Invaders validation-artifact emitter -- runs the translated layer from reset and writes
 * state.bin / state.json for tools/statediff.py to compare against the MAME golden.
 *
 * THE POINT IS THE BOOT GAP. The Machine executes only translated routines; calling a ROM address with
 * no translated/loc_<addr>.js throws, and this reports which address, at which frame/cycle -- the next
 * routine to lift. Reaching the frame target instead means boot + the main loop ran that far.
 *
 *   --frames N        frames to emit (default 121; the golden has 121, so match its length)
 *   --state-out DIR   output dir (default games/invaders/out/emit)
 *   --poke / --input  ADDR=VAL@FRAME / PORT=BITS@FRAME  (see tools/emit-core.js)
 *   --rom PATH        maincpu image (default games/invaders/rom/maincpu.bin)
 *
 * A short run writes what it produced, prints the gap, and exits NONZERO.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Machine } from "../machine.js";
import { buildRoutines } from "../routines.js";
import { STATE_DUMP_SIZE, RAM_BASE, RAM_SIZE } from "../../../boards/invaders/memory.js";
import { parseEmitArgs, writeStateArtifact, hex4, distinctCount } from "../../../tools/emit-core.js";

const GAME_DIR = dirname(dirname(fileURLToPath(import.meta.url))); // games/invaders

// Single region: main_ram 0x2000-0x3FFF (work RAM + framebuffer). Mirrors hardware.json "stateRegions"
// and the REGIONS list in tools/lua/dump_state.lua.
const REGIONS = [{ name: "main_ram", start: hex4(RAM_BASE), len: RAM_SIZE }];

async function main() {
  const args = parseEmitArgs(process.argv, {
    defaults: {
      rom: join(GAME_DIR, "rom", "maincpu.bin"),
      frames: 121,
      stateOut: join(GAME_DIR, "out", "emit"),
    },
  });
  if (!Number.isInteger(args.frames) || args.frames < 1) {
    throw new Error(`--frames expects a positive integer, got ${args.frames}`);
  }
  const rom = new Uint8Array(readFileSync(args.rom));
  const machine = new Machine(rom, buildRoutines());
  machine.inputTape = args.inputs.length ? args.inputs : null;
  machine.pokes = args.pokes.length ? args.pokes : null;
  const want = args.frames;
  const frames = machine.runFrames(want);

  const bytes = writeStateArtifact(args.stateOut, frames, {
    stateDumpSize: STATE_DUMP_SIZE, regions: REGIONS,
  });
  console.log(
    `wrote ${frames.length} frame(s) x ${STATE_DUMP_SIZE} bytes (${bytes} bytes) -> ` +
      join(args.stateOut, "state.bin"),
  );
  console.log(`  ${distinctCount(frames)} distinct state(s); ${machine.intCount} interrupt(s)`);

  const err = machine.stoppedBy;
  if (err) {
    const gap = /no routine registered at (0x[0-9a-f]+)/.exec(err.message || "");
    if (gap) {
      console.error(
        `\nBOOT GAP: ${gap[1]} has no translated routine, reached after ` +
          `${frames.length} frame(s) / ${machine.cycles} cycles (last known PC ${hex4(machine.pc)})\n` +
          `  -> write translated/loc_${gap[1].slice(2).padStart(4, "0")}.js next.`,
      );
    } else {
      console.error(
        `\nSTOP after ${frames.length} frame(s) / ${machine.cycles} cycles ` +
          `(PC ${hex4(machine.pc)}): ${err.message || err}`,
      );
    }
    return 1;
  }
  return 0;
}

main().then((code) => process.exit(code || 0));
