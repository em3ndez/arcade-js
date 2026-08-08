// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_59c5 — memory-equivalent to the frozen oracle at ROM 0x59C5.
 *
 * WHAT IT IS. Two instructions: load a fixed table pointer, then tail-jump to the DOUBLED velocity
 * lookup at 0x59A0, which IS ALREADY DECOMPILED — so the rewrite calls doubledVelocityForHeading
 * directly with the table as an argument, and dissolving that transfer belongs to this caller's
 * unit. The whole content of the entry is the CHOICE OF TABLE, plus the fact that a pointer the
 * caller was already holding is discarded.
 *
 * ★ RAM ALONE CANNOT GATE THIS ROUTINE. The lookup writes no memory, so a RAM diff reports
 *   identical for the correct arm, for every twin, and for a bare no-op. The BLIND arm asserts
 *   exactly that, and it is the written justification for gating on RAM *plus* the declared
 *   live-out {b, c, d, e} everywhere else.
 *
 * ★ THE LIVE-OUT IS DERIVED FROM THE ORACLE, TWO WAYS, AND BOTH SAY THE PAIR. Statically, the
 *   oracle's one call site banks four registers into four consecutive bytes of an object record
 *   the instant it returns, and reads nothing else the entry leaves — the accumulator is reloaded
 *   from memory before its next use and the pointer register is overwritten. Empirically, the
 *   LIVE-OUT arm forces a, f and hl hostile AFTER every real dispatch of a whole session and the
 *   run stays bit-identical, while forcing either half of the pair alone forks it. So the pair is
 *   live, the rest is not, and the arm proves both directions rather than only the convenient one.
 *
 * ★ THE HEADING ARRIVES IN A REGISTER, NOT OFF A RECORD, which separates this lookup from the
 *   near-identical one a sibling family fixes tables for, and earns a tooth of its own. It also
 *   makes the crafted sweep EXHAUSTIVE over the input: the entry's whole input is that heading
 *   byte plus a pointer it discards, and both are swept.
 *
 * ★ THIS ENTRY IS THE BOTTOM RUNG, so it has no neighbour below and the twins are asymmetric. Six
 *   velocity tables sit in the image whose peak magnitudes climb in even steps — 0x59D7, 0x5C00,
 *   0x5E00, 0x2530, 0x2E3E, 0x08FA — and this is the slowest. The twins hand the lookup the rung
 *   ABOVE, the far end of the ladder, and two pointers that are no table at all; the RUNG LADDER
 *   arm reads the peaks and the steps between them out of memory rather than asserting them from
 *   this comment, and re-derives why the one neighbour cannot hide behind a near-zero sample.
 *
 * ★ THE CORPUS IS TINY AND THE FILE SAYS SO — two dispatches per session. That is why the crafted
 *   sweeps are the load-bearing arms here and the per-twin real-dispatch counts are recorded to
 *   catch a MOVE rather than offered as coverage. The second session is an A/B with a control:
 *   the driven turning tape reaches this entry zero times, and the SAME tape with the era index
 *   held at 1 in the once-per-frame service reaches it twice — one cell decides, and the poke goes
 *   into the frame service rather than into the entry, so the game's own dispatcher chooses.
 *
 * GATE: strict unit-capture, four replayed real sessions at every dispatch, an exhaustive sweep of
 *   the whole heading space, a swept incoming pointer, and a whole-machine replay. What it
 *   exercises, holes stated:
 *
 *   1. CONTRACT — unitEquivalence at the first real dispatch: RAM identical. `equal` is not
 *      asserted; it folds in the register diff this contract deliberately drops.
 *   2. BLIND — that same call passes a no-op, which is why the pair is gated too.
 *   3. TAPE REACH — measured: two of the four sessions reach this entry, twice each.
 *   4. UNIFORM CORPUS — what the corpus really varies, pinned, and the check that no caller ever
 *      arrives already holding a ladder table, which is what would let a forwarding rewrite hide.
 *   5. CORPUS — every dispatch of every session replayed, not a deduplicated sample.
 *   6. EXCLUDED — over the whole sweep no register outside the scratch set moves, stated as a
 *      containment rather than an exact shape.
 *   7. EXHAUSTIVE — all 256 headings crafted off the real entry, RAM and the pair.
 *   8. POINTER SWEEP — every ladder table and two junk pointers forced in at every heading.
 *   9. LIVE-OUT — the pair asserted everywhere, plus the hostile-register instrument and its
 *      positive control.
 *  10. RUNG LADDER — the six peaks and their spacing, read out of memory.
 *  11. WHOLE-MACHINE — attract with the rewrite wired, diffed every frame.
 *  12. TEETH — fourteen twins, each declaring the exact headings it survives, its catch count in
 *      each session, and that the whole machine forks on it.
 *
 * The whole-machine replay needs a shim: the host engine is cycle-driven and the path in is a call
 * that ends in the lookup's own return, so a candidate charging no T-states and not taking that
 * return would move the vblank interrupt and leak two stack bytes per dispatch. The total is
 * measured off a clone per dispatch rather than predicted, which makes it exact by construction.
 *
 * HOLE: the pair is compared as four register bytes. Which of the two is the screen's across and
 * which its down is not settled anywhere in this file.
 * HOLE: one object slot across the whole corpus, and every crafted arm varies the heading rather
 * than the slot. Nothing here speaks for a second.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-59c5.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, COIN_FRAME, START_FRAME, romsPresent } from "./_harness.js";
import { buildRoutines } from "../../routines.js";
import { loc_59c5 } from "../loc_59c5.js";
import { velocityForHeading } from "../velocityForHeading.js";
import { doubledVelocityForHeading } from "../doubledVelocityForHeading.js";
import { ERA_INDEX } from "../names.js";
import { loc_59c5 as oracle } from "../../translated/loc_59c5.js";
import {
  firstStateDiff,
  unitEquivalence,
  wholeMachineEquivalence,
} from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u16 } from "../../../../core/int.js";

const TARGET = 0x59c5;

/** The one table this entry exists to select, and the ladder it is the bottom rung of. */
const VELOCITY_TABLE = 0x59d7;
const LADDER = [0x59d7, 0x5c00, 0x5e00, 0x2530, 0x2e3e, 0x08fa];
const PEAKS = [206, 231, 256, 281, 306, 331];
const RUNG = LADDER.indexOf(VELOCITY_TABLE);
const RUNG_ABOVE = LADDER[RUNG + 1];

/** Where every rung holds the same near-zero sample, so ONE sample cannot tell them apart. */
const ZERO_CROSSINGS = [62, 63, 64, 65, 67, 190, 191, 192, 193];

/** Malformed pointers: one entry along, one BYTE along so each sample straddles two entries. */
const OFF_BY_ONE_ENTRY = VELOCITY_TABLE + 2;
const MISALIGNED = VELOCITY_TABLE + 1;

/** Pointers that are no table at all, for the sweep that shows the incoming one is discarded. */
const JUNK_POINTERS = [0x0000, 0xa800];

const RECORD_HEADING_CELL = 2;
const HEADINGS = 256;
const QUARTER = HEADINGS / 4;

const LIVE_OUT = ["b", "c", "d", "e"];
/** Registers the contract drops. The arm asserts CONTAINMENT in this set, never equality to it. */
const SCRATCH = ["a", "f", "h", "l", "sp"];
/** Left behind and claimed dead; the arm below forces each hostile and looks for a trace. */
const LEFT_BEHIND = ["a", "f", "hl"];

const CORPUS_FRAMES = 2000;
const WHOLE_FRAMES = 2000;
const ENTRY_BUDGET = 1600;
const RET_TSTATES = 10;

/** The era whose handler set reaches this entry. Held in the frame service, never at the entry. */
const HELD_ERA = 1;
const FRAME_SERVICE = 0x0038;

const IN0 = 0xc300;
const IN1 = 0xc320;
const HOLD = 8;
const TURN_HOLD = 60;
const TURN_FIRST_FRAME = 640;

const skip = romsPresent() ? false : "ROM images are not assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");
const everyHeading = Array.from({ length: HEADINGS }, (_unused, h) => h);

/** The coin-then-start tape with the stick walked round the compass, trigger held. */
function turnTape() {
  const tape = [
    { frame: COIN_FRAME, port: IN0, bits: 0x01, dur: HOLD },
    { frame: START_FRAME, port: IN0, bits: 0x08, dur: HOLD },
    { frame: TURN_FIRST_FRAME - HOLD, port: IN1, bits: 0x10, dur: CORPUS_FRAMES },
  ];
  const compass = [0x01, 0x05, 0x04, 0x06, 0x02, 0x0a, 0x08, 0x09, 0x01, 0x04, 0x02, 0x08];
  let frame = TURN_FIRST_FRAME;
  for (let i = 0; i < 60; i++) {
    tape.push({ frame, port: IN1, bits: compass[i % compass.length], dur: TURN_HOLD });
    frame += TURN_HOLD;
  }
  return tape;
}

const frameService = buildRoutines().get(FRAME_SERVICE);

/** The same turning tape, with one cell held in the once-per-frame service and nothing else. */
function eraHeldMachine(overrides) {
  const merged = new Map(overrides ?? []);
  const inner = merged.get(FRAME_SERVICE) ?? frameService;
  merged.set(FRAME_SERVICE, (mm, ...args) => {
    mm.mem8[ERA_INDEX] = HELD_ERA;
    return inner(mm, ...args);
  });
  return makeMachine(merged, { tape: turnTape() });
}

const attractMachine = (overrides) => makeMachine(overrides, { tape: [] });
const sharedMachine = (overrides) => makeMachine(overrides, {});
const turningMachine = (overrides) => makeMachine(overrides, { tape: turnTape() });

const SESSIONS = [
  ["attract", attractMachine],
  ["shared", sharedMachine],
  ["turning", turningMachine],
  ["era-held", eraHeldMachine],
];

/** Dispatches each session produces in CORPUS_FRAMES frames. Measured; a move here is a finding. */
const DISPATCHES = { attract: 2, shared: 0, turning: 0, "era-held": 2 };
/** Distinct headings each session presents. The sweep is what covers the rest of the circle. */
const CORPUS_HEADINGS = { attract: 2, shared: 0, turning: 0, "era-held": 2 };

const headingOf = (m) => m.regs.a;
const sampleAt = (m, table, index) => m.mem16[table + 2 * (index & (HEADINGS - 1))];
const signedAt = (m, table, index) => {
  const v = sampleAt(m, table, index);
  return v & 0x8000 ? v - 0x10000 : v;
};
const doubledSampleAt = (m, table, index) => u16(2 * sampleAt(m, table, index));

// ── the entry, and the comparison ───────────────────────────────────────────────────────

let entry = null;

function gate(candidate) {
  return unitEquivalence(
    attractMachine,
    TARGET,
    oracle,
    (m) => {
      if (entry === null) entry = m.clone();
      return candidate(m);
    },
    { maxFrames: ENTRY_BUDGET },
  );
}

function entryState() {
  if (entry === null) gate(loc_59c5);
  return entry;
}

/** Oracle vs candidate on clones of one machine: RAM first, then the declared pair. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return ram;
  for (const k of LIVE_OUT) {
    if (a.regs[k] !== b.regs[k]) return { addr: null, a: a.regs[k], b: b.regs[k] };
  }
  return null;
}

/** A real captured machine nudged onto one heading, which is the crafted-entry idiom. */
function selector(heading) {
  const m = entryState().clone();
  m.regs.a = heading;
  return m;
}

/** The same, with the pointer the caller is holding forced too. */
function withPointer(heading, pointer) {
  const m = selector(heading);
  m.regs.hl = pointer;
  return m;
}

// ── replaying whole sessions ────────────────────────────────────────────────────────────

function replaySession(factory, candidate) {
  let dispatches = 0;
  let caught = 0;
  const headings = new Set();
  const pointers = new Set();
  const eras = new Set();
  const m = factory(
    new Map([[TARGET, (mm) => {
      dispatches++;
      headings.add(headingOf(mm));
      pointers.add(mm.regs.hl);
      eras.add(mm.mem8[ERA_INDEX]);
      if (unitDiff(candidate, mm)) caught++;
      return oracle(mm);
    }]]),
  );
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "session ran short");
  return { dispatches, caught, headings, pointers, eras };
}

let sessionCache = null;
function sessions() {
  if (sessionCache) return sessionCache;
  sessionCache = SESSIONS.map(([label, factory]) => ({ label, ...replaySession(factory, loc_59c5) }));
  return sessionCache;
}

// ── the whole-session hostile-register instrument ───────────────────────────────────────

/** Two attract sessions diffed frame by frame: clean, and one mutated at every dispatch. */
function hostileSession(mutate) {
  const base = attractMachine();
  const baseFrames = base.runFrames(CORPUS_FRAMES);
  let dispatches = 0;
  const host = attractMachine(new Map([[TARGET, (mm) => {
    dispatches += 1;
    return mutate(mm);
  }]]));
  const hostFrames = host.runFrames(CORPUS_FRAMES);
  const addrs = new Set();
  const n = Math.min(baseFrames.length, hostFrames.length);
  for (let i = 0; i < n; i++) {
    const x = baseFrames[i];
    const y = hostFrames[i];
    for (let o = 0; o < x.length; o++) if (x[o] !== y[o]) addrs.add(base.stateOffsetToAddr(o));
  }
  return { cells: addrs.size, frames: n, dispatches, stopped: base.stoppedBy ?? host.stoppedBy };
}

const forceAfter = (keys) => (mm) => {
  const v = oracle(mm);
  for (const k of keys) mm.regs[k] = k.length === 1 ? 0x5a : 0x5a5a;
  return v;
};

// ── the cycle shim ──────────────────────────────────────────────────────────────────────

function hosted(candidate) {
  return (mm) => {
    const probe = mm.clone();
    const before = probe.cycles;
    oracle(probe);
    const total = probe.cycles - before;
    candidate(mm);
    mm.tick(total - RET_TSTATES);
    mm.ret(RET_TSTATES);
  };
}

const replay = (candidate) =>
  wholeMachineEquivalence(attractMachine, WHOLE_FRAMES, new Map([[TARGET, hosted(candidate)]]));

// ── the twins ───────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: uses the pointer the caller happened to be holding instead of overriding it. */
function brokenForwardsPointer(m) {
  doubledVelocityForHeading(m, m.regs.hl);
}

/** BUG: the undoubled lookup — the near-identical body this entry does NOT reach. */
function brokenNotDoubled(m) {
  velocityForHeading(m, VELOCITY_TABLE, m.regs.a);
}

/** BUG: doubles twice, which is the same mistake in the other direction. */
function brokenQuadrupled(m) {
  const { regs } = m;
  velocityForHeading(m, VELOCITY_TABLE, regs.a);
  regs.de = u16(4 * regs.de);
  regs.bc = u16(4 * regs.bc);
}

/** BUG: doubles one half of the pair and leaves the other at its table length. */
function brokenDoubledFirstOnly(m) {
  const { regs } = m;
  velocityForHeading(m, VELOCITY_TABLE, regs.a);
  regs.de = u16(2 * regs.de);
}

/** BUG: the pointer is off by a single entry, so every heading reads its neighbour. */
function brokenOffByOneEntry(m) {
  doubledVelocityForHeading(m, OFF_BY_ONE_ENTRY);
}

/** BUG: the pointer is off by one BYTE, so each sample straddles two entries. */
function brokenMisaligned(m) {
  doubledVelocityForHeading(m, MISALIGNED);
}

/** BUG: hands back the same sample twice instead of a perpendicular pair. */
function brokenNotPerpendicular(m) {
  const { regs } = m;
  regs.de = doubledSampleAt(m, VELOCITY_TABLE, regs.a);
  regs.bc = regs.de;
}

/** BUG: takes the partner a quarter turn the OTHER way, which mirrors one axis. */
function brokenQuarterReversed(m) {
  const { regs } = m;
  const heading = regs.a;
  regs.de = doubledSampleAt(m, VELOCITY_TABLE, heading);
  regs.bc = doubledSampleAt(m, VELOCITY_TABLE, heading + QUARTER);
}

/** BUG: the two halves of the answer change places. */
function brokenPairSwapped(m) {
  const { regs } = m;
  const heading = regs.a;
  const first = doubledSampleAt(m, VELOCITY_TABLE, heading);
  regs.de = doubledSampleAt(m, VELOCITY_TABLE, heading - QUARTER);
  regs.bc = first;
}

/** BUG: reads the heading off the object record, the way the sibling family's lookup does. */
function brokenHeadingOffTheRecord(m) {
  doubledVelocityForHeading(m, VELOCITY_TABLE, m.mem8[(m.regs.ix + RECORD_HEADING_CELL) & 0xffff]);
}

const DOUBLED_FIRST_ONLY_SURVIVORS = [0, 127, 128, 131, 255];
const QUARTER_REVERSED_SURVIVORS = [0, 127, 128, 255];
const OFF_BY_ONE_SURVIVORS = [127, 191];
const RECORD_HEADING_SURVIVORS = [0, 255];

/** label, twin, headings it survives, catch counts per session in SESSIONS order. */
const TWINS = [
  ["no-op", brokenNoOp, [], [2, 0, 0, 2]],
  ["forwards-the-pointer", brokenForwardsPointer, [], [2, 0, 0, 2]],
  ["not-doubled", brokenNotDoubled, [], [2, 0, 0, 2]],
  ["quadrupled", brokenQuadrupled, [], [2, 0, 0, 2]],
  ["doubled-first-only", brokenDoubledFirstOnly, DOUBLED_FIRST_ONLY_SURVIVORS, [2, 0, 0, 2]],
  ["rung-above", (m) => doubledVelocityForHeading(m, RUNG_ABOVE), [], [2, 0, 0, 2]],
  ["two-rungs-above", (m) => doubledVelocityForHeading(m, LADDER[RUNG + 2]), [], [2, 0, 0, 2]],
  ["top-rung", (m) => doubledVelocityForHeading(m, LADDER[5]), [], [2, 0, 0, 2]],
  ["off-by-one-entry", brokenOffByOneEntry, OFF_BY_ONE_SURVIVORS, [2, 0, 0, 2]],
  ["misaligned-by-a-byte", brokenMisaligned, [], [2, 0, 0, 2]],
  ["not-perpendicular", brokenNotPerpendicular, [], [2, 0, 0, 2]],
  ["quarter-reversed", brokenQuarterReversed, QUARTER_REVERSED_SURVIVORS, [2, 0, 0, 2]],
  ["pair-swapped", brokenPairSwapped, [], [2, 0, 0, 2]],
  ["heading-off-the-record", brokenHeadingOffTheRecord, RECORD_HEADING_SURVIVORS, [2, 0, 0, 2]],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("CONTRACT: unitEquivalence at the first real dispatch, RAM identical", { skip }, () => {
  const r = gate(loc_59c5);
  assert.notEqual(entry, null, "vacuous: the session never reached the routine");
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  const e = entryState();
  console.log(`  CONTRACT: entry heading ${headingOf(e)} holding ${hex4(e.regs.hl)}; RAM identical`);
});

test("BLIND: RAM alone passes a no-op, which is why the pair is gated too", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  brokenNoOp(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(
    ram,
    null,
    "RAM caught a candidate that does nothing, so this routine DOES write memory and every arm " +
      "below that leans on the declared pair has to be re-derived",
  );
  assert.notEqual(unitDiff(brokenNoOp, entryState()), null, "the pair must catch the no-op");
  console.log("  BLIND: RAM sees nothing; the declared pair catches the empty candidate");
});

test("TAPE REACH: two tapes never reach this entry; one held cell turns that around", { skip }, () => {
  const seen = sessions();
  console.log(`  TAPE REACH (measured): ${seen.map((s) => `${s.label} ${s.dispatches}`).join(", ")}`);
  for (const s of seen) assert.equal(s.dispatches, DISPATCHES[s.label], `${s.label} count moved`);
  const held = seen.find((s) => s.label === "era-held");
  assert.ok(held.dispatches > 0, "the control cell stopped bringing the driven tape here, so the " +
    "A/B this file rests on no longer holds");
  assert.deepEqual([...held.eras], [HELD_ERA], "the control cell did not stay held");
});

test("UNIFORM CORPUS: what real play varies, and what it never presents", { skip }, () => {
  const seen = sessions();
  console.log(
    `  UNIFORM CORPUS (measured): ${seen.map((s) => `${s.label} ${s.headings.size} headings, ` +
      `${s.pointers.size} incoming pointers`).join("; ")}`,
  );
  for (const s of seen) {
    assert.equal(s.headings.size, CORPUS_HEADINGS[s.label], `${s.label}: heading variety moved, ` +
      "so the crafted sweep is covering a different hole from the one this file records");
    for (const table of LADDER) {
      assert.ok(!s.pointers.has(table), `a ${s.label} caller now arrives holding ${hex4(table)}, ` +
        "so a rewrite that forwarded the incoming pointer would hide there");
    }
  }
});

test("CORPUS: every dispatch of every session replays identically", { skip }, () => {
  let total = 0;
  for (const s of sessions()) {
    assert.equal(s.caught, 0, `the rewrite diverged on ${s.caught} ${s.label} dispatches`);
    total += s.dispatches;
  }
  console.log(`  CORPUS: ${total} real dispatches, RAM and the pair identical on each`);
});

test("EXCLUDED, deliberately: nothing outside the scratch set moves, over the whole sweep", { skip }, () => {
  const moved = new Set();
  for (const heading of everyHeading) {
    const a = selector(heading);
    const b = a.clone();
    oracle(a);
    loc_59c5(b);
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
    for (const k of LIVE_OUT) assert.equal(a.regs[k], b.regs[k], `live-out ${k} at heading ${heading}`);
  }
  const measured = REG_FIELDS.filter((k) => moved.has(k));
  console.log(`  EXCLUDED (measured): ${measured.join(", ")}`);
  assert.deepEqual(measured.filter((k) => !SCRATCH.includes(k)), [], "a register outside the " +
    "scratch set moved, so the contract this file gates on no longer describes the rewrite");
});

test("EXHAUSTIVE: all 256 headings crafted off the real entry are identical", { skip }, () => {
  for (const heading of everyHeading) {
    const d = unitDiff(loc_59c5, selector(heading));
    assert.equal(d, null, `heading ${heading}: ${show(d)}`);
  }
  console.log(`  EXHAUSTIVE: ${HEADINGS} headings identical on RAM and on the pair`);
});

test("POINTER SWEEP: the incoming pointer is discarded at every heading", { skip }, () => {
  const pointers = [...LADDER, ...JUNK_POINTERS];
  for (const pointer of pointers) {
    for (const heading of everyHeading) {
      const d = unitDiff(loc_59c5, withPointer(heading, pointer));
      assert.equal(d, null, `pointer ${hex4(pointer)} heading ${heading}: ${show(d)}`);
    }
  }
  console.log(`  POINTER SWEEP: ${pointers.length} incoming pointers x ${HEADINGS} headings, identical`);
});

test("LIVE-OUT: the dead registers steer nothing and the pair steers the game", { skip }, () => {
  const dead = hostileSession(forceAfter(LEFT_BEHIND));
  assert.equal(dead.stopped, null, `a run stopped early (${dead.stopped})`);
  assert.equal(dead.frames, CORPUS_FRAMES, `compared ${dead.frames} of ${CORPUS_FRAMES} frames`);
  assert.ok(dead.dispatches > 0, "vacuous: the instrument never reached the routine");
  assert.equal(dead.cells, 0, "a hostile value in a register the rewrite does not promise reached " +
    "game memory: some caller CONSUMES it and the live-out declaration is wrong");
  const first = hostileSession(forceAfter(["de"]));
  const second = hostileSession(forceAfter(["bc"]));
  assert.ok(first.cells > 0, "forcing half the declared pair changed nothing, so the instrument " +
    "does not reach this routine and the arm above proves nothing");
  assert.ok(second.cells > 0, "forcing the other half changed nothing, so the instrument does " +
    "not reach this routine and the arm above proves nothing");
  console.log(
    `  LIVE-OUT: ${LEFT_BEHIND.join(", ")} forced hostile after all ${dead.dispatches} dispatches, ` +
      `no trace; the pair's halves fork ${first.cells} and ${second.cells} cells`,
  );
});

test("RUNG LADDER: the peaks step evenly and the one neighbour cannot hide", { skip }, () => {
  const m = entryState();
  const peaks = LADDER.map((t) => Math.max(...everyHeading.map((h) => Math.abs(signedAt(m, t, h)))));
  const steps = peaks.slice(1).map((p, i) => p - peaks[i]);
  console.log(`  RUNG LADDER (measured): peaks ${peaks.join("/")}, steps ${steps.join("/")}`);
  assert.deepEqual(peaks, PEAKS, "the ladder of peak magnitudes moved");
  assert.deepEqual(steps, [25, 25, 25, 25, 25], "the rungs stopped being evenly spaced");
  assert.equal(RUNG, 0, "this entry stopped being the bottom rung, so it now HAS a neighbour " +
    "below and the twins above no longer bracket it");
  const oneAgrees = everyHeading.filter(
    (h) => sampleAt(m, VELOCITY_TABLE, h) === sampleAt(m, RUNG_ABOVE, h),
  );
  assert.deepEqual(oneAgrees, ZERO_CROSSINGS, `${hex4(RUNG_ABOVE)}: the agreeing headings moved`);
  const bothAgree = oneAgrees.filter(
    (h) => sampleAt(m, VELOCITY_TABLE, h - QUARTER) === sampleAt(m, RUNG_ABOVE, h - QUARTER),
  );
  assert.deepEqual(bothAgree, [], `${hex4(RUNG_ABOVE)} matches on BOTH samples somewhere, so ` +
    "those headings cannot discriminate it and the twin's survivor list must record them");
});

test("WHOLE-MACHINE: attract is byte-identical with the rewrite wired", { skip }, () => {
  const w = replay(loc_59c5);
  assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the override never dispatched");
  assert.equal(w.framesCompared, WHOLE_FRAMES, "the replay ran short of the frames asked for");
  assert.equal(w.equal, true, `forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  console.log(`  WHOLE-MACHINE: ${w.framesCompared} frames, ${w.invocations.get(TARGET)} dispatches, identical`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin, survives, perSession] of TWINS) {
  test(`TEETH: the ${label} twin is caught on EXACTLY the declared headings`, { skip }, () => {
    const missed = everyHeading.filter((h) => unitDiff(twin, selector(h)) === null);
    console.log(
      `  TEETH/${label}: caught on ${HEADINGS - missed.length} of ${HEADINGS} headings; ` +
        `survivors [${missed.join(",")}]`,
    );
    assert.deepEqual(missed, survives, `${label}: wrong survivor set over the heading sweep`);
  });

  test(`TEETH: the ${label} twin is caught on an exact count of real dispatches`, { skip }, () => {
    const counts = SESSIONS.map(([, factory]) => replaySession(factory, twin));
    console.log(`  TEETH/${label}: real sessions catch ${counts.map((r) => r.caught).join("/")}`);
    for (const [i, r] of counts.entries()) {
      assert.equal(r.caught, perSession[i], `the ${label} twin's ${SESSIONS[i][0]} catch count moved`);
    }
  });

  test(`TEETH: the whole machine forks on the ${label} twin`, { skip }, () => {
    const w = replay(twin);
    assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the twin never dispatched");
    console.log(
      `  TEETH/${label}: whole machine ${w.equal ? "is BLIND" : `forks at frame ${w.frame}`}`,
    );
    assert.equal(w.equal, false, `the whole machine stopped seeing the ${label} twin`);
  });
}
