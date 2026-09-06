// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_04f2 — crafted-entry equivalence vs the frozen oracle at ROM 0x04f2. Credit-gated round start with
 * two paths, both memory-only live-outs:
 *   NO CREDITS (0x4002 == 0): force GAME_STATE (0x4005)=1 and ret. Nothing else touched.
 *   SPEND (0x4002 != 0): decrement the credit count, zero-fill the 32-byte saved-state snapshot
 *     (0x41a0-0x41bf) via the dissolved fill, then tail into the round-start setup with a null spawn
 *     pointer (dissolved jp) — which stores the pointer, blits the template, and seeds the play cells.
 * Every effect is work RAM, so EQUAL asserts ramDiff==null. The seed arms a free queue slot so the
 * round-start enqueues are observable and dirties the snapshot so the fill is observable. Teeth prove
 * the credit write, the fill, and the round-start delegate are each load-bearing.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { fillMemoryBlock } from "../fillMemoryBlock.js";
import { startOnePlayerGame as cand } from "../startOnePlayerGame.js";
import { loc_04f2 as oracle } from "../../translated/loc_04f2.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const CREDITS = 0x4002;     // credit / start count
const GAME_STATE = 0x4005;
const SNAP = 0x41a0;        // saved-state snapshot base (filled with 0)
const SNAP_END = 0x41bf;    // last byte of the 32-byte fill
const PTR_LO = 0x400d;      // spawn pointer low (round-start stores it from the null pointer)
const PTR_HI = 0x400e;
const QUEUE_HEAD = 0x40a0;
const QUEUE_BASE = 0x4000;
const HEAD = 0xc0;
const SENTINEL = 0x55;

// No credits -> the z-arm forces GAME_STATE=1.
const zeroEntry = () => craft((mem, m) => {
  m.push16(0x9999);
  mem[CREDITS] = 0;
  mem[GAME_STATE] = SENTINEL;
});

// Credits available -> spend one, fill the snapshot, tail into round start.
const spendEntry = () => craft((mem, m) => {
  m.push16(0x9999);
  mem[CREDITS] = 5;
  mem[GAME_STATE] = SENTINEL;
  mem[SNAP] = 0xff;      // dirty so the zero-fill is observable
  mem[SNAP_END] = 0xff;
  mem[QUEUE_HEAD] = HEAD;
  mem[QUEUE_BASE + HEAD] = 0x80; // free slot so the round-start enqueue writes
});

test("EQUAL (crafted): loc_04f2 == oracle with no credits (state forced to 1)", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, zeroEntry()), null, "loc_04f2 diverged on the no-credit path");
  const a = zeroEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[GAME_STATE], 1, "positive control: oracle forced GAME_STATE=1");
  assert.equal(a.mem8[CREDITS], 0, "positive control: oracle left the credit count untouched");
  console.log("  EQUAL: loc_04f2 == oracle (no credits) — GAME_STATE forced to 1");
});

test("EQUAL (crafted): loc_04f2 == oracle spending a credit into a round start", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, spendEntry()), null, "loc_04f2 diverged on the spend path");
  const a = spendEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[CREDITS], 4, "positive control: oracle spent one credit (5->4)");
  assert.equal(a.mem8[SNAP], 0, "positive control: oracle zeroed the snapshot head");
  assert.equal(a.mem8[SNAP_END], 0, "positive control: oracle zeroed the snapshot tail");
  assert.equal(a.mem8[PTR_LO], 0, "positive control: round start stored the null pointer low byte");
  assert.equal(a.mem8[PTR_HI], 0, "positive control: round start stored the null pointer high byte");
  assert.equal(a.mem8[GAME_STATE], 3, "positive control: round start set GAME_STATE=3");
  console.log("  EQUAL: loc_04f2 == oracle (spend) — credit spent, snapshot cleared, round start entered");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongCredit = (m) => { cand(m); m.mem8[CREDITS] = (m.mem8[CREDITS] + 1) & 0xff; };
  const scribbleSnapshot = (m) => { cand(m); m.mem8[SNAP] = 0xff; };          // re-dirty -> fill undone
  const skipRoundStart = (m) => { m.mem8[CREDITS] = m.mem8[CREDITS] - 1; fillMemoryBlock(m, SNAP, 0, 32); };
  const wrongState = (m) => { cand(m); m.mem8[GAME_STATE] = 2; };

  assert.ok(ramDiff(oracle, noOp, spendEntry()), "the no-op twin escaped (spend)");
  assert.ok(ramDiff(oracle, wrongCredit, spendEntry()), "the wrong-credit twin escaped");
  assert.ok(ramDiff(oracle, scribbleSnapshot, spendEntry()), "the snapshot-scribble twin escaped (fill not load-bearing?)");
  assert.ok(ramDiff(oracle, skipRoundStart, spendEntry()), "the skip-round-start twin escaped (delegate not load-bearing?)");
  assert.ok(ramDiff(oracle, noOp, zeroEntry()), "the no-op twin escaped (no-credit)");
  assert.ok(ramDiff(oracle, wrongState, zeroEntry()), "the wrong-state twin escaped");
  console.log("  TEETH: no-op, wrong-credit, snapshot-scribble, skip-round-start, wrong-state all caught");
});
