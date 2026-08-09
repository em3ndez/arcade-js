// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawRoundNumberCaption — memory-equivalent to the frozen oracle at ROM 0x0EAC.
 * GATE: unit-capture of the one real dispatch, plus a crafted sweep of every round value, plus the
 *   anti-tamper guard driven both ways. The rewrite models no stack while the oracle brackets each
 *   frozen call with a push it pops, so RAM is compared outside a measured dead window under the
 *   entry pointer, the omitted return is checked as a separate SP relationship, and every twin is
 *   required to be caught OUTSIDE that window. Holes stated:
 *     1. DISPATCHED — the shared tape reaches it once; the sweep carries the weight, and says so.
 *     2. EQUAL      — masked RAM identical at the real dispatch.
 *     3. EXHAUSTIVE — all 256 round values, masked RAM identical and SP moved the same 2.
 *     4. SCRATCH    — the whole raw difference lies inside the window; its depth is measured.
 *     5. OMITTED RET— the rewrite leaves SP put, the oracle pops, and the seam reconciles them.
 *     6. NOT DRAWN  — a value of 100 or more draws nothing on either side.
 *     7. GUARD      — a tampered 0x1748 block faults both sides; a genuine one faults neither.
 *     8. TEETH      — broken twins, each caught outside the window on an exact count.
 * HOLE: the guard is dead on a genuine image, so only the tampered arm gives it teeth.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0eac.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { withOmittedRet } from "../../machine.js";
import { drawRoundNumberCaption } from "../drawRoundNumberCaption.js";
import { loc_0eac as oracle } from "../../translated/loc_0eac.js";
import { ROUND_NUMBER } from "../names.js";
import { drawCaptionInPenColour } from "../drawCaptionInPenColour.js";
import { retreatCharCursor } from "../retreatCharCursor.js";
import { advanceCharCursor } from "../advanceCharCursor.js";
import { paintDigitDroppingLeadingZero } from "../paintDigitDroppingLeadingZero.js";

const TARGET = 0x0eac;
const CHECK_BASE = 0x1748;
const WINDOW = 6;
const DRAW_LIMIT = 100;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr)}: oracle=${d.a} candidate=${d.b}` : "identical");

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

const inWindow = (addr, sp) => addr >= sp - WINDOW && addr < sp;

/** Oracle vs candidate on clones of a machine: the RAM difference outside the dead window. */
function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return allDiffs(a, b).find((d) => !inWindow(d.addr, sp)) ?? null;
}

let entry = null;
let dispatches = 0;
function entryState() {
  if (entry === null) {
    const m = makeMachine(new Map([[TARGET, (mm) => {
      dispatches++;
      if (entry === null) entry = mm.clone();
      return oracle(mm);
    }]]));
    m.runFrames(ENTRY_FRAMES);
    assert.notEqual(entry, null, `0x0eac never entered within ${ENTRY_FRAMES} frames`);
  }
  return entry;
}

const craft = (value) => {
  const m = entryState().clone();
  m.mem8[ROUND_NUMBER] = value;
  return m;
};

/** A crafted entry whose 0x1748 block has one byte bumped -- ROM is copied so nothing else sees it. */
function tamper(value, i) {
  const m = craft(value);
  const patched = Uint8Array.from(m.mem.rom);
  patched[CHECK_BASE + i] = (patched[CHECK_BASE + i] + 1) & 0xff;
  m.rom = patched;
  m.mem.rom = patched;
  return m;
}

const faultOf = (fn, m) => {
  try {
    fn(m);
    return null;
  } catch {
    return "fault";
  }
};

function sweepCaught(candidate) {
  let caught = 0;
  for (let v = 0; v < 256; v++) {
    try {
      if (unitDiff(candidate, craft(v))) caught++; // a twin that faults where the oracle does not
    } catch {
      caught++;
    }
  }
  return caught;
}

// ── broken twins ────────────────────────────────────────────────────────────────────────

/** BUG: does nothing, so the whole field goes unpainted. */
function brokenNoOp() {}

/** BUG: the tens digit keeps no allowance, so a leading zero paints instead of vanishing. */
function brokenKeepsLeadingZero(m) {
  const { regs, mem8 } = m;
  const value = mem8[ROUND_NUMBER];
  if (value >= DRAW_LIMIT) return;
  regs.a = 0x0e;
  drawCaptionInPenColour(m);
  retreatCharCursor(m);
  retreatCharCursor(m);
  const colour = mem8[0xad0c];
  paintDigitDroppingLeadingZero(m, Math.floor(value / 10), 0, colour);
  advanceCharCursor(m);
  paintDigitDroppingLeadingZero(m, value % 10, regs.b, colour);
  advanceCharCursor(m);
}

/** BUG: the caption frame is never drawn. */
function brokenSkipsFrame(m) {
  const { regs, mem8 } = m;
  const value = mem8[ROUND_NUMBER];
  if (value >= DRAW_LIMIT) return;
  retreatCharCursor(m);
  retreatCharCursor(m);
  const colour = mem8[0xad0c];
  paintDigitDroppingLeadingZero(m, Math.floor(value / 10), 1, colour);
  advanceCharCursor(m);
  paintDigitDroppingLeadingZero(m, value % 10, regs.b, colour);
  advanceCharCursor(m);
}

/** BUG: the cursor drops only one cell, so both digits land a row off. */
function brokenOneStepDown(m) {
  const { regs, mem8 } = m;
  const value = mem8[ROUND_NUMBER];
  if (value >= DRAW_LIMIT) return;
  regs.a = 0x0e;
  drawCaptionInPenColour(m);
  retreatCharCursor(m);
  const colour = mem8[0xad0c];
  paintDigitDroppingLeadingZero(m, Math.floor(value / 10), 1, colour);
  advanceCharCursor(m);
  paintDigitDroppingLeadingZero(m, value % 10, regs.b, colour);
  advanceCharCursor(m);
}

/** BUG: tens and ones are placed in each other's cells. */
function brokenDigitsSwapped(m) {
  const { regs, mem8 } = m;
  const value = mem8[ROUND_NUMBER];
  if (value >= DRAW_LIMIT) return;
  regs.a = 0x0e;
  drawCaptionInPenColour(m);
  retreatCharCursor(m);
  retreatCharCursor(m);
  const colour = mem8[0xad0c];
  paintDigitDroppingLeadingZero(m, value % 10, 1, colour);
  advanceCharCursor(m);
  paintDigitDroppingLeadingZero(m, Math.floor(value / 10), regs.b, colour);
  advanceCharCursor(m);
}

/** BUG: the round drawn is one too high, so every value paints its successor. */
function brokenOffByOne(m) {
  const { mem8 } = m;
  const value = (mem8[ROUND_NUMBER] + 1) & 0xff;
  const saved = mem8[ROUND_NUMBER];
  mem8[ROUND_NUMBER] = value;
  drawRoundNumberCaption(m);
  mem8[ROUND_NUMBER] = saved;
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["keeps-leading-zero", brokenKeepsLeadingZero],
  ["skips-frame", brokenSkipsFrame],
  ["one-step-down", brokenOneStepDown],
  ["digits-swapped", brokenDigitsSwapped],
  ["off-by-one", brokenOffByOne],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("DISPATCHED: the shared tape reaches the routine", { skip }, () => {
  entryState();
  assert.ok(dispatches > 0, "vacuous: the tape never reached this address");
  console.log(
    `  DISPATCHED: ${dispatches} time(s) in ${ENTRY_FRAMES} frames, round ` +
      `${entryState().mem8[ROUND_NUMBER]}; the crafted sweep carries the weight`,
  );
});

test("EQUAL at the real dispatch: masked RAM identical", { skip }, () => {
  const d = unitDiff(drawRoundNumberCaption, entryState());
  assert.equal(d, null, `RAM diverged outside the dead window — ${show(d)}`);
  console.log("  EQUAL: masked RAM identical at the captured round");
});

test("EXHAUSTIVE: all 256 round values, masked RAM identical and SP moved the same", { skip }, () => {
  const sp = entryState().regs.sp;
  for (let v = 0; v < 256; v++) {
    const m = craft(v);
    const a = m.clone();
    const b = m.clone();
    oracle(a);
    drawRoundNumberCaption(b);
    const stray = allDiffs(a, b).find((d) => !inWindow(d.addr, sp));
    assert.equal(stray ?? null, null, `round ${v}: ${show(stray)}`);
    assert.equal((a.regs.sp - b.regs.sp) & 0xffff, 2, `round ${v}: SP relationship changed`);
  }
  console.log("  EXHAUSTIVE: 256 round values identical outside the window, SP always +2");
});

test("SCRATCH: the whole raw difference lies inside the dead window", { skip }, () => {
  const sp = entryState().regs.sp;
  let deepest = 0;
  let seen = 0;
  for (let v = 0; v < DRAW_LIMIT; v++) {
    const m = craft(v);
    const a = m.clone();
    const b = m.clone();
    oracle(a);
    drawRoundNumberCaption(b);
    for (const d of allDiffs(a, b)) {
      assert.ok(d.addr < sp, `round ${v}: ${hex4(d.addr)} is at or above the entry pointer`);
      deepest = Math.max(deepest, sp - d.addr);
      seen++;
    }
  }
  assert.ok(seen > 0, "no raw difference at all: the mask is measuring nothing");
  assert.ok(deepest <= WINDOW, `the deepest difference is ${deepest} bytes deep, past the window`);
  console.log(`  SCRATCH: ${seen} differing bytes, deepest ${deepest} below SP, window ${WINDOW}`);
});

test("OMITTED RET: the rewrite leaves SP put, the oracle pops, the seam reconciles", { skip }, () => {
  const sp = entryState().regs.sp;
  const bare = entryState().clone();
  drawRoundNumberCaption(bare);
  assert.equal(bare.regs.sp, sp, "the rewrite moved SP; it must omit its own return");
  const ref = entryState().clone();
  oracle(ref);
  assert.equal((ref.regs.sp - sp) & 0xffff, 2, "the oracle did not pop its caller's slot");
  const wired = entryState().clone();
  withOmittedRet(drawRoundNumberCaption)(wired);
  assert.equal(wired.regs.sp, ref.regs.sp, "the seam did not restore the popped slot");
  console.log(`  OMITTED RET: bare SP ${hex4(sp)}, oracle and seam both ${hex4(ref.regs.sp)}`);
});

test("NOT DRAWN: a value of 100 or more paints nothing", { skip }, () => {
  const m = craft(0xff);
  const a = m.clone();
  const b = m.clone();
  oracle(a);
  drawRoundNumberCaption(b);
  assert.deepEqual(allDiffs(a, b), [], "the two sides differ though nothing should be drawn");
  const base = m.clone();
  assert.deepEqual(allDiffs(base, a), [], "the oracle painted despite the round being over 99");
  console.log("  NOT DRAWN: round 255 leaves the plane untouched on both sides");
});

test("GUARD: a tampered 0x1748 block faults both sides, a genuine one faults neither", { skip }, () => {
  for (const i of [0, 8, 15]) {
    assert.equal(faultOf(oracle, tamper(42, i)), "fault", `oracle passed a tampered block at +${i}`);
    assert.equal(faultOf(drawRoundNumberCaption, tamper(42, i)), "fault", `rewrite passed a tampered block at +${i}`);
  }
  assert.equal(faultOf(oracle, craft(42)), null, "the oracle faulted on a genuine image");
  assert.equal(faultOf(drawRoundNumberCaption, craft(42)), null, "the rewrite faulted on a genuine image");
  // ★ the guard is dead on a genuine ROM, so a twin that drops it is invisible until the block moves.
  const dropped = faultOf((m) => {
    const v = m.mem8[ROUND_NUMBER];
    if (v < DRAW_LIMIT) drawRoundNumberCaption(craft(v));
  }, tamper(42, 0));
  assert.equal(dropped, null, "the dropped-guard twin faulted, so this arm is not isolating the guard");
  console.log("  GUARD: three tampered bytes fault both sides; the genuine image faults neither");
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const caught = sweepCaught(twin);
    assert.ok(caught > 0, `the masked comparison PASSED the ${label} twin on every round`);
    console.log(`  TEETH/${label}: caught on ${caught} of 256 crafted rounds`);
  });
}
