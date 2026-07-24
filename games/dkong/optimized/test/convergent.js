// SPDX-License-Identifier: GPL-3.0-only
/**
 * The convergent gate binding for Donkey Kong — the gate that LICENSES collapsing an
 * INTERRUPTIBLE routine (one the vblank NMI lands inside). See core/equivalence.js
 * `convergentEquivalence` and docs/06 for the theory: pixels are the ground truth; both
 * non-stack state and pixels may diverge TRANSIENTLY as long as they RECONVERGE; PERSISTENT
 * divergence in either fails; the dead stack scratch (where the mistimed NMI pushes a coarse
 * PC) is excluded outright. A byte-exact collapse of an ATOMIC routine passes the ordinary
 * strict gate and does NOT need this — reach for it only when the strict whole-machine gate
 * false-fails on the raster tear / dead-stack PC of an interruptible collapse.
 *
 * This wires the game in: loads the ROM + gfx/proms (pixels REQUIRE them), bakes an input
 * scenario that actually exercises the routine under a whole-machine run, enables video
 * capture, and excludes DK's dead stack region.
 */

import { existsSync, readFileSync } from "node:fs";
import { Machine } from "../../machine.js";
import { convergentEquivalence as coreConvergent, runBaseline } from "../../../../core/equivalence.js";
import { STACK_SCRATCH } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
export const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const rd = (n) => new Uint8Array(readFileSync(new URL(n, ROM_DIR)));
const ROM = ROM_PRESENT ? rd("maincpu.bin") : null;
// Pixels are the ground truth, so the convergent gate ALWAYS loads the graphics ROMs.
const ASSETS = ROM_PRESENT ? { gfx1: rd("gfx1.bin"), gfx2: rd("gfx2.bin"), proms: rd("proms.bin") } : {};

const DEAD_STACK = (a) => a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;

/**
 * Scenarios that drive a whole-machine run far enough for an interruptible routine to be
 * hit by the NMI many times, with a tail to observe reconvergence. Each is
 * `{ inputs?, pokes?, frames }` (input/poke entries are { port|addr, bits|val, frame, dur }).
 */
export const SCENARIOS = {
  // Plain boot — the attract demo plays 25m; enough for the idle-spin workers.
  attract: { frames: 1200 },
  // Coin, start, then walk right + a couple of jumps: active 25m gameplay. 1200 frames is
  // past the point the collapse's raster tear appears (~f1057) with margin before the tail.
  gameplay: {
    frames: 1200,
    inputs: [
      { port: 0x7d00, bits: 0x80, frame: 400, dur: 1 },   // coin
      { port: 0x7d00, bits: 0x04, frame: 460, dur: 1 },   // start
      { port: 0x7c00, bits: 0x01, frame: 900, dur: 400 }, // P1 right, held
      { port: 0x7c00, bits: 0x10, frame: 1200, dur: 8 },  // jump
      { port: 0x7c00, bits: 0x10, frame: 1500, dur: 8 },  // jump
    ],
  },
};

function makeFactory(scenario) {
  return (overrides) => {
    const m = new Machine(ROM, overrides ? { ...ASSETS, overrides } : { ...ASSETS });
    if (scenario?.inputs) m.inputTape = scenario.inputs.map((x) => ({ ...x }));
    if (scenario?.pokes) m.pokes = scenario.pokes.map((x) => ({ ...x }));
    m.captureVideo = true;
    return m;
  };
}

// The all-oracle baseline depends ONLY on (scenario, frames) — not on which routine is
// overridden — so every gate call sharing a scenario can share one baseline instead of
// re-emulating it from boot. Two gate calls per routine (EQUAL + TEETH) would otherwise pay
// for the same baseline twice, and with video capture that is the single most expensive
// thing this file does. Keyed by scenario CONTENT, since callers may pass a spread copy
// (e.g. `{...SCENARIOS.attract, frames: 600}`) rather than the shared constant.
const baselineCache = new Map();

function baselineFor(scenario) {
  const key = JSON.stringify({
    frames: scenario.frames,
    inputs: scenario.inputs ?? null,
    pokes: scenario.pokes ?? null,
  });
  let cached = baselineCache.get(key);
  if (!cached) {
    cached = runBaseline(makeFactory(scenario), scenario.frames);
    baselineCache.set(key, cached);
  }
  return cached;
}

/**
 * Run the convergent gate for `overrides` under `scenario`. Returns the core result
 * ({ pass, invocations, statePersistent, pixelPersistent, pixDiffFrames, maxPixels, ... }).
 * DK's dead stack is excluded; the default tail window is 30 frames. The all-oracle baseline
 * is emulated once per scenario and reused (see baselineFor).
 */
export function convergentGate(overrides, { scenario = SCENARIOS.gameplay, tailWindow = 30, name } = {}) {
  return coreConvergent(makeFactory(scenario), scenario.frames, overrides, {
    excludeAddr: DEAD_STACK,
    tailWindow,
    name,
    baseline: baselineFor(scenario),
  });
}
