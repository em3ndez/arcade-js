// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_194f — memory-equivalent to the frozen oracle at ROM 0x194f.
 * Steps the counter at HL toward a ceiling of 99. Three paths: at the ceiling -> no change; above it ->
 * pin back to 99; below it -> bump, raise the ready flag 0x41c9, and enqueue a command word. All live-outs
 * are work RAM (the counter, 0x41c9, and the command queue) so EQUAL is asserted on ramDiff==null with a
 * non-vacuous positive control per path. Teeth: no-op, bump-by-two, an enqueue-skipping twin (queue), and
 * a clamp-ignoring twin on the overshoot path.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_194f as cand } from "../loc_194f.js";
import { loc_194f as oracle } from "../../translated/loc_194f.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const COUNTER = 0x4100;    // scratch work-RAM counter the pointer steps
const READY_FLAG = 0x41c9;
const QUEUE_HEAD = 0x40a0;
const QUEUE_SLOT = 0x40c0; // 0x4000 + head 0xc0
const CEILING = 99;

// Below the ceiling: the routine bumps, flags, and enqueues. Free the queue slot so the enqueue is visible.
const belowEntry = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.hl = COUNTER;
  mem[COUNTER] = 50; mem[READY_FLAG] = 0xaa; mem[QUEUE_HEAD] = 0xc0; mem[QUEUE_SLOT] = 0x80;
});
// Above the ceiling: clamp back down.
const aboveEntry = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.hl = COUNTER;
  mem[COUNTER] = 200; mem[READY_FLAG] = 0xaa;
});
// Exactly at the ceiling: no change anywhere.
const atEntry = () => craft((mem, mm) => {
  mm.push16(0x9999); mm.regs.hl = COUNTER;
  mem[COUNTER] = CEILING; mem[READY_FLAG] = 0xaa;
});

test("EQUAL (crafted): loc_194f == oracle bumps, flags, and enqueues below the ceiling", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, belowEntry()), null, "loc_194f diverged on the below-ceiling path");
  const a = belowEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[COUNTER], 51, "positive control: oracle bumped the counter");
  assert.equal(a.mem8[READY_FLAG], 1, "positive control: oracle raised the ready flag");
  assert.equal(a.mem8[QUEUE_SLOT], 7, "positive control: oracle enqueued the command word hi byte");
  console.log("  EQUAL: below ceiling -> bump+flag+enqueue, == oracle");
});

test("EQUAL (crafted): loc_194f == oracle clamps an overshoot back to the ceiling", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, aboveEntry()), null, "loc_194f diverged on the overshoot path");
  const a = aboveEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[COUNTER], CEILING, "positive control: oracle pinned the counter to the ceiling");
  assert.equal(a.mem8[READY_FLAG], 0xaa, "positive control: overshoot path leaves the ready flag alone");
  console.log("  EQUAL: overshoot -> clamp to 99, == oracle");
});

test("EQUAL (crafted): loc_194f == oracle leaves a counter at the ceiling untouched", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, atEntry()), null, "loc_194f diverged at the ceiling");
  const a = atEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[COUNTER], CEILING, "positive control: at-ceiling counter unchanged");
  assert.equal(a.mem8[READY_FLAG], 0xaa, "positive control: at-ceiling path touches nothing");
  console.log("  EQUAL: at ceiling -> no change, == oracle");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const bumpTwice = (m) => { m.mem8[COUNTER] = (m.mem8[COUNTER] + 2) & 0xff; m.mem8[READY_FLAG] = 1; };
  const skipEnqueue = (m) => { m.mem8[COUNTER] = (m.mem8[COUNTER] + 1) & 0xff; m.mem8[READY_FLAG] = 1; };
  const ignoreClamp = () => {};
  assert.ok(ramDiff(oracle, noOp, belowEntry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, bumpTwice, belowEntry()), "the bump-by-two twin escaped");
  assert.ok(ramDiff(oracle, skipEnqueue, belowEntry()), "the enqueue-skipping twin escaped (queue)");
  assert.ok(ramDiff(oracle, ignoreClamp, aboveEntry()), "the clamp-ignoring twin escaped");
  console.log("  TEETH: no-op, bump-by-two, enqueue-skip (queue), clamp-ignore all caught");
});
