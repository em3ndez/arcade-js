// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3114 — memory-equivalent to the frozen oracle at ROM 0x3114, a bare `jp 0x307F` tail transfer.
 * The dissolution calls the lifted 0x307F directly, which drops the ROM `ret` chain and the register
 * dance, so RAM is compared outside the measured dead-stack window, the +2 SP drift is asserted, the
 * live-out A and cursors checked, and the scrambled register set excluded with an A-scribble control.
 * A poke drives the dispatch: the guards at 0x311D/0x3129 test a sentinel an untampered image always
 * passes, which NEGATIVE CONTROL asserts, so zeroing one sentinel byte is the only real dispatch.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-3114.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_3114 } from "../loc_3114.js";
import { loc_3114 as oracle } from "../../translated/loc_3114.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { TAMPER_WITNESS } from "../names.js";

const TARGET = 0x3114;
const CORRUPT_FROM_FRAME = 260;
const A_REAL_ROUTINE_NEARBY = 0x308a;

// The bare transfer's destination drops the trailing ret and the register dance, so the frozen side
// re-seats two bytes higher and the scrambled register set below diverges. Both are asserted.
const SP_DRIFT = 2;
const EXCLUDED = ["f", "b", "c", "d", "e", "h", "l", "sp"];
// Every game cell the destination writes lands at or below here; the stack seats far above it, so
// masking the dead window can never hide a data divergence. Asserted against the measured floor.
const DATA_TOP = 0xadff;

const SKIP = romsPresent() ? false : "ROM images are gitignored; nothing to gate";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

// ── entry capture, and the masked comparison ──────────────────────────────────────────────

/** The poked attract entry, captured on first dispatch; null when the routine is never entered. */
function captureEntry(corrupt) {
  let entry = null;
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return oracle(mm);
  }]]), { tape: [] });
  if (corrupt) m.pokes = [{ addr: TAMPER_WITNESS, val: 0x00, frame: CORRUPT_FROM_FRAME, dur: null }];
  m.runFrames(ENTRY_FRAMES);
  return entry;
}

let entryCache = null;
function entryState() {
  if (entryCache === null) entryCache = captureEntry(true);
  return entryCache;
}

/**
 * Oracle vs candidate on clones. RAM is diffed with the dead-stack window [low, seat) masked, low
 * measured by watching the oracle's own pushes; the SP drift, the two cursors and A are returned.
 */
function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => {
    push(v);
    if (a.regs.sp < low) low = a.regs.sp;
  };
  const retOracle = oracle(a);
  let retCand = null;
  let threw = null;
  try {
    retCand = cand(b);
  } catch (e) {
    threw = String(e).slice(0, 50);
  }
  if (threw) return { escaped: { addr: null, a: "survived", b: threw }, regMoved: [], low, seat };
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    escaped = { addr, a: da[i], b: db[i] };
  }
  const regMoved = REG_FIELDS.filter((k) => !EXCLUDED.includes(k) && a.regs[k] !== b.regs[k]);
  return {
    escaped,
    low,
    seat,
    spDiff: (((a.regs.sp - b.regs.sp) & 0xffff) << 16) >> 16,
    regMoved,
    ixMatch: a.regs.ix === b.regs.ix,
    iyMatch: a.regs.iy === b.regs.iy,
    retOracle,
    retCand,
  };
}

/** A defect fails compare() if RAM escaped the mask, a live-out register moved, or SP drifted wrong. */
function caught(r) {
  return !!r.escaped || r.regMoved.length > 0 || !r.ixMatch || !r.iyMatch || r.spDiff !== SP_DRIFT;
}

// ── twins ─────────────────────────────────────────────────────────────────────────────────

/** BUG: does nothing — the destination writes work RAM this twin never touches. */
function brokenNoOp() {}

/** BUG: transfers to a different real routine, whose write-set differs. */
function brokenTransfersElsewhere(m) {
  return m.call(A_REAL_ROUTINE_NEARBY);
}

/** Control: everything right, then scribbles the live-out accumulator the check must see. */
function brokenMovesLiveReg(m) {
  loc_3114(m);
  m.regs.a = (m.regs.a + 1) & 0xff;
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["transfers-elsewhere", brokenTransfersElsewhere],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("NEGATIVE CONTROL: with the sentinel intact the game never dispatches it", { skip: SKIP }, () => {
  assert.equal(captureEntry(false), null,
    "an untampered attract run reached this arm — the poke below then proves nothing");
  console.log("  CONTROL: zero dispatches in an untampered attract run");
});

test("EQUAL at the poked dispatch: RAM identical outside the mask, A and cursors carried, SP +2",
  { skip: SKIP }, () => {
    assert.notEqual(entryState(), null, "vacuous: the poke never drove a dispatch");
    const r = compare(loc_3114, entryState());
    assert.equal(r.escaped, null, `a divergence escaped the mask — ${show(r.escaped)}`);
    assert.deepEqual(r.regMoved, [], `a live register moved: ${r.regMoved}`);
    assert.ok(r.ixMatch && r.iyMatch, "the bare transfer did not carry the cursors");
    assert.equal(r.spDiff, SP_DRIFT, "the dropped tail ret no longer moves the stack pointer");
    assert.equal(r.retOracle, r.retCand, "the return value diverged");
    // The mask floor sits above every game cell either side writes — proven, not assumed.
    assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached into game data`);
    console.log(`  EQUAL: window [${hex4(r.low)},${hex4(r.seat)}) masked, spDiff ${r.spDiff}`);
  });

test("EXCLUDED, deliberately: the check can still see the accumulator", { skip: SKIP }, () => {
  assert.ok(caught(compare(brokenMovesLiveReg, entryState())),
    "the control twin scribbles A and is NOT caught, so the live-out check proves nothing");
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")}; the A-scribble control is caught`);
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip: SKIP }, () => {
    const r = compare(twin, entryState());
    assert.ok(caught(r), `the gate PASSED the ${label} twin — it has no teeth`);
    console.log(`  TEETH/${label}: caught — ${show(r.escaped) || r.regMoved.join(",")}`);
  });
}
