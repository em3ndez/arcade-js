// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3b5f — memory-equivalent to the frozen oracle at ROM 0x3b5f. GATE: masked strict — real
 * dispatches under the tape plus crafted entries forcing each head arm; the dissolved arms drop the
 * oracle's tail return, so [low, seat) stack scratch is masked and the two-byte SP drift asserted.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-3b5f.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_3b5f } from "../loc_3b5f.js";
import { loc_3b5f as oracle } from "../../translated/loc_3b5f.js";
import { ERA_INDEX } from "../names.js";
import { armBomberSlotWhenTimerFires } from "../armBomberSlotWhenTimerFires.js";
import { advanceHitSoakingObjectThenAnimateDeath } from "../advanceHitSoakingObjectThenAnimateDeath.js";
import { advanceTwoTileObjectThenTryAimedSpawn } from "../advanceTwoTileObjectThenTryAimedSpawn.js";

const TARGET = 0x3b5f;
const RECORD = 0xa8c0;
const ENTRY = 0xaa28;
const HEAD_LIVE = 0xff;
const HEAD_HIT = 0x05;
const HEAD_EMPTY = 0x00;
const ACTIVE_ERA = 1;
const OTHER_ERA = 2;
const DATA_TOP = 0xadff;
const CAP = 120;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr)}: frozen=${d.a} rewrite=${d.b}` : "identical");

let captured = null;
function capture() {
  if (captured) return captured;
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (entries.length < CAP) entries.push(mm.clone());
    return oracle(mm);
  }]]));
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the run ran short");
  captured = entries;
  return captured;
}

/** A captured machine forced to a given era and head, identically before either side runs. */
function craft(era, head) {
  const m = capture()[0].clone();
  m.mem8[ERA_INDEX] = era;
  m.mem8[RECORD] = head;
  return m;
}

/** Masked memory diff: run oracle and candidate on clones, skip the oracle's own stack window. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  oracle(a);
  candidate(b);
  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/** The stack floor the oracle reaches and the SP drift the omitted tail return leaves. */
function spProbe(machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  oracle(a);
  loc_3b5f(b);
  return { low, seat, spDiff: a.regs.sp - b.regs.sp };
}

function footprint(machine) {
  const before = machine.dumpState().slice();
  const after = machine.clone();
  oracle(after);
  const now = after.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) if (now[i] !== before[i]) n++;
  return n;
}

// ── broken twins ──────────────────────────────────────────────────────────────────────────

/** BUG: does nothing, so no arm ever runs. */
function brokenNoOp() {}

/** BUG: swaps the two non-empty arms — a live head soaks hits, a hit-soaking head moves. */
function brokenSwapArms(m) {
  const { regs, mem8 } = m;
  if (mem8[ERA_INDEX] !== 1) return;
  regs.ix = RECORD;
  regs.iy = ENTRY;
  const head = mem8[RECORD];
  if (head === 0) return armBomberSlotWhenTimerFires(m);
  regs.a = (head + 1) & 0xff;
  if (head !== 0xff) return advanceTwoTileObjectThenTryAimedSpawn(m);
  return advanceHitSoakingObjectThenAnimateDeath(m);
}

/** BUG: an empty head runs the move instead of arming the timer. */
function brokenEmptyMoves(m) {
  const { regs, mem8 } = m;
  if (mem8[ERA_INDEX] !== 1) return;
  regs.ix = RECORD;
  regs.iy = ENTRY;
  const head = mem8[RECORD];
  regs.a = (head + 1) & 0xff;
  if (head === 0) return advanceTwoTileObjectThenTryAimedSpawn(m);
  if (head !== 0xff) return advanceHitSoakingObjectThenAnimateDeath(m);
  return advanceTwoTileObjectThenTryAimedSpawn(m);
}

/** BUG: dispatches regardless of era, so it moves the object outside era one. */
function brokenNoEraGate(m) {
  const { regs, mem8 } = m;
  regs.ix = RECORD;
  regs.iy = ENTRY;
  const head = mem8[RECORD];
  if (head === 0) return armBomberSlotWhenTimerFires(m);
  regs.a = (head + 1) & 0xff;
  if (head !== 0xff) return advanceHitSoakingObjectThenAnimateDeath(m);
  return advanceTwoTileObjectThenTryAimedSpawn(m);
}

// ── the gate ──────────────────────────────────────────────────────────────────────────────

test("REAL DISPATCHES: every captured entry under the tape is identical", { skip }, () => {
  const entries = capture();
  assert.ok(entries.length > 0, "vacuous: the tape never dispatched this address");
  for (const e of entries) {
    const d = unitDiff(loc_3b5f, e);
    assert.equal(d, null, `a real dispatch diverged: ${show(d)}`);
  }
  console.log(`  REAL DISPATCHES: ${entries.length} captured, all identical`);
});

test("HEAD ARMS: each crafted head is identical, and the writing arms actually write",
  { skip }, () => {
    for (const [label, head] of [["live", HEAD_LIVE], ["hit", HEAD_HIT], ["empty", HEAD_EMPTY]]) {
      const d = unitDiff(loc_3b5f, craft(ACTIVE_ERA, head));
      assert.equal(d, null, `the ${label} arm diverged: ${show(d)}`);
    }
    const live = footprint(craft(ACTIVE_ERA, HEAD_LIVE));
    const hit = footprint(craft(ACTIVE_ERA, HEAD_HIT));
    assert.ok(live > 0 && hit > 0,
      "the live and hit arms move no memory, so these comparisons would pass a no-op rewrite");
    console.log(`  HEAD ARMS: live/hit/empty identical; live moves ${live} bytes, hit ${hit}`);
  });

test("OTHER ERA: outside era one nothing is dispatched", { skip }, () => {
  const m = craft(OTHER_ERA, HEAD_LIVE);
  assert.equal(unitDiff(loc_3b5f, m), null, "the era gate diverged");
  assert.equal(footprint(m), 0, "the oracle writes memory outside era one, so this arm is wrong");
  console.log("  OTHER ERA: identical, oracle moves 0 bytes");
});

test("SP DRIFT: the omitted tail return is exactly two bytes and the mask sits above data",
  { skip }, () => {
    for (const [label, m] of [
      ["live", craft(ACTIVE_ERA, HEAD_LIVE)],
      ["empty", craft(ACTIVE_ERA, HEAD_EMPTY)],
      ["other-era", craft(OTHER_ERA, HEAD_LIVE)],
    ]) {
      const r = spProbe(m);
      assert.equal(r.spDiff, 2, `the ${label} path no longer omits a two-byte return (${r.spDiff})`);
      // ⚠ an arm that pushes must keep its floor above data, or the mask hides a real write.
      if (r.low < r.seat) assert.ok(r.low > DATA_TOP, `${label} stack window reached into data`);
    }
    console.log("  SP DRIFT: 2 bytes on every path, stack window above data");
  });

test("TEETH: broken twins are caught", { skip }, () => {
  const live = craft(ACTIVE_ERA, HEAD_LIVE);
  const hit = craft(ACTIVE_ERA, HEAD_HIT);
  const empty = craft(ACTIVE_ERA, HEAD_EMPTY);
  assert.ok(unitDiff(brokenNoOp, live), "the no-op twin escaped the live arm");
  assert.ok(unitDiff(brokenSwapArms, hit), "the swapped-arms twin escaped the hit arm");
  assert.ok(unitDiff(brokenSwapArms, live), "the swapped-arms twin escaped the live arm");
  assert.ok(unitDiff(brokenEmptyMoves, empty), "the empty-moves twin escaped the empty arm");
  assert.ok(unitDiff(brokenNoEraGate, craft(OTHER_ERA, HEAD_LIVE)),
    "the no-era-gate twin escaped outside era one");
  // ★ the correct routine must PASS the same entries the twins fail, or catching is vacuous.
  for (const m of [live, hit, empty]) assert.equal(unitDiff(loc_3b5f, m), null, "loc_3b5f itself diverged");
  console.log("  TEETH: no-op, swapped-arms, empty-moves, no-era-gate all caught");
});
