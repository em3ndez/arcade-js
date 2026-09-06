// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_17d0 — memory-equivalent to the frozen oracle at ROM 0x17d0. Per-frame sound tick: returns untouched
 * while the frame gate's bit0 is clear; else reads the counter (0x41c2) and, if counter-1 is nonzero, tail-
 * delegates to the sound-counter manager (advanceSoundSweepAndStagePitch, passing HL=0x41c2); on the pass
 * where counter-1 reaches zero it clears the counter and reloads the sweep cell (0x41c3) and sound counter
 * (0x41c4) with the idle template 0xa002 (little-endian: 0x41c3<-0x02, 0x41c4<-0xa0). Caller loc_16f5 reads
 * no register back, so every live-out is work RAM and ramDiff is the check. Three paths: gate-clear no-op,
 * counter==1 terminal reload, and a below-ceiling delegate pass. Teeth: no-op, gate-ignoring, template-
 * dropping, delegate-dropping. Plus an SP-seam tooth: the stack-neutral body places at the dispatch seam.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { u8 } from "../../../../core/int.js";
import { updateSoundSweepVoice as cand } from "../updateSoundSweepVoice.js";
import { loc_17d0 as oracle } from "../../translated/loc_17d0.js";
import { advanceSoundSweepAndStagePitch } from "../advanceSoundSweepAndStagePitch.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const FRAME_GATE = 0x4006;    // bit0 clear -> skip the frame
const COUNTER = 0x41c2;       // down-counter; counter-1 == 0 takes the terminal path
const SWEEP = 0x41c3;         // counter + 1: the sweep cell (reloaded / bumped by the delegate)
const SOUND_COUNTER = 0x41c4; // reloaded on the terminal path, ticked down by the delegate
const GATE1 = 0x4226;         // delegate's first gate: bit0 clear -> proceed
const GATE2 = 0x425f;         // delegate's second gate: bit0 clear -> bump path

const gateClear = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[FRAME_GATE] = 0; mem[COUNTER] = 1; mem[SWEEP] = 0x33; mem[SOUND_COUNTER] = 0x44;
});
const counterOne = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[FRAME_GATE] = 1; mem[COUNTER] = 1; mem[SWEEP] = 0x33; mem[SOUND_COUNTER] = 0x44;
});
const belowCeiling = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[FRAME_GATE] = 1; mem[COUNTER] = 5; mem[SWEEP] = 0x33;
  mem[SOUND_COUNTER] = 0x10; mem[GATE1] = 0; mem[GATE2] = 0;
});

test("EQUAL (crafted): loc_17d0 == oracle across the three paths (RAM)", { skip }, () => {
  for (const [name, e] of [["gateClear", gateClear()], ["counterOne", counterOne()],
                           ["belowCeiling", belowCeiling()]]) {
    assert.equal(ramDiff(oracle, cand, e), null, `loc_17d0 diverged on the ${name} path`);
  }
  const g = gateClear(); g.routines = STUBS; oracle(g);
  assert.equal(g.mem8[COUNTER], 1, "positive control: gate-clear left the counter untouched");
  const one = counterOne(); one.routines = STUBS; oracle(one);
  assert.equal(one.mem8[COUNTER], 0, "positive control: counter==1 zeroed the counter");
  assert.equal(one.mem8[SWEEP], 0x02, "positive control: counter==1 reloaded the sweep cell low byte");
  assert.equal(one.mem8[SOUND_COUNTER], 0xa0, "positive control: counter==1 reloaded the counter high byte");
  const b = belowCeiling(); b.routines = STUBS; oracle(b);
  assert.equal(b.mem8[SWEEP], 0x34, "positive control: below-ceiling delegate bumped the sweep cell");
  assert.equal(b.mem8[SOUND_COUNTER], 0x0f, "positive control: below-ceiling delegate ticked the counter");
  console.log("  EQUAL: loc_17d0 == oracle (RAM): gate-clear + counter==1 reload + below-ceiling delegate");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const ignoreGate = (m) => {
    const next = u8(m.mem8[COUNTER] - 1);
    if (next !== 0) return advanceSoundSweepAndStagePitch(m, COUNTER);
    m.mem8[COUNTER] = 0; m.mem8[SWEEP] = 2; m.mem8[SOUND_COUNTER] = 160;
  };
  const dropTemplate = (m) => {
    if ((m.mem8[FRAME_GATE] & 1) === 0) return;
    const next = u8(m.mem8[COUNTER] - 1);
    if (next !== 0) return advanceSoundSweepAndStagePitch(m, COUNTER);
    m.mem8[COUNTER] = 0; // forgets the sweep/counter reload
  };
  const dropDelegate = (m) => {
    if ((m.mem8[FRAME_GATE] & 1) === 0) return;
    const next = u8(m.mem8[COUNTER] - 1);
    if (next !== 0) return; // drops the delegate
    m.mem8[COUNTER] = 0; m.mem8[SWEEP] = 2; m.mem8[SOUND_COUNTER] = 160;
  };
  assert.ok(ramDiff(oracle, noOp, counterOne()), "the no-op twin escaped (counter==1)");
  assert.ok(ramDiff(oracle, ignoreGate, gateClear()), "the gate-ignoring twin escaped (gate clear)");
  assert.ok(ramDiff(oracle, dropTemplate, counterOne()), "the template-dropping twin escaped (counter==1)");
  assert.ok(ramDiff(oracle, dropDelegate, belowCeiling()), "the delegate-dropping twin escaped (below ceiling)");
  console.log("  TEETH: no-op, gate-ignoring, template-dropping, delegate-dropping all caught");
});

test("SP-SEAM TOOTH: the stack-neutral body places at the dispatch seam", { skip }, () => {
  for (const [name, e] of [["counterOne", counterOne], ["belowCeiling", belowCeiling]]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x17d0, e());
    assert.equal(r.placeable, true, `${name}: seam refused the stack-neutral body: ${r.error}`);
  }
  const popping = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, popping, 0x17d0, counterOne());
  assert.equal(rm.placeable, false, "the stack-adrift mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral body places on counter==1 + below-ceiling; stack-adrift mutant refused");
});
