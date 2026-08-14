// SPDX-License-Identifier: GPL-3.0-only
/**
 * Shared capture harness for the Frogger idiomatic equivalence gates. Builds the real Machine from
 * the assembled ROM and runs plain attract; a gate hooks a routine's address, clones each dispatch,
 * and replays the oracle and the rewrite in isolation on identical state. Frogger's attract reaches
 * the render/setup leaves with no input, so most gates need no tape.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Machine } from "../../machine.js";
import { buildRoutines } from "../../routines.js";

const GAME = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ROM = join(GAME, "rom");
const IMAGES = ["maincpu.bin", "gfx.bin", "proms.bin"];

/** ROM data is copyright and gitignored, so a fresh clone has none; gates must SKIP, not crash. */
export function romsPresent() {
  return IMAGES.every((f) => existsSync(join(ROM, f)));
}

let cached = null;
function romImages() {
  if (!cached) {
    cached = {
      rom: new Uint8Array(readFileSync(join(ROM, "maincpu.bin"))),
      gfx: new Uint8Array(readFileSync(join(ROM, "gfx.bin"))),
      proms: new Uint8Array(readFileSync(join(ROM, "proms.bin"))),
    };
  }
  return cached;
}

/** Frames of attract to run for a healthy dispatch corpus. */
export const ENTRY_FRAMES = 900;

/** A frogger Machine with `overrides` (a Map addr->fn) wired over the translated base; plain attract. */
export function makeMachine(overrides) {
  const { rom, gfx, proms } = romImages();
  const routines = buildRoutines();
  if (overrides) for (const [addr, fn] of overrides) routines.set(addr, fn);
  return new Machine(rom, routines, { gfx, proms });
}
