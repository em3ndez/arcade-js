// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0795 — crafted-entry equivalence vs the frozen sub-state handler at ROM 0x0795, with its bitmask
 * expander and its five command-queue enqueues dissolved to the decompiled primitives. It expands the
 * saved bitmask (0x41a0) into the flag block (0x4100-0x417f), copies the trailing 8-byte template into
 * 0x4218, clears 0x425f/0x4220, advances SEQUENCE_STATE (0x400a), arms the state timer (0x4009=0x96),
 * and publishes the sub-state pointer at 0x4245. Two conditionals:
 *   - FLIP: 0x400f nonzero -> stamp 0x4018 and the display-flip latches (0x7006/0x7007 -> io.flipX/Y,
 *     board latches NOT in the state dump).
 *   - SOUND: 0x4006 bit0 set -> enqueue five command words into the 0x40xx queue.
 * FULL path exercises both; QUIET path takes neither. EQUAL asserts ramDiff==null on both AND the flip
 * latches on the full path. Teeth: no-op, wrong-timer, queue-scribble (RAM) + a flip-io twin on the full
 * path, and a flip-anyway twin on the quiet path. The return-stack window is masked by ramDiff.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_0795 as cand } from "../loc_0795.js";
import { loc_0795 as oracle } from "../../translated/loc_0795.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const MASK = 0x41a0;       // saved bitmask (16 bytes), then an 8-byte template at 0x41b0
const TEMPLATE_SRC = 0x41b0;
const FLAG_BASE = 0x4100;
const TEMPLATE_DST = 0x4218;
const STATUS_A = 0x425f;
const STATUS_B = 0x4220;
const SEQ_STATE = 0x400a;
const TIMER = 0x4009;
const PTR_LO = 0x4245;
const PTR_HI = 0x4246;
const FLIP_FLAG = 0x400f;
const FLIP_SHADOW = 0x4018;
const FLIP_X = 0x7006;
const FLIP_Y = 0x7007;
const SOUND_GATE = 0x4006;
const QUEUE_HEAD = 0x40a0;
const SLOT0 = 0x40c0;
const SLOT9 = 0x40c9;
const TIMER_RELOAD = 0x96;

// Shared setup: dirtied destinations, a known bitmask + template, cleared pointer, state seeded low.
function base(mem, m) {
  m.push16(0x9999);
  for (let i = 0; i < 16; i++) mem[MASK + i] = 0x01;            // bit0 only -> flag pattern 1,0,0,0,0,0,0,0
  for (let i = 0; i < 8; i++) mem[TEMPLATE_SRC + i] = 0x11 + i; // known template payload
  for (let i = 0; i < 128; i++) mem[FLAG_BASE + i] = 0xee;      // dirty so the expand is demonstrable
  for (let i = 0; i < 8; i++) mem[TEMPLATE_DST + i] = 0xdd;     // dirty so the copy is demonstrable
  mem[STATUS_A] = 0x33;
  mem[STATUS_B] = 0x44;
  mem[SEQ_STATE] = 5;
  mem[TIMER] = 0x00;
  mem[PTR_LO] = 0x00;
  mem[PTR_HI] = 0x00;
  mem[FLIP_SHADOW] = 0x00;
}

// Full path: flip flag set + sound gate open + queue slots armed free.
const full = () => craft((mem, m) => {
  base(mem, m);
  mem[FLIP_FLAG] = 0x01;
  mem[FLIP_X] = 0; mem[FLIP_Y] = 0; // force the flip latches off so setting them is observable
  mem[SOUND_GATE] = 0x01;
  mem[QUEUE_HEAD] = 0xc0;
  for (let i = 0; i < 16; i++) mem[SLOT0 + i] = 0x80; // all free -> all five enqueue
});

// Quiet path: flip flag clear + sound gate closed -> neither conditional runs.
const quiet = () => craft((mem, m) => {
  base(mem, m);
  mem[FLIP_FLAG] = 0x00;
  mem[SOUND_GATE] = 0x00;
});

// The flip latches are board devices (not in dumpState); read them off the io device.
function flipAfter(fn, e) {
  const m = e.clone(); m.routines = STUBS; fn(m);
  return [m.mem.io.flipX, m.mem.io.flipY];
}

test("EQUAL (crafted): loc_0795 == oracle full path (expand/copy/clear/flip/state/timer/publish/enqueue)", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, full()), null, "loc_0795 diverged on the full path (RAM)");
  assert.deepEqual(flipAfter(cand, full()), flipAfter(oracle, full()), "flip latches disagree");
  const a = full(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[FLAG_BASE], 1, "control: flag block bit0 expanded to 1");
  assert.equal(a.mem8[FLAG_BASE + 1], 0, "control: flag block bit1 expanded to 0");
  assert.equal(a.mem8[TEMPLATE_DST], 0x11, "control: template copied (first)");
  assert.equal(a.mem8[TEMPLATE_DST + 7], 0x18, "control: template copied (last)");
  assert.equal(a.mem8[STATUS_A], 0, "control: status A cleared");
  assert.equal(a.mem8[STATUS_B], 0, "control: status B cleared");
  assert.equal(a.mem8[FLIP_SHADOW], 1, "control: flip shadow stamped");
  assert.equal(a.mem8[SEQ_STATE], 6, "control: sub-state advanced");
  assert.equal(a.mem8[TIMER], TIMER_RELOAD, "control: state timer armed");
  assert.equal(a.mem8[PTR_LO], 0x30, "control: sub-state pointer lo published");
  assert.equal(a.mem8[PTR_HI], 0x08, "control: sub-state pointer hi published");
  assert.equal(a.mem8[SLOT0], 0x05, "control: first command word enqueued (hi)");
  assert.equal(a.mem8[SLOT9], 0x00, "control: fifth command word enqueued (lo)");
  assert.equal(a.mem8[QUEUE_HEAD], 0xca, "control: write-head advanced by five words");
  assert.deepEqual(flipAfter(oracle, full()), [1, 1], "control: flip latches set");
  console.log("  EQUAL: loc_0795 == oracle full path (RAM + io.flipX/Y)");
});

test("EQUAL (crafted): loc_0795 == oracle quiet path (no flip, no sound)", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, quiet()), null, "loc_0795 diverged on the quiet path (RAM)");
  assert.deepEqual(flipAfter(cand, quiet()), flipAfter(oracle, quiet()), "flip latches disagree (quiet)");
  const a = quiet(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[STATUS_A], 0, "control: status A cleared");
  assert.equal(a.mem8[SEQ_STATE], 6, "control: sub-state advanced");
  assert.equal(a.mem8[TIMER], TIMER_RELOAD, "control: state timer armed");
  assert.equal(a.mem8[PTR_LO], 0x30, "control: sub-state pointer published even when quiet");
  assert.equal(a.mem8[FLIP_SHADOW], 0, "control: flip shadow untouched");
  assert.deepEqual(flipAfter(oracle, quiet()), [0, 0], "control: flip latches left off");
  console.log("  EQUAL: loc_0795 == oracle quiet path (RAM), flip + sound skipped");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongTimer = (m) => { cand(m); m.mem8[TIMER] = 0x95; };                 // timer off by one
  const scribbleQueue = (m) => { cand(m); m.mem8[SLOT0] = m.mem8[SLOT0] ^ 0xff; }; // queue in the diff
  const noFlipIo = (m) => { cand(m); m.mem.io.setFlipX(0); m.mem.io.setFlipY(0); }; // RAM ok, latches wrong
  const flipAnyway = (m) => { cand(m); m.mem8[FLIP_SHADOW] = 0x01; };            // quiet path must skip flip

  assert.ok(ramDiff(oracle, noOp, full()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongTimer, full()), "the wrong-timer twin escaped");
  assert.ok(ramDiff(oracle, scribbleQueue, full()), "the queue-scribble twin escaped");
  assert.notDeepEqual(flipAfter(noFlipIo, full()), flipAfter(oracle, full()), "the flip-io twin escaped");
  assert.ok(ramDiff(oracle, flipAnyway, quiet()), "the flip-anyway twin escaped (quiet)");
  console.log("  TEETH: no-op, wrong-timer, queue-scribble (RAM), flip-io (latches), flip-anyway (quiet RAM) all caught");
});
