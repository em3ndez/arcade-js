// SPDX-License-Identifier: GPL-3.0-only
/**
 * sweepEra2PlusObjectBank — memory-equivalent to the frozen oracle at ROM 0x40d6.
 * GATE: full-RAM diff + return value, with the dead stack scratch below the seat masked: the
 * oracle's sweep body pushes return words there that the rewrite's direct calls never write. The
 * window is measured per entry off the oracle's own pushes and asserted to stay above game data.
 * Every real dispatch is era 0, so the tape exercises only the era guard; crafted era>=2 entries
 * over an occupied bank exercise the sweep body. SP is excluded and asserted separately: every path
 * omits the oracle's one ret (a uniform 2-byte drift) -- the sweep body's turns are direct calls, so
 * the routine is one plain function on all three paths, which is what lets its caller call it
 * without a return seat.
 * HOLE: the crafted entries force the era, the count and the bank heads, so the body runs against a
 * state the cabinet reaches only after deeper play, not a captured one.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-40d6.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { sweepEra2PlusObjectBank } from "../sweepEra2PlusObjectBank.js";
import { loc_40d6 as oracle } from "../../translated/loc_40d6.js";

const TARGET = 0x40d6;
const ERA_INDEX = 0xad04;
const FIRST_SWEPT_ERA = 2;
const SLOT_COUNT = 0xa8c6;
const RECORD_CURSOR_SEAT = 0xa8c0;
const ENTRY_CURSOR_SEAT = 0xaa28;
const SWEEP_BODY = 0x40ea;
const RECORD_STRIDE = 0x10;
const ENTRY_STRIDE = 2;
const OCCUPIED = 0xff;
const SWEPT_COUNT = 3;
const OCCUPIED_RECORDS = 5;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

let captured = null;
function captureDispatches() {
  if (captured) return captured;
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    entries.push(mm.clone());
    return oracle(mm);
  }]]));
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the run ran short");
  captured = entries;
  return captured;
}

// Measured: the stack reach floor sits in the 0xAFxx page and game data tops out far below; a window
// bounded above this can never hide a real write. Asserted against the live floor per entry.
const DATA_TOP = 0xadff;

/** How far below its seat the oracle's own pushes reach, on one entry state. */
function oracleDepth(machine) {
  const c = machine.clone();
  const seat = c.regs.sp;
  let deepest = seat;
  const push = c.push16.bind(c);
  c.push16 = (v) => {
    const r = push(v);
    if (c.regs.sp < deepest) deepest = c.regs.sp;
    return r;
  };
  oracle(c);
  return seat - deepest;
}

// Whole RAM dump plus the return value, the oracle's dead stack scratch below the seat masked.
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = machine.regs.sp;
  const floor = seat - oracleDepth(machine);
  assert.ok(floor > DATA_TOP, `the stack window ${hex4(floor)} reached into game data`);
  let ra, rb;
  try { ra = oracle(a); } catch (e) { return { addr: null, a: `oracle threw ${e}`, b: "" }; }
  try { rb = candidate(b); } catch (e) { return { addr: null, a: "returned", b: String(e).slice(0, 40) }; }
  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= floor && addr < seat) continue;
    return { addr, a: da[i], b: db[i] };
  }
  if (ra !== rb) return { addr: null, a: `ret ${ra}`, b: `ret ${rb}` };
  return null;
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

// A captured machine nudged into the sweep: era raised, a turn count set, and MORE records than the
// count marked occupied so the body walks, writes, and an off-by-one cursor or count shows.
function craftSweep(base, era) {
  const c = base.clone();
  c.mem8[ERA_INDEX] = era;
  c.mem8[SLOT_COUNT] = SWEPT_COUNT;
  for (let i = 0; i < OCCUPIED_RECORDS; i++) c.mem8[RECORD_CURSOR_SEAT + i * RECORD_STRIDE] = OCCUPIED;
  return c;
}

// The one entry that reveals the count guard: era high enough, but nothing to sweep.
function craftEmptyCount(base, era) {
  const c = base.clone();
  c.mem8[ERA_INDEX] = era;
  c.mem8[SLOT_COUNT] = 0;
  return c;
}

function brokenNoSweep() {}

function brokenMissingEraGuard(m) {
  const { regs, mem8 } = m;
  regs.ix = RECORD_CURSOR_SEAT;
  regs.iy = ENTRY_CURSOR_SEAT;
  const count = mem8[SLOT_COUNT];
  if (count === 0) return;
  regs.b = count;
  return m.call(SWEEP_BODY);
}

function brokenMissingCountGuard(m) {
  const { regs, mem8 } = m;
  if (mem8[ERA_INDEX] < FIRST_SWEPT_ERA) return;
  regs.ix = RECORD_CURSOR_SEAT;
  regs.iy = ENTRY_CURSOR_SEAT;
  regs.b = mem8[SLOT_COUNT];
  return m.call(SWEEP_BODY);
}

function brokenWrongRecordCursor(m) {
  const { regs, mem8 } = m;
  if (mem8[ERA_INDEX] < FIRST_SWEPT_ERA) return;
  regs.ix = RECORD_CURSOR_SEAT + RECORD_STRIDE;
  regs.iy = ENTRY_CURSOR_SEAT;
  const count = mem8[SLOT_COUNT];
  if (count === 0) return;
  regs.b = count;
  return m.call(SWEEP_BODY);
}

function brokenWrongEntryCursor(m) {
  const { regs, mem8 } = m;
  if (mem8[ERA_INDEX] < FIRST_SWEPT_ERA) return;
  regs.ix = RECORD_CURSOR_SEAT;
  regs.iy = ENTRY_CURSOR_SEAT + ENTRY_STRIDE;
  const count = mem8[SLOT_COUNT];
  if (count === 0) return;
  regs.b = count;
  return m.call(SWEEP_BODY);
}

function brokenWrongCount(m) {
  const { regs, mem8 } = m;
  if (mem8[ERA_INDEX] < FIRST_SWEPT_ERA) return;
  regs.ix = RECORD_CURSOR_SEAT;
  regs.iy = ENTRY_CURSOR_SEAT;
  const count = mem8[SLOT_COUNT];
  if (count === 0) return;
  regs.b = count + 1;
  return m.call(SWEEP_BODY);
}

const TWINS = [
  ["no-sweep", brokenNoSweep],
  ["missing-era-guard", brokenMissingEraGuard],
  ["missing-count-guard", brokenMissingCountGuard],
  ["wrong-record-cursor", brokenWrongRecordCursor],
  ["wrong-entry-cursor", brokenWrongEntryCursor],
  ["wrong-count", brokenWrongCount],
];

test("REAL DISPATCHES: every captured dispatch is identical, and the comparison is not blind",
  { skip }, () => {
    const entries = captureDispatches();
    assert.ok(entries.length > 0, "vacuous: nothing dispatched this address");
    for (const e of entries) {
      const d = unitDiff(sweepEra2PlusObjectBank, e);
      assert.equal(d, null, `a captured dispatch diverged: ${d && (d.addr == null ? d.a : hex4(d.addr))}`);
    }
    // Every capture is era<2 and writes nothing, so a rewrite that just returns passes trivially;
    // prove the arm can tell things apart by catching a twin that drops the era guard.
    const caught = entries.filter((e) => unitDiff(brokenMissingEraGuard, e)).length;
    assert.ok(caught > 0, "the real-capture comparison catches nothing here, so it is blind");
    const eras = [...new Set(entries.map((e) => e.mem8[ERA_INDEX]))];
    assert.ok(eras.every((x) => x < FIRST_SWEPT_ERA), `a capture is era>=2 now: ${eras}`);
    console.log(`  REAL: ${entries.length} identical; missing-era-guard caught on ${caught}; eras ${eras}`);
  });

test("CRAFTED SWEEP: era>=2 over an occupied bank runs the body identically", { skip }, () => {
  const base = captureDispatches()[0];
  for (const era of [2, 3, 4]) {
    const c = craftSweep(base, era);
    assert.equal(unitDiff(sweepEra2PlusObjectBank, c), null, `era ${era} diverged`);
    assert.ok(footprint(c) > 0, `era ${era} wrote nothing, so this arm is vacuous`);
  }
  console.log(`  CRAFTED: era 2/3/4 identical, footprint ${footprint(craftSweep(base, 3))} bytes`);
});

test("SP: every path omits the oracle's one ret, the full sweep included", { skip }, () => {
  const base = captureDispatches()[0];
  const eo = base.clone();
  const ec = base.clone();
  const seat = eo.regs.sp;
  oracle(eo);
  sweepEra2PlusObjectBank(ec);
  assert.equal(eo.regs.sp - ec.regs.sp, 2, "the early return no longer drops the oracle's ret");
  const fo = craftSweep(base, 3);
  const fc = fo.clone();
  oracle(fo);
  sweepEra2PlusObjectBank(fc);
  assert.equal(fo.regs.sp - fc.regs.sp, 2, "the full path pops a return slot again, so a caller " +
    "that calls this as a plain function loses its own return address (the 0x1199 seam fault)");
  console.log(`  SP: early drift ${eo.regs.sp - ec.regs.sp}, full drift ${fo.regs.sp - fc.regs.sp}, seat ${hex4(seat)}`);
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const base = captureDispatches()[0];
    const onReal = captureDispatches().filter((e) => unitDiff(twin, e)).length;
    const onSweep = unitDiff(twin, craftSweep(base, 3)) ? 1 : 0;
    const onEmpty = unitDiff(twin, craftEmptyCount(base, 3)) ? 1 : 0;
    assert.ok(onReal + onSweep + onEmpty > 0, `every entry PASSED the ${label} twin`);
    console.log(`  TEETH/${label}: real ${onReal}, sweep ${onSweep}, era>=2-count0 ${onEmpty}`);
  });
}
