// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_02d1 — memory-equivalent to the frozen oracle at ROM 0x02d1. A sequence-state handler whose whole
 * contract is RAM: append two command words to the queue, advance the sequence step, and store a 16-bit
 * sequence pointer. No register/io live-out — the enqueue's HL restore is an internal artifact. All
 * writes land in the state dump, so EQUAL asserts ramDiff==null. Teeth: no-op, a no-advance mutant that
 * undoes the sequence-step bump, a wrong-pointer mutant, and a scribble (ramDiff teeth).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { postCreditAndMessageDrawsAndAdvance as cand } from "../postCreditAndMessageDrawsAndAdvance.js";
import { loc_02d1 as oracle } from "../../translated/loc_02d1.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const SEQ = 0x400a;
const PTR_LO = 0x4008;
const PTR_HI = 0x4009;
const QHEAD = 0x40a0;
const QSLOT0 = 0x40c0; // slot addressed at head 0xc0
const SCRATCH = 0x4200; // a plain work-RAM cell for the ramDiff-teeth twin

// Queue slots armed free (bit 7 set) so both appends land; sequence step at a known value.
const entry = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[SEQ] = 5;
  mem[QHEAD] = 0xc0;
  for (let i = 0xc0; i <= 0xff; i++) mem[0x4000 + i] = 0xff;
});

test("EQUAL (crafted): loc_02d1 == oracle queues two words, advances the step, aims the pointer", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, entry()), null, "loc_02d1 diverged");
  const a = entry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[SEQ], 6, "positive control: sequence step not advanced 5->6");
  assert.equal(a.mem8[QSLOT0], 0x07, "positive control: first word hi (7) not queued");
  assert.equal(a.mem8[QSLOT0 + 1], 0x01, "positive control: first word lo (1) not queued");
  assert.equal(a.mem8[QSLOT0 + 2], 0x06, "positive control: second word hi (6) not queued");
  assert.equal(a.mem8[QSLOT0 + 3], 0x00, "positive control: second word lo (0) not queued");
  assert.equal(a.mem8[QHEAD], 0xc4, "positive control: write-head not advanced past both appends");
  assert.equal(a.mem8[PTR_LO], 0x60, "positive control: sequence pointer lo not stored");
  assert.equal(a.mem8[PTR_HI], 0x10, "positive control: sequence pointer hi not stored");
  console.log("  EQUAL: loc_02d1 == oracle (RAM), two words queued, step 5->6, pointer aimed");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const noAdvance = (m) => { cand(m); m.mem8[SEQ] = (m.mem8[SEQ] - 1) & 0xff; };
  const wrongPointer = (m) => { cand(m); m.mem8[PTR_LO] = 0x99; };
  const scribble = (m) => { cand(m); m.mem8[SCRATCH] = m.mem8[SCRATCH] ^ 0xff; };
  assert.ok(ramDiff(oracle, noOp, entry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, noAdvance, entry()), "the no-advance twin escaped");
  assert.ok(ramDiff(oracle, wrongPointer, entry()), "the wrong-pointer twin escaped");
  assert.ok(ramDiff(oracle, scribble, entry()), "the scribble twin escaped (ramDiff teeth)");
  console.log("  TEETH: no-op, no-advance, wrong-pointer, scribble all caught");
});
