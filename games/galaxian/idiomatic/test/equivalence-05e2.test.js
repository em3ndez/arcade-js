// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_05e2 — memory-equivalent to the frozen oracle at ROM 0x05e2. A sound-cue burst: it appends five
 * command words to the queue, all in the state dump, so ramDiff is the live-out check (the tail enqueue's
 * HL restore is an internal artifact). The seed carries the caller's channel in register D (0x05) and arms
 * the queue slots free so all five appends land. EQUAL asserts ramDiff==null. Teeth: no-op (no appends),
 * a wrong-channel twin (proves the D input is load-bearing), and a scribble (ramDiff teeth).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_05e2 as cand } from "../loc_05e2.js";
import { loc_05e2 as oracle } from "../../translated/loc_05e2.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const CHANNEL = 0x05;   // caller's D
const QHEAD = 0x40a0;
const Q = 0x40c0;       // first slot addressed at head 0xc0
const SCRATCH = 0x4200;

// D = channel, queue slots armed free so all five appends land.
const entry = () => craft((mem, mm) => {
  mm.regs.d = CHANNEL;
  mem[QHEAD] = 0xc0;
  for (let i = 0xc0; i <= 0xff; i++) mem[0x4000 + i] = 0xff;
  mm.push16(0x9999);
});

test("EQUAL (crafted): loc_05e2 == oracle appends the five-cue burst", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, entry()), null, "loc_05e2 diverged on the queue");
  // Non-vacuous: the five words are 05:02, 06:02, 06:04, 07:03, 07:00 and the head advances by ten.
  const a = entry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[Q + 0], 0x05); assert.equal(a.mem8[Q + 1], 0x02);
  assert.equal(a.mem8[Q + 2], 0x06); assert.equal(a.mem8[Q + 3], 0x02);
  assert.equal(a.mem8[Q + 4], 0x06); assert.equal(a.mem8[Q + 5], 0x04);
  assert.equal(a.mem8[Q + 6], 0x07); assert.equal(a.mem8[Q + 7], 0x03);
  assert.equal(a.mem8[Q + 8], 0x07); assert.equal(a.mem8[Q + 9], 0x00);
  assert.equal(a.mem8[QHEAD], 0xca, "positive control: write-head not advanced by five appends");
  console.log("  EQUAL: loc_05e2 == oracle, five-cue burst queued (head 0xc0->0xca)");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongChannel = (m) => cand(m, 0x03); // different D -> different first cues
  const scribble = (m) => { cand(m); m.mem8[SCRATCH] = m.mem8[SCRATCH] ^ 0xff; };
  assert.ok(ramDiff(oracle, noOp, entry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongChannel, entry()), "the wrong-channel twin escaped");
  assert.ok(ramDiff(oracle, scribble, entry()), "the scribble twin escaped (ramDiff teeth)");
  console.log("  TEETH: no-op, wrong-channel, scribble all caught");
});
