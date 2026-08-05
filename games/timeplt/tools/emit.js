#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
/**
 * Time Pilot validation-artifact emitter — runs the translated layer from reset and
 * writes state.bin / state.json for tools/statediff.py to compare against the MAME
 * golden capture in games/timeplt/out/golden/.
 *
 * THE POINT IS THE BOOT GAP. The Machine executes only translated routines; calling a
 * ROM address that has no `translated/loc_<addr>.js` throws, and this reports exactly
 * which address, at which frame and cycle. That address is the next routine to lift.
 * Reaching the frame target instead means boot and the main loop run that far.
 *
 *   --frames N        frames to emit (default 242, the golden capture's length)
 *   --state-out DIR   output dir (default games/timeplt/out/emit)
 *   --rom PATH        maincpu image (default games/timeplt/rom/maincpu.bin)
 *
 * A short run writes the frames it produced, prints the gap, and exits NONZERO: a
 * short artifact must never read as a clean one.
 *
 * There is no --poke / --input here yet. The Machine has no input tape or poke
 * plumbing, and accepting flags it would silently ignore is worse than rejecting them.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Machine, CYCLES_PER_FRAME } from "../machine.js";
import { buildRoutines } from "../routines.js";
import {
  STATE_DUMP_SIZE,
  COLOR_RAM_BASE, COLOR_RAM_SIZE,
  VIDEO_RAM_BASE, VIDEO_RAM_SIZE,
  WORK_RAM_BASE, WORK_RAM_SIZE,
  SPRITE0_BASE, SPRITE1_BASE, SPRITE_SIZE,
} from "../../../boards/timeplt/memory.js";
import { parseEmitArgs, writeStateArtifact, hex4, distinctCount } from "../../../tools/emit-core.js";

const GAME_DIR = dirname(dirname(fileURLToPath(import.meta.url))); // games/timeplt

// Order IS the contract: it must match AddressSpace.dumpState(), the stateRegions in
// boards/timeplt/hardware.json, and the REGIONS list in tools/lua/dump_state.lua.
const REGIONS = [
  { name: "color", start: hex4(COLOR_RAM_BASE), len: COLOR_RAM_SIZE },
  { name: "video", start: hex4(VIDEO_RAM_BASE), len: VIDEO_RAM_SIZE },
  { name: "work", start: hex4(WORK_RAM_BASE), len: WORK_RAM_SIZE },
  { name: "sprite0", start: hex4(SPRITE0_BASE), len: SPRITE_SIZE },
  { name: "sprite1", start: hex4(SPRITE1_BASE), len: SPRITE_SIZE },
];

async function main() {
  const args = parseEmitArgs(process.argv, {
    defaults: {
      rom: join(GAME_DIR, "rom", "maincpu.bin"),
      frames: 242,
      stateOut: join(GAME_DIR, "out", "emit"),
    },
  });
  if (!Number.isInteger(args.frames) || args.frames < 1) {
    throw new Error(`--frames expects a positive integer, got ${args.frames}`);
  }
  if (args.pokes.length || args.inputs.length) {
    throw new Error("--poke/--input are not plumbed on this board yet; they would be ignored");
  }

  const rom = new Uint8Array(readFileSync(args.rom));
  const machine = new Machine(rom, buildRoutines());
  const want = args.frames;
  const frames = machine.runFrames(want);

  const bytes = writeStateArtifact(args.stateOut, frames, {
    stateDumpSize: STATE_DUMP_SIZE, regions: REGIONS,
  });
  console.log(
    `wrote ${frames.length} frame(s) x ${STATE_DUMP_SIZE} bytes (${bytes} bytes) -> ` +
      join(args.stateOut, "state.bin"),
  );
  console.log(`  ${distinctCount(frames)} distinct state(s); ${machine.nmiCount} NMI(s)`);

  const err = machine.stoppedBy;
  if (err) {
    const gap = /no routine registered at (0x[0-9a-f]+)/.exec(err.message || "");
    if (gap) {
      console.error(
        `\nBOOT GAP: ${gap[1]} has no translated routine, reached after ` +
          `${frames.length} frame(s) / ${machine.cycles} cycles ` +
          `(last known PC ${hex4(machine.pc)})\n  -> write translated/loc_` +
          `${gap[1].slice(2).padStart(4, "0")}.js next.`,
      );
    } else {
      console.error(
        `\nSTOP after ${frames.length} frame(s) / ${machine.cycles} cycles ` +
          `(PC ${hex4(machine.pc)}): ${err.message || err}`,
      );
    }
    return 1;
  }
  if (frames.length < want) {
    console.error(
      `\nNOTE: asked for ${want} frames, produced ${frames.length} with no recorded stop ` +
        "reason — investigate before trusting this run.",
    );
    return 1;
  }

  // A FRAME COUNT CANNOT TELL RUNNING FROM SPINNING, and this printed CLEAN once while the
  // machine was wedged in a raster-sync spin at 0x1098 -- the cycle budget still drained, so the
  // frames still "advanced". The tell was the NMI count: a healthy run takes one vblank interrupt
  // per frame once boot arms them, and the wedged run took far fewer. Assert that here, because a
  // clean-looking artifact from a stuck machine is exactly the false pass this tool exists to
  // prevent. Boot runs with NMIs masked for a couple of hundred frames, so allow generous slack.
  // SAY when the check does not run. At the 242-frame default this window is negative, so
  // the assertion below is skipped -- and a skipped anti-spin check that prints nothing is
  // indistinguishable from a passing one, which is the failure this whole block exists to
  // stop. Announce the gap instead of leaving it silent.
  const expectedNmis = frames.length - 400;
  if (expectedNmis <= 0) {
    console.error(
      `note: anti-spin check NOT run -- ${frames.length} frames is inside the boot window ` +
        "where NMIs are masked, so there is no NMI floor to assert. Use --frames 1802.",
    );
  }
  if (expectedNmis > 0 && machine.nmiCount < expectedNmis) {
    console.error(
      `\nSTUCK: ran ${frames.length} frames but took only ${machine.nmiCount} NMI(s). ` +
        "A running machine takes roughly one per frame after boot arms them; far fewer means the " +
        "CPU is spinning while the cycle budget drains. The frames written are NOT a clean run.",
    );
    return 1;
  }

  console.log(
    `\nCLEAN: ran ${frames.length} frames (${(machine.cycles / CYCLES_PER_FRAME).toFixed(1)} ` +
      "frames of cycles) with no translation gap, taking " +
      `${machine.nmiCount} NMI(s). Now state-diff it against the golden.`,
  );
  return 0;
}

process.exit(await main());
