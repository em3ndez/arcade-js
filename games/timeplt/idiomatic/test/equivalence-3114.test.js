// SPDX-License-Identifier: GPL-3.0-only
/**
 * trampolineToLoc_307f — memory-equivalent to the frozen oracle at ROM 0x3114, a bare `jp 0x307F` tail transfer.
 * The dissolution calls the lifted 0x307F directly, which drops the ROM `ret` chain and the register
 * dance, so RAM is compared outside the measured dead-stack window, the +2 SP drift is asserted, the
 * live-out cursors checked, and the measured scrambled register set excluded, with a control twin that
 * clobbers a register outside it (a shadow half) and must be caught. A is in that set: the placer at the
 * end of the chain now builds the displaced coordinate in a local and only stores it, where the frozen
 * placer leaves it in A. DEAD AT EXIT complements A as the FROZEN bare transfer hands back, over a
 * whole attract session and a whole coin-start session each carrying the poke below, and not one frame
 * of state changes, beside an SP exit control and an E entry control (the coordinate the destination
 * stores through the pointer) that are both heard.
 * HOLE: those sessions present only a few dispatches (pinned), all arriving with the spent count.
 * A poke drives the dispatch: the guards at 0x311D/0x3129 test a sentinel an untampered image always
 * passes, which NEGATIVE CONTROL asserts, so zeroing one sentinel byte is the only real dispatch.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-3114.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { trampolineToLoc_307f } from "../trampolineToLoc_307f.js";
import { loc_3114 as oracle } from "../../translated/loc_3114.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { TAMPER_WITNESS } from "../names.js";
import { assertDeadAtExit, heard } from "./_deadAtExit.js";

const TARGET = 0x3114;
const CORRUPT_FROM_FRAME = 260;
const A_REAL_ROUTINE_NEARBY = 0x308a;

// The bare transfer's destination drops the trailing ret and the register dance, so the frozen side
// re-seats two bytes higher and the scrambled register set below diverges. Both are asserted.
const SP_DRIFT = 2;
const EXCLUDED = ["a", "f", "b", "e", "sp"];

/** Whole sessions for DEAD AT EXIT; measured dispatches of this address under the poke (a move is a finding). */
const DEAD_SESSIONS = [["undriven attract", [], 1], ["coin -> start", undefined, 2]];
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
 * measured by watching the oracle's own pushes; the SP drift and the two cursors are returned.
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
    cursorsOracle: [a.regs.ix, a.regs.iy],
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

/** Control: everything right, then clobbers a register outside the ceiling (a shadow half the chain
 * never touches), which the register check must see. */
function clobbersARegisterOutsideTheCeiling(m) {
  trampolineToLoc_307f(m);
  m.regs.h_ = (m.regs.h_ + 1) & 0xff;
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

test("EQUAL at the poked dispatch: RAM identical outside the mask, cursors carried, SP +2",
  { skip: SKIP }, () => {
    assert.notEqual(entryState(), null, "vacuous: the poke never drove a dispatch");
    const r = compare(trampolineToLoc_307f, entryState());
    assert.equal(r.escaped, null, `a divergence escaped the mask — ${show(r.escaped)}`);
    assert.deepEqual(r.regMoved, [], `a live register moved: ${r.regMoved}`);
    assert.ok(r.ixMatch && r.iyMatch, "the bare transfer did not carry the cursors");
    assert.equal(r.spDiff, SP_DRIFT, "the dropped tail ret no longer moves the stack pointer");
    // The oracle hands its cursors back in IX/IY (its JS return is undefined); the rewrite returns them.
    assert.equal(r.retOracle, undefined, "the frozen routine returned a JS value");
    assert.deepEqual(r.retCand, r.cursorsOracle, "the rewrite does not return the oracle's IX/IY cursors");
    // The mask floor sits above every game cell either side writes — proven, not assumed.
    assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached into game data`);
    console.log(`  EQUAL: window [${hex4(r.low)},${hex4(r.seat)}) masked, spDiff ${r.spDiff}`);
  });

test("EXCLUDED, deliberately: only the measured set moves, and the check sees one outside it", { skip: SKIP }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  trampolineToLoc_307f(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(moved.filter((k) => !EXCLUDED.includes(k)), [], `a register outside the set moved: ${moved}`);
  const control = compare(clobbersARegisterOutsideTheCeiling, entryState());
  assert.ok(caught(control), "the control twin clobbers h_ and is NOT caught, so the register check proves nothing");
  assert.deepEqual(control.regMoved, ["h_"], "the control is caught for some reason other than the clobbered register");
  console.log(`  EXCLUDED: ${EXCLUDED.join(", ")} (measured moving: ${moved.join(", ")}); the h_ control is caught`);
});

test("DEAD AT EXIT: A, as the frozen transfer leaves it, is read by nothing after it", { skip: SKIP }, () => {
  const pokes = [{ addr: TAMPER_WITNESS, val: 0x00, frame: CORRUPT_FROM_FRAME, dur: null }];
  const exits = assertDeadAtExit({
    at: TARGET, poison: ["a"], frames: ENTRY_FRAMES,
    sessions: DEAD_SESSIONS.map(([label, tape, dispatches]) => ({ label, tape, pokes, dispatches })),
    // ENTRY CONTROL: E is the coordinate the destination stores through the pointer; nudged on the way in
    // it must be heard.
    controls: [{
      label: "entry", poison: ["e"], flip: { e: 0x01 }, before: true, every: true, reachEvery: true,
    }],
  });
  for (const r of exits) {
    assert.equal(r.dead.stopped, null, `${r.label}: the poisoned run stopped early: ${r.dead.stopped}`);
    assert.ok(heard(r.exitControl),
      `${r.label}: the SP nudge at this exit went unheard, so the exit poison never lands`);
  }
  console.log("  DEAD AT EXIT: the exit control and the E entry control are heard in every session");
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip: SKIP }, () => {
    const r = compare(twin, entryState());
    assert.ok(caught(r), `the gate PASSED the ${label} twin — it has no teeth`);
    console.log(`  TEETH/${label}: caught — ${show(r.escaped) || r.regMoved.join(",")}`);
  });
}
