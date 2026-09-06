// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_05fc — memory-equivalent to the frozen oracle at ROM 0x05fc. A sound-cue prologue: it appends one
 * command word on the cue channel, then the standard five-word burst for that same channel, for six queued
 * words total. Every effect is the command queue (in the state dump), so ramDiff is the live-out check; the
 * enqueue's HL restore is an internal artifact the tail-dispatch caller never reads. The seed arms the queue
 * slots free so all six appends land. EQUAL asserts ramDiff==null. Teeth: no-op, a prologue-only twin (skips
 * the burst), and a wrong-prologue-param twin. Plus an SP-seam tooth — the fully dissolved body moves no
 * stack and places at the dispatch seam; a stack-adrift mutant is refused.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { loc_05fc as cand } from "../loc_05fc.js";
import { loc_05fc as oracle } from "../../translated/loc_05fc.js";
import { enqueueCommandWord } from "../enqueueCommandWord.js";
import { enqueueCommandWordBurst } from "../enqueueCommandWordBurst.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const QHEAD = 0x40a0;   // write-head index
const QBASE = 0x4000;   // queue slot base
const HEAD = 0xc0;      // an armed, floor-valid head
const Q = QBASE + HEAD; // first slot addressed at head 0xc0
const SCRATCH = 0x4200;

// Arm all slots from the floor upward so every append lands.
const entry = () => craft((mem, mm) => {
  mem[QHEAD] = HEAD;
  for (let i = HEAD; i <= 0xff; i++) mem[QBASE + i] = 0xff;
  mm.push16(0x9999);
});

test("EQUAL (crafted): loc_05fc == oracle queues the prologue word plus the five-cue burst", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, entry()), null, "loc_05fc diverged on the queue");
  // Non-vacuous: six words 05:03, 05:02, 06:02, 06:04, 07:03, 07:00; the head advances by twelve.
  const a = entry(); a.routines = STUBS; oracle(a);
  const want = [0x05, 0x03, 0x05, 0x02, 0x06, 0x02, 0x06, 0x04, 0x07, 0x03, 0x07, 0x00];
  for (let i = 0; i < want.length; i++) assert.equal(a.mem8[Q + i], want[i], `queued byte ${i}`);
  assert.equal(a.mem8[QHEAD], 0xcc, "positive control: write-head not advanced by six appends");
  console.log("  EQUAL: loc_05fc == oracle, prologue + five-cue burst queued (head 0xc0->0xcc)");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const prologueOnly = (m) => enqueueCommandWord(m, (5 << 8) | 3);              // skips the burst
  const wrongParam = (m) => { enqueueCommandWord(m, (5 << 8) | 1); enqueueCommandWordBurst(m, 5); };
  const scribble = (m) => { cand(m); m.mem8[SCRATCH] ^= 0xff; };
  assert.ok(ramDiff(oracle, noOp, entry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, prologueOnly, entry()), "the prologue-only twin escaped");
  assert.ok(ramDiff(oracle, wrongParam, entry()), "the wrong-prologue-param twin escaped");
  assert.ok(ramDiff(oracle, scribble, entry()), "the scribble twin escaped");
  console.log("  TEETH: no-op, prologue-only, wrong-param, scribble all caught");
});

test("SP-SEAM TOOTH: the stack-neutral body places at the dispatch seam", { skip }, () => {
  const r = seamPlaceable(withOmittedRet, cand, 0x05fc, entry());
  assert.equal(r.placeable, true, `seam refused the stack-neutral body: ${r.error}`);
  // Null-mutant: a body left stack-adrift moves SP and the seam MUST refuse it.
  const popping = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, popping, 0x05fc, entry());
  assert.equal(rm.placeable, false, "the stack-adrift mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral body places; stack-adrift mutant refused");
});
