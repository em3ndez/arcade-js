// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_18a6 — crafted-entry equivalence vs the frozen LFO decay step at ROM 0x18a6.
 * Gated to the 0xff tick (0x425f) with a nonzero level (0x421f): it drops the level by one and
 * broadcasts it across the four LFO frequency latches (0x6004-0x6007). The 0x421f store is work RAM
 * (ramDiff), but the four latch writes hit the sound DEVICE (io.soundLfo, NOT in the state dump), so
 * they are checked on the device. Paths: run, not-armed (tick != 0xff), and exhausted (level 0).
 * Teeth: no-op (RAM), gate-ignoring (RAM), and a no-rotate twin caught only on the device.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { decaySoundLfoLevel as cand } from "../decaySoundLfoLevel.js";
import { loc_18a6 as oracle } from "../../translated/loc_18a6.js";

const TICK = 0x425f;
const LEVEL_CELL = 0x421f;
const LFO_BASE = 0x6004;
const LEVEL = 0xb1;          // rotations of 0xb0 are all distinct — a sensitive probe
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const runEntry = () => craft((mem, mm) => { mem[TICK] = 0xff; mem[LEVEL_CELL] = LEVEL; mm.push16(0x9999); });
const notArmed = () => craft((mem, mm) => { mem[TICK] = 0xfe; mem[LEVEL_CELL] = LEVEL; mm.push16(0x9999); });
const exhausted = () => craft((mem, mm) => { mem[TICK] = 0xff; mem[LEVEL_CELL] = 0; mm.push16(0x9999); });

// The four latch values the sound device recorded after running `fn` from the seed.
function lfoAfter(fn, entry) {
  const x = entry.clone(); x.routines = STUBS; fn(x); return Array.from(x.mem.io.soundLfo);
}

test("EQUAL (crafted): loc_18a6 == oracle decays and broadcasts on the run path", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, runEntry()), null, "loc_18a6 diverged on the 0x421f store");
  assert.deepEqual(lfoAfter(cand, runEntry()), lfoAfter(oracle, runEntry()), "loc_18a6 diverged on the LFO latches");
  const a = runEntry(); oracle(a);
  assert.equal(a.mem8[LEVEL_CELL], LEVEL - 1, "positive control: oracle did not decrement the level");
});

test("EQUAL (crafted): loc_18a6 == oracle bails off-tick", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, notArmed()), null, "loc_18a6 diverged on the not-armed path");
  const a = notArmed(); oracle(a);
  assert.equal(a.mem8[LEVEL_CELL], LEVEL, "positive control: off-tick -> level untouched");
});

test("EQUAL (crafted): loc_18a6 == oracle leaves an exhausted level at 0", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, exhausted()), null, "loc_18a6 diverged on the exhausted path");
  const a = exhausted(); oracle(a);
  assert.equal(a.mem8[LEVEL_CELL], 0, "positive control: exhausted -> stays 0");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const ignoreGate = (m) => { m.mem8[LEVEL_CELL] = (m.mem8[LEVEL_CELL] - 1) & 0xff; }; // decays off-tick too
  // Correct 0x421f store but writes the same byte to every latch (no rotation) — invisible to ramDiff.
  const noRotate = (m) => {
    const v = (m.mem8[LEVEL_CELL] - 1) & 0xff;
    m.mem8[LEVEL_CELL] = v;
    for (let i = 0; i < 4; i++) m.mem8[LFO_BASE + i] = v;
  };
  assert.ok(ramDiff(oracle, noOp, runEntry()), "no-op twin escaped (RAM)");
  assert.ok(ramDiff(oracle, ignoreGate, notArmed()), "gate-ignoring twin escaped (RAM)");
  assert.equal(ramDiff(oracle, noRotate, runEntry()), null, "sanity: no-rotate matches on RAM");
  assert.notDeepEqual(lfoAfter(noRotate, runEntry()), lfoAfter(oracle, runEntry()), "no-rotate twin escaped (device)");
});
