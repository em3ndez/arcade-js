// SPDX-License-Identifier: GPL-3.0-only
/**
 * Shared entry-capture harness for the Time Pilot idiomatic gates. Every gate drives the tape the
 * pixel gate uses — coin, then start — so an entry is captured while the game is PLAYING; attract
 * reaches these routines too, but the tape buys the QUALITY of the entry. Frames are the JS-side
 * tape, one later than the lua, per tools/pixel_suite.py.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Machine } from "../../machine.js";
import { buildRoutines } from "../../routines.js";

const GAME = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ROM = join(GAME, "rom");

export const COIN_FRAME = 401;
export const START_FRAME = 501;
const HOLD = 8;
const IN0 = 0xc300;

/**
 * Frames before giving up on an entry. Measured: the batch's latest first dispatch is frame 1092,
 * and 900 made two of ten throw "never entered". Raising it cannot fix a gate whose FIRST dispatch
 * is uninformative — unitEquivalence clones the first entry, not the first useful one.
 */
export const ENTRY_FRAMES = 1400;

export const COIN_START_TAPE = [
  { frame: COIN_FRAME, port: IN0, bits: 0x01, dur: HOLD },
  { frame: START_FRAME, port: IN0, bits: 0x08, dur: HOLD },
];

const IMAGES = ["maincpu.bin", "tiles.bin", "sprites.bin", "proms.bin"];

/** ROM data is copyright and gitignored, so a fresh clone has none; gates must SKIP, not crash. */
export function romsPresent() {
  return IMAGES.every((f) => existsSync(join(ROM, f)));
}

let cached = null;
function romImages() {
  if (!cached) {
    cached = {
      rom: readFileSync(join(ROM, "maincpu.bin")),
      tiles: readFileSync(join(ROM, "tiles.bin")),
      sprites: readFileSync(join(ROM, "sprites.bin")),
      proms: readFileSync(join(ROM, "proms.bin")),
    };
  }
  return cached;
}

/**
 * makeMachine for unitEquivalence: overrides over the translated registry, tape armed. WIRED RAW,
 * and CORRECT raw: the map holds ONE entry, the entry-capture probe, and that probe calls the
 * frozen ORACLE, which rets for itself -- the two arms unitEquivalence compares are direct calls
 * that never consult the map. Wrapping it with machine.js's `withOmittedRet` would hand the oracle
 * a SECOND ret, over-popping two bytes per dispatch, OPPOSITE the leak the seam fixes. Measured:
 * routed, the host dies in the ring drain and 210 of 246 tests across eight gates fail.
 */
export function makeMachine(overrides, opts = {}) {
  const { rom, tiles, sprites, proms } = romImages();
  const routines = buildRoutines();
  if (overrides) for (const [addr, fn] of overrides) routines.set(addr, fn);
  const m = new Machine(rom, routines, { tiles, sprites, proms });
  m.inputTape = opts.tape ?? COIN_START_TAPE;
  return m;
}
