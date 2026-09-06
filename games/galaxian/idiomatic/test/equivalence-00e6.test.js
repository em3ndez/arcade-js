// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_00e6 — memory-equivalent to the frozen translated routine.
 * A per-state init tick with two paths, both writing only work/VRAM (no register or device latch is a
 * live-out; the trailing enqueues touch the 0x40xx command queue, which IS in the state dump):
 *   - FULL: the per-state timer decrements to zero -> fill + reset cluster + config folds + bitmask
 *     unpack + object-shadow/status-column seed + two queued command words.
 *   - EARLY: the timer stays nonzero -> fill + cursor advance + one decrement, then bail.
 * EQUAL asserts ramDiff==null on both paths; positive controls confirm the oracle really fills, advances
 * the cursor, resets the state (full) and leaves it alone (early). Teeth: no-op and a single-cell scribble
 * on the full path, and a gate-ignoring twin on the early path. Return-stack window masked by ramDiff.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { fillScreenThenLatchConfigAndAdvanceState as cand } from "../fillScreenThenLatchConfigAndAdvanceState.js";
import { loc_00e6 as oracle } from "../../translated/loc_00e6.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const COUNTDOWN = 0x4008;
const CURSOR = 0x400b;
const FILL_AT = 0x5000; // where we aim the fill cursor so the block lands in a known VRAM span
const GAME_STATE = 0x4005;
const SEQ_STATE = 0x400a;
const C4007 = 0x4007;
const TABLE_OUT = 0x40ac;
const IN2_PORT = 0x7000;
const CONFIG_TABLE = 0x0152;

// FULL path: timer at 1 (dec -> 0), cursor aimed at a clean VRAM span, state seeded foreign so its reset is visible.
const fullPath = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[COUNTDOWN] = 1;
  mm.mem16[CURSOR] = FILL_AT;
  mem[GAME_STATE] = 7;
});
// EARLY path: timer at 5 (dec -> 4, nonzero) so the routine bails after the fill.
const earlyPath = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[COUNTDOWN] = 5;
  mm.mem16[CURSOR] = FILL_AT;
  mem[GAME_STATE] = 7;
});

const noOp = () => {};
const scribble = (m) => { cand(m); m.mem8[GAME_STATE] = (m.mem8[GAME_STATE] + 1) & 0xff; };
const ignoreGate = (m) => { cand(m); m.mem8[GAME_STATE] = 1; }; // forces the full-path reset value

test("EQUAL (crafted): loc_00e6 == oracle on the full (timer-elapsed) path", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, fullPath()), null, "loc_00e6 diverged on the full path");
  const a = fullPath(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[FILL_AT], 16, "positive control: oracle filled the cursor block");
  assert.equal(a.mem16[CURSOR], (FILL_AT + 32) & 0xffff, "positive control: oracle advanced the cursor 32");
  assert.equal(a.mem8[GAME_STATE], 1, "positive control: oracle reset the game state");
  assert.equal(a.mem8[C4007], 1, "positive control: oracle armed 0x4007");
  assert.equal(a.mem8[SEQ_STATE], 0, "positive control: oracle cleared the sequence state");
  const e = fullPath();
  assert.equal(a.mem8[TABLE_OUT], e.mem8[CONFIG_TABLE + (e.mem8[IN2_PORT] & 3)],
    "positive control: oracle stored the port-indexed config byte");
  console.log("  EQUAL: loc_00e6 == oracle on the full path (RAM), state reset + config folded");
});

test("EQUAL (crafted): loc_00e6 == oracle on the early (timer-nonzero) path", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, earlyPath()), null, "loc_00e6 diverged on the early path");
  const b = earlyPath(); b.routines = STUBS; oracle(b);
  assert.equal(b.mem8[COUNTDOWN], 4, "positive control: early path only decremented the timer");
  assert.equal(b.mem8[GAME_STATE], 7, "positive control: early path left the game state untouched");
  assert.equal(b.mem8[FILL_AT], 16, "positive control: early path still filled the cursor block");
  console.log("  EQUAL: loc_00e6 == oracle on the early path (RAM), fill only");
});

test("TEETH: broken twins are caught", { skip }, () => {
  assert.ok(ramDiff(oracle, noOp, fullPath()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, scribble, fullPath()), "the scribble twin escaped");
  assert.ok(ramDiff(oracle, ignoreGate, earlyPath()), "the gate-ignoring twin escaped");
  console.log("  TEETH: no-op, single-cell scribble, and gate-ignoring twins all caught");
});
