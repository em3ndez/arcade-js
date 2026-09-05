// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_13e1 — crafted-entry equivalence vs the frozen direction-flag chooser at ROM 0x13e1.
 * It reads the formation anchor word (0x420e) and the X sweep bounds (0x4210) and writes a 0/1 flag to
 * 0x4215 — forced away from a nearby bound, or a random bit0 (advancing the LCG seed 0x401e) when the
 * anchor sits well inside. All live-outs are work RAM (the flag, and the seed on the random path), so
 * ramDiff alone suffices. Register A is NOT a live-out (the caller's next act is another call). Three
 * paths: force-1 (positive anchor near the low bound), force-0 (negative anchor near the high bound),
 * random (anchor far from either). Teeth: no-op, wrong-flag twins, and on the random path a
 * seed-not-advanced twin and a no-mask twin (stores the whole seed, not bit0).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { loc_13e1 as cand } from "../loc_13e1.js";
import { loc_13e1 as oracle } from "../../translated/loc_13e1.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const ANCHOR = 0x420e; // low, high bytes
const BOUNDS = 0x4210; // low bound, high bound bytes
const DIR = 0x4215;    // the 0/1 direction flag written
const SEED = 0x401e;   // LCG seed advanced only on the random path
const DIRT = 0xaa;     // pre-poked into the flag cell so a write is demonstrable

// force-1: positive anchor (high bit clear), low byte close under the low bound -> gap 16 < 28 -> flag 1.
const force1 = () => craft((mem, m) => {
  m.push16(0x9999);
  mem[ANCHOR] = 0x10; mem[ANCHOR + 1] = 0x00;
  mem[BOUNDS] = 0x20; mem[BOUNDS + 1] = 0x00;
  mem[DIR] = DIRT;
});
// force-0: negative anchor (high bit set), low byte close over the high bound -> gap 16 < 28 -> flag 0.
const force0 = () => craft((mem, m) => {
  m.push16(0x9999);
  mem[ANCHOR] = 0x30; mem[ANCHOR + 1] = 0x80;
  mem[BOUNDS] = 0x00; mem[BOUNDS + 1] = 0x20;
  mem[DIR] = DIRT;
});
// random: positive anchor far below the low bound -> gap 80 >= 28 -> flag = fresh seed bit0.
const random = () => craft((mem, m) => {
  m.push16(0x9999);
  mem[ANCHOR] = 0x00; mem[ANCHOR + 1] = 0x00;
  mem[BOUNDS] = 0x50; mem[BOUNDS + 1] = 0x00;
  mem[DIR] = DIRT;
  mem[SEED] = 0x40; // seed*5+1 = 0x41 -> bit0 = 1, whole byte = 0x41 (distinguishable)
});

test("EQUAL (crafted): loc_13e1 == oracle on the forced and random paths", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, force1()), null, "loc_13e1 diverged forcing flag 1");
  assert.equal(ramDiff(oracle, cand, force0()), null, "loc_13e1 diverged forcing flag 0");
  assert.equal(ramDiff(oracle, cand, random()), null, "loc_13e1 diverged on the random path");
  // positive controls off the oracle.
  const a = force1(); oracle(a); assert.equal(a.mem8[DIR], 1, "control: oracle forced flag 1");
  const b = force0(); oracle(b); assert.equal(b.mem8[DIR], 0, "control: oracle forced flag 0");
  const c = random(); oracle(c);
  assert.equal(c.mem8[SEED], 0x41, "control: oracle advanced the seed");
  assert.equal(c.mem8[DIR], 1, "control: oracle stored the seed's bit0");
  console.log("  EQUAL: loc_13e1 == oracle (RAM) on force-1, force-0, random");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const always0 = (m) => { m.mem8[DIR] = 0; };
  const always1 = (m) => { m.mem8[DIR] = 1; };
  // random-path twins: bit0 from the un-advanced seed with no store, and the whole advanced seed (no mask).
  const seedNotAdvanced = (m) => { m.mem8[DIR] = m.mem8[SEED] & 0x01; };
  const noMask = (m) => { const s = (m.mem8[SEED] * 5 + 1) & 0xff; m.mem8[SEED] = s; m.mem8[DIR] = s; };
  assert.ok(ramDiff(oracle, noOp, force1()), "the no-op twin escaped (force-1)");
  assert.ok(ramDiff(oracle, always0, force1()), "the always-0 twin escaped (force-1)");
  assert.ok(ramDiff(oracle, always1, force0()), "the always-1 twin escaped (force-0)");
  assert.ok(ramDiff(oracle, seedNotAdvanced, random()), "the seed-not-advanced twin escaped (random)");
  assert.ok(ramDiff(oracle, noMask, random()), "the no-mask twin escaped (random)");
  console.log("  TEETH: no-op, always-0, always-1, seed-not-advanced, no-mask all caught");
});
