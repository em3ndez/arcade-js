// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_17e5 — memory-equivalent to the frozen oracle at ROM 0x17e5. Sound-counter manager head: returns
 * untouched while the first gate's bit0 is set; else advances the pointer one cell and, when the second
 * gate's bit0 is set, tail-stages the pitch by the low two bits at the advanced pointer. Otherwise it bumps
 * the pointed cell only while the sound counter (0x41c4) stays below its ceiling (96), then falls into the
 * counter tick (decrement 0x41c4, stage the pitch). Every live-out is work RAM in the state dump — the
 * pointed cell, the sound counter, the staged pitch (0x41c1) — so EQUAL is asserted on ramDiff==null with a
 * positive control per path. Pure tail-dispatch (no m.push16), so no SP-seam tooth is owed. Teeth: no-op, an
 * always-bump twin (bumps past the ceiling), and a gate-ignoring twin (works while the first gate is set).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { advanceSoundSweepAndStagePitch as cand } from "../advanceSoundSweepAndStagePitch.js";
import { loc_17e5 as oracle } from "../../translated/loc_17e5.js";
import { tickSoundCounterAndStagePitch } from "../tickSoundCounterAndStagePitch.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const GATE1 = 0x4226;         // first gate: bit0 set -> return untouched
const GATE2 = 0x425f;         // second gate: bit0 set -> straight to the pitch-selector dispatcher
const SOUND_COUNTER = 0x41c4; // ceiling-compared, then decremented by the tick
const STAGED_PITCH = 0x41c1;  // where the pitch delegate parks its result
const HL0 = 0x4100;           // incoming pointer; the routine advances it by one before use
const PTR = HL0 + 1;          // the advanced pointer: selector source + bump target

const gateSet = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.hl = HL0;
  mem[GATE1] = 1; mem[GATE2] = 0; mem[SOUND_COUNTER] = 5; mem[PTR] = 0; mem[STAGED_PITCH] = 0xff;
});
const selectorPath = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.hl = HL0;
  mem[GATE1] = 0; mem[GATE2] = 1; mem[SOUND_COUNTER] = 5; mem[PTR] = 0; mem[STAGED_PITCH] = 0xff;
});
const atCeiling = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.hl = HL0;
  mem[GATE1] = 0; mem[GATE2] = 0; mem[SOUND_COUNTER] = 0xa0; mem[PTR] = 0; mem[STAGED_PITCH] = 0xff;
});
const belowCeiling = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.hl = HL0;
  mem[GATE1] = 0; mem[GATE2] = 0; mem[SOUND_COUNTER] = 0x10; mem[PTR] = 0; mem[STAGED_PITCH] = 0xff;
});

test("EQUAL (crafted): loc_17e5 == oracle across the four paths (RAM)", { skip }, () => {
  for (const [name, e] of [["gateSet", gateSet()], ["selector", selectorPath()],
                           ["atCeiling", atCeiling()], ["belowCeiling", belowCeiling()]]) {
    assert.equal(ramDiff(oracle, cand, e), null, `loc_17e5 diverged on the ${name} path`);
  }
  const g = gateSet(); g.routines = STUBS; oracle(g);
  assert.equal(g.mem8[SOUND_COUNTER], 5, "positive control: gate-set left the counter untouched");
  const s = selectorPath(); s.routines = STUBS; oracle(s);
  assert.equal(s.mem8[STAGED_PITCH], 96, "positive control: selector 0 staged the fixed pitch 96");
  const c = atCeiling(); c.routines = STUBS; oracle(c);
  assert.equal(c.mem8[SOUND_COUNTER], 0x9f, "positive control: at-ceiling ticked the counter down");
  assert.equal(c.mem8[PTR], 0, "positive control: at-ceiling left the pointed cell unbumped");
  const b = belowCeiling(); b.routines = STUBS; oracle(b);
  assert.equal(b.mem8[PTR], 1, "positive control: below-ceiling bumped the pointed cell");
  assert.equal(b.mem8[SOUND_COUNTER], 0x0f, "positive control: below-ceiling ticked the counter down");
  console.log("  EQUAL: loc_17e5 == oracle (RAM), gate-set + selector + at/below ceiling");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const alwaysBump = (m, ptr = m.regs.hl + 1) => {
    m.mem8[ptr]++; return tickSoundCounterAndStagePitch(m, m.mem8[SOUND_COUNTER], ptr);
  };
  const ignoreGate = (m, ptr = m.regs.hl + 1) =>
    tickSoundCounterAndStagePitch(m, m.mem8[SOUND_COUNTER], ptr);
  assert.ok(ramDiff(oracle, noOp, belowCeiling()), "the no-op twin escaped (below ceiling)");
  assert.ok(ramDiff(oracle, alwaysBump, atCeiling()), "the always-bump twin escaped (at ceiling)");
  assert.ok(ramDiff(oracle, ignoreGate, gateSet()), "the gate-ignoring twin escaped (gate set)");
  console.log("  TEETH: no-op, always-bump, gate-ignoring all caught");
});
