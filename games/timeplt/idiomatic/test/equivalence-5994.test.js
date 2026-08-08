// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_5994 — memory-equivalent to the frozen oracle at ROM 0x5994.
 *
 * WHAT IT IS. Two instructions: seat a fixed velocity-table pointer, then tail-jump to ROM 0x599D,
 * which reads the heading out of the object record and falls into the DOUBLED lookup at ROM
 * 0x59A0. Both of those are already decompiled. The rewrite calls doubledVelocityForHeading — the
 * twin of the body 0x599D falls into — with the table and the heading as arguments, which is
 * literally what loc_599d's own body does with the pointer its caller seated. It does NOT go
 * through loc_599d: that twin takes only the machine and reads the table out of a register, so
 * reaching it would mean staging a register before the call, and register marshalling into an
 * already-decompiled callee is the leak this contract exists to remove. This entry and the one at
 * ROM 0x598E are the same two instructions with a different constant, and the table is the whole
 * difference — which is why the sibling's table is one of the twins below.
 *
 * ★ RAM ALONE CANNOT GATE THIS ROUTINE. The lookup writes no memory, so a RAM diff reports
 *   identical for the correct arm, for every twin, and for a bare no-op. The BLIND arm asserts
 *   exactly that, and it is the written justification for gating on RAM *plus* the declared
 *   live-out {b, c, d, e} everywhere else.
 *
 * ★ THE LIVE-OUT IS DERIVED FROM THE ORACLE'S EXIT SUCCESSORS, NOT FROM THE REWRITE. The oracle
 *   ends by taking the return of the routine it falls into, so its successor is whatever slot the
 *   caller parked. There is exactly one way in: the little-endian word for this address occurs in
 *   the whole 24KB image only at ROM 0x478F, 0x4791 and 0x4793, which are three arms of the inline
 *   jump table the entry at ROM 0x478B dispatches on, and every one of those arms returns to ROM
 *   0x4795. The four instructions there bank E, D, C and B into +0x0A..+0x0D of the record the
 *   entry was handed, and nothing after them reads anything else this entry leaves. The SEAT arm
 *   watches the oracle land on exactly that address, so the derivation is measured and not only
 *   read, and the LIVE-OUT arm forces a, f and hl hostile after every dispatch of a whole session
 *   with no trace while each half of the pair alone forks the run — both directions, one
 *   instrument.
 *
 * ★ THE CORPUS IS UNIFORM IN THE TWO WAYS THAT MATTER, AND BOTH ARE MEASURED HERE RATHER THAN
 *   ASSUMED. Every real dispatch arrives holding the same incoming pointer, because the table
 *   dispatch leaves the arm's own address in the register a caller would otherwise be forwarding;
 *   and at no real dispatch does the accumulator hold the record's heading, which is what lets
 *   real play catch a twin that reads the accumulator instead of the record. Both facts are
 *   asserted, so a change in either turns this gate red rather than quietly widening its holes.
 *
 * ★ EVERY ZERO IS PAIRED WITH A POSITIVE CONTROL IN THE SAME ARM. Three bare tapes reach this
 *   entry zero times; the SAME three tapes with two cells held in the once-per-frame service reach
 *   it. The registers claimed dead leave no trace; the pair forks the run.
 *
 * GATE: strict unit-capture, six replayed real sessions at every dispatch, an exhaustive cross of
 *   every pointer a caller could be holding against the whole heading space, and a whole-machine
 *   replay. What it exercises, holes stated:
 *
 *   1. CONTRACT — unitEquivalence at the first real dispatch: RAM identical. `equal` is not
 *      asserted; it folds in the register diff this contract deliberately drops.
 *   2. BLIND — that same call passes a no-op, which is why the pair is gated too.
 *   3. SEAT — the rewrite leaves the stack pointer exactly where it found it, over the whole cross,
 *      and the oracle lands on the address the jump table's arms all return to.
 *   4. TAPE REACH — measured, with the A/B that makes each zero mean something.
 *   5. UNIFORM CORPUS — one incoming pointer, the record bases, and the accumulator shadowing,
 *      all measured and all asserted.
 *   6. CORPUS — every dispatch of every session, not a deduplicated sample.
 *   7. EXCLUDED — a CEILING over the whole cross: no register outside the declared set moves, with
 *      an in-arm control showing the measurement can see one that does.
 *   8. EXHAUSTIVE CROSS — eight pointers by all 256 headings, RAM and the pair.
 *   9. LIVE-OUT — the hostile-register instrument, with its controls in both directions.
 *  10. TABLE DISCRIMINATION — read out of memory: no two of the eight pointers agree on BOTH
 *      halves of the pair at any heading, which is why a wrong-table twin cannot hide.
 *  11. DISSOLVES, NOT RESTATES — the module's text: it must name the lookup's file and call it
 *      rather than carry the lookup's own body, with that body as a positive control.
 *  12. WHOLE-MACHINE — a held session with the rewrite wired, diffed every frame.
 *  13. TEETH — thirteen twins, each with its exact crafted catch count, its exact per-session
 *      count, and its whole-machine verdict.
 *
 * The whole-machine replay needs a shim: the host engine is cycle-driven and the way in ends in
 * the lookup's own return, so a candidate charging no T-states and not taking that return would
 * move the vblank interrupt and leak two stack bytes per dispatch. The total is measured off a
 * clone per dispatch rather than predicted, which makes it exact by construction.
 *
 * HOLE: two record bases across the whole corpus. Every crafted arm varies the heading inside the
 * record or the pointer beside it, never the record it is read from.
 * HOLE: the pair is compared as four register bytes. Which of the two is the screen's across and
 * which its down is not settled anywhere in this file.
 * HOLE: the sessions that reach this entry hold two cells in the frame service. Nothing here shows
 * how often an untouched cabinet reaches the table arm at all.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-5994.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { makeMachine, COIN_FRAME, START_FRAME, romsPresent } from "./_harness.js";
import { buildRoutines } from "../../routines.js";
import { loc_5994 } from "../loc_5994.js";
import { velocityForHeading } from "../velocityForHeading.js";
import { doubledVelocityForHeading } from "../doubledVelocityForHeading.js";
import { ERA_INDEX, MOTHER_SHIP_ARMED } from "../names.js";
import { loc_5994 as oracle } from "../../translated/loc_5994.js";
import { firstStateDiff, unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u16 } from "../../../../core/int.js";

const TARGET = 0x5994;

/** The six velocity tables in the image, and two pointers that are no table at all. */
const LADDER = [0x59d7, 0x5c00, 0x5e00, 0x2530, 0x2e3e, 0x08fa];
const JUNK_POINTERS = [0x0000, 0xa800];
const POINTERS = [...LADDER, ...JUNK_POINTERS];
const PEAKS = [206, 231, 256, 281, 306, 331];

/** The one table this entry exists to seat, and the one its structural sibling seats instead. */
const VELOCITY_TABLE = LADDER[1];
const SIBLING_TABLE = LADDER[0];

/** Where every arm of the jump table returns to, and so where the oracle must land. */
const ARM_RETURN = 0x4795;

const RECORD_HEADING_CELL = 2;
const HEADINGS = 256;
const QUARTER = HEADINGS / 4;

const LIVE_OUT = ["b", "c", "d", "e"];
/** The ceiling on register divergence. Containment is asserted, never equality. */
const SCRATCH = ["a", "f", "h", "l", "sp"];
/** Left behind and claimed dead; the live-out arm forces each hostile and looks for a trace. */
const LEFT_BEHIND = ["a", "f", "hl"];

const CORPUS_FRAMES = 2000;
const WHOLE_FRAMES = 1600;
const ENTRY_BUDGET = 1600;
const RET_TSTATES = 10;

/** The era whose jump-table arm is this entry, and the flag that opens the path to that table. */
const HELD_ERA = 2;
const ARMED = 0xff;
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

/** Any tape, with two cells held in the once-per-frame service and nothing else touched. */
function armed(tape) {
  return (overrides) => {
    const merged = new Map(overrides ?? []);
    const inner = merged.get(FRAME_SERVICE) ?? frameService;
    merged.set(FRAME_SERVICE, (mm, ...args) => {
      mm.mem8[ERA_INDEX] = HELD_ERA;
      mm.mem8[MOTHER_SHIP_ARMED] = ARMED;
      return inner(mm, ...args);
    });
    return makeMachine(merged, { tape });
  };
}

const TAPES = [["attract", []], ["shared", undefined], ["turning", turnTape()]];

/**
 * Three bare tapes and the SAME three with two cells held. The pairing is the instrument: a zero
 * on the left means something only because its partner on the right is not zero.
 */
const SESSIONS = [
  ...TAPES.map(([l, t]) => [l, (ov) => makeMachine(ov, { tape: t })]),
  ...TAPES.map(([l, t]) => [`armed-${l}`, armed(t)]),
];
const AB_PAIRS = TAPES.map(([l]) => [l, `armed-${l}`]);

/** Dispatches each session produces in CORPUS_FRAMES frames. Measured; a move here is a finding. */
const DISPATCHES = {
  attract: 0, shared: 0, turning: 0,
  "armed-attract": 8, "armed-shared": 11, "armed-turning": 4,
};

/** The session the whole-machine and hostile-register arms run on. */
const HOST = armed(undefined);

const headingOf = (m) => m.mem8[m.regs.ix + RECORD_HEADING_CELL];
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
    armed([]),
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
  if (entry === null) gate(loc_5994);
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

/** A real captured machine with one heading written into the record it points at. */
function selector(heading) {
  const m = entryState().clone();
  m.mem8[m.regs.ix + RECORD_HEADING_CELL] = heading;
  return m;
}

/** The same, with the pointer the caller is carrying forced too. */
function withPointer(heading, pointer) {
  const m = selector(heading);
  m.regs.hl = pointer;
  return m;
}

let crossCache = null;
function cross() {
  if (crossCache) return crossCache;
  crossCache = [];
  for (const pointer of POINTERS) for (const heading of everyHeading) crossCache.push([heading, pointer]);
  return crossCache;
}

// ── capturing whole sessions ────────────────────────────────────────────────────────────

function captureSession(factory) {
  let dispatches = 0;
  let shadowed = 0;
  const entries = [];
  const headings = new Set();
  const pointers = new Set();
  const bases = new Set();
  const m = factory(
    new Map([[TARGET, (mm) => {
      dispatches++;
      headings.add(headingOf(mm));
      pointers.add(mm.regs.hl);
      bases.add(mm.regs.ix);
      if (mm.regs.a === headingOf(mm)) shadowed++;
      entries.push(mm.clone());
      return oracle(mm);
    }]]),
  );
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "session ran short");
  return { dispatches, shadowed, entries, headings, pointers, bases };
}

let sessionCache = null;
function sessions() {
  if (!sessionCache) {
    sessionCache = SESSIONS.map(([label, factory]) => ({ label, ...captureSession(factory) }));
  }
  return sessionCache;
}
const sessionNamed = (label) => sessions().find((s) => s.label === label);
const corpusCaught = (candidate) =>
  sessions().map((s) => s.entries.filter((e) => unitDiff(candidate, e) !== null).length);

// ── the whole-machine replay, and the hostile-register instrument ───────────────────────

let baselineRun = null;
function baseline() {
  if (!baselineRun) {
    const base = HOST();
    const frames = base.runFrames(WHOLE_FRAMES);
    assert.equal(base.stoppedBy, null, `the baseline stopped early: ${base.stoppedBy}`);
    baselineRun = { frames, offsetToAddr: (o) => base.stateOffsetToAddr(o) };
  }
  return baselineRun;
}

/** Run the host session with one override wired, and report every cell that ever differed. */
function sessionCells(override) {
  const base = baseline();
  let fired = 0;
  const host = HOST(new Map([[TARGET, (mm) => (fired++, override(mm))]]));
  const hostFrames = host.runFrames(WHOLE_FRAMES);
  const cells = new Set();
  let frame = -1;
  const n = Math.min(base.frames.length, hostFrames.length);
  for (let f = 0; f < n; f++) {
    const x = base.frames[f];
    const y = hostFrames[f];
    for (let o = 0; o < x.length; o++) {
      if (x[o] !== y[o]) {
        cells.add(base.offsetToAddr(o));
        if (frame < 0) frame = f;
      }
    }
  }
  return { fired, cells: cells.size, frame, frames: n, stopped: host.stoppedBy };
}

/** The dispatch as the assembled game would perform it: no T-states of its own, and no return. */
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

const replay = (candidate) => sessionCells(hosted(candidate));
const forceAfter = (keys) => (mm) => {
  const v = oracle(mm);
  for (const k of keys) mm.regs[k] = k.length === 1 ? 0x5a : 0x5a5a;
  return v;
};

// ── the twins ───────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: uses the pointer the caller happened to be holding instead of seating one. */
function brokenForwardsPointer(m) {
  doubledVelocityForHeading(m, m.regs.hl, headingOf(m));
}

/** BUG: seats the table the structural sibling at ROM 0x598E seats. */
function brokenSiblingTable(m) {
  doubledVelocityForHeading(m, SIBLING_TABLE, headingOf(m));
}

/** BUG: the far end of the ladder, so the pace is as wrong as it can be. */
function brokenTopRung(m) {
  doubledVelocityForHeading(m, LADDER[5], headingOf(m));
}

/** BUG: takes the heading as a value the way the sibling shims do, ignoring the record. */
function brokenHeadingFromAccumulator(m) {
  doubledVelocityForHeading(m, VELOCITY_TABLE);
}

/** BUG: the heading is read one cell too far along the record. */
function brokenHeadingFromNextCell(m) {
  doubledVelocityForHeading(m, VELOCITY_TABLE, m.mem8[m.regs.ix + RECORD_HEADING_CELL + 1]);
}

/** BUG: the record is addressed through the other index register. */
function brokenHeadingOffOtherBase(m) {
  doubledVelocityForHeading(m, VELOCITY_TABLE, m.mem8[m.regs.iy + RECORD_HEADING_CELL]);
}

/** BUG: the undoubled lookup — the near-identical body this entry does NOT reach. */
function brokenNotDoubled(m) {
  velocityForHeading(m, VELOCITY_TABLE, headingOf(m));
}

/** BUG: the pointer is off by a single entry, so every heading reads its neighbour. */
function brokenOffByOneEntry(m) {
  doubledVelocityForHeading(m, u16(VELOCITY_TABLE + 2), headingOf(m));
}

/** BUG: the pointer is off by one BYTE, so each sample straddles two entries. */
function brokenMisaligned(m) {
  doubledVelocityForHeading(m, u16(VELOCITY_TABLE + 1), headingOf(m));
}

/** BUG: hands back the same sample twice instead of a perpendicular pair. */
function brokenNotPerpendicular(m) {
  const { regs } = m;
  regs.de = doubledSampleAt(m, VELOCITY_TABLE, headingOf(m));
  regs.bc = regs.de;
}

/** BUG: takes the partner a quarter turn the OTHER way, which mirrors one axis. */
function brokenQuarterReversed(m) {
  const { regs } = m;
  const heading = headingOf(m);
  regs.de = doubledSampleAt(m, VELOCITY_TABLE, heading);
  regs.bc = doubledSampleAt(m, VELOCITY_TABLE, heading + QUARTER);
}

/** BUG: the two halves of the answer change places. */
function brokenPairSwapped(m) {
  const { regs } = m;
  const heading = headingOf(m);
  const first = doubledSampleAt(m, VELOCITY_TABLE, heading);
  regs.de = doubledSampleAt(m, VELOCITY_TABLE, heading - QUARTER);
  regs.bc = first;
}

/**
 * label, twin, its crafted catch count, and its per-session catch counts in SESSIONS order. All
 * measured. The next-cell twin survives one real dispatch, where the cell beyond the heading
 * happens to hold the heading's own value; that survivor is recorded rather than rounded up.
 */
const TWINS = [
  ["no-op", brokenNoOp, 2048, [0, 0, 0, 8, 11, 4]],
  ["forwards-the-pointer", brokenForwardsPointer, 1792, [0, 0, 0, 8, 11, 4]],
  ["the-sibling-table", brokenSiblingTable, 2048, [0, 0, 0, 8, 11, 4]],
  ["top-rung", brokenTopRung, 2048, [0, 0, 0, 8, 11, 4]],
  ["heading-from-the-accumulator", brokenHeadingFromAccumulator, 2040, [0, 0, 0, 8, 11, 4]],
  ["heading-from-the-next-cell", brokenHeadingFromNextCell, 2032, [0, 0, 0, 7, 11, 4]],
  ["heading-off-the-other-base", brokenHeadingOffOtherBase, 2032, [0, 0, 0, 8, 11, 4]],
  ["not-doubled", brokenNotDoubled, 2048, [0, 0, 0, 8, 11, 4]],
  ["off-by-one-entry", brokenOffByOneEntry, 2032, [0, 0, 0, 8, 11, 4]],
  ["misaligned-by-a-byte", brokenMisaligned, 2048, [0, 0, 0, 8, 11, 4]],
  ["not-perpendicular", brokenNotPerpendicular, 2048, [0, 0, 0, 8, 11, 4]],
  ["quarter-reversed", brokenQuarterReversed, 2016, [0, 0, 0, 8, 11, 4]],
  ["pair-swapped", brokenPairSwapped, 2048, [0, 0, 0, 8, 11, 4]],
];

/**
 * The module's text against the lookup it is supposed to CALL. The lookup is identified by a name
 * out of its own body; the module must name the lookup's file, call it, and NOT carry that name.
 * The same predicate runs over the lookup itself as a positive control, so the absence is
 * evidence only once the check is shown able to see the thing present.
 */
const HELPER = ["doubledVelocityForHeading", "../doubledVelocityForHeading.js", "velocityForHeading"];
const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

function callsRatherThanRestates(text, [name, file, ownName]) {
  return text.includes(`from "./${file.slice(3)}"`) && text.includes(`${name}(m,`) &&
    !text.includes(ownName);
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("CONTRACT: unitEquivalence at the first real dispatch, RAM identical", { skip }, () => {
  const r = gate(loc_5994);
  assert.notEqual(entry, null, "vacuous: the session never reached the routine");
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  const e = entryState();
  console.log(
    `  CONTRACT: entry heading ${headingOf(e)} base ${hex4(e.regs.ix)} holding ${hex4(e.regs.hl)}; ` +
      "RAM identical",
  );
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

test("SEAT: the rewrite leaves the stack pointer where it found it, over the cross", { skip }, () => {
  for (const [heading, pointer] of cross()) {
    const m = withPointer(heading, pointer);
    const seat = m.regs.sp;
    loc_5994(m);
    assert.equal(m.regs.sp, seat, `the rewrite moved the stack pointer at heading ${heading}`);
  }
  const watched = entryState().clone();
  const seat = watched.regs.sp;
  oracle(watched);
  console.log(
    `  SEAT: rewrite holds ${hex4(seat)} across ${cross().length} entries; the oracle takes the ` +
      `return in the routine it falls into and lands on ${hex4(watched.pc)}`,
  );
  assert.equal(watched.regs.sp, u16(seat + 2), "the oracle stopped consuming the caller's slot, so " +
    "the seam that supplies the omitted return for the rewrite is no longer describing this entry");
  assert.equal(watched.pc, ARM_RETURN, "the oracle no longer lands where the jump table's arms " +
    "return to, so the successor the live-out was read off is not the successor it reaches");
});

test("TAPE REACH: three bare tapes never reach this entry; two held cells turn each around", { skip }, () => {
  const seen = sessions();
  console.log(`  TAPE REACH (measured): ${seen.map((s) => `${s.label} ${s.dispatches}`).join(", ")}`);
  for (const s of seen) assert.equal(s.dispatches, DISPATCHES[s.label], `${s.label} count moved`);
  for (const [bare, held] of AB_PAIRS) {
    assert.equal(sessionNamed(bare).dispatches, 0, `${bare} started reaching this entry on its own`);
    assert.ok(
      sessionNamed(held).dispatches > 0,
      `${held} reaches this entry zero times too, so the zero at ${bare} is a rig that can reach ` +
        "nothing rather than a tape that does not come here, and it proves nothing",
    );
  }
});

test("UNIFORM CORPUS: one incoming pointer, and the accumulator never shadows", { skip }, () => {
  const seen = sessions().filter((s) => s.dispatches > 0);
  const bases = new Set(seen.flatMap((s) => [...s.bases]));
  const pointers = new Set(seen.flatMap((s) => [...s.pointers]));
  const total = seen.reduce((n, s) => n + s.dispatches, 0);
  const shadowed = seen.reduce((n, s) => n + s.shadowed, 0);
  console.log(
    `  UNIFORM CORPUS (measured): bases ${[...bases].map(hex4).join(",")}; pointers ` +
      `${[...pointers].map(hex4).join(",")}; shadowed ${shadowed} of ${total}`,
  );
  assert.ok(total > 0, "vacuous: no session reaches the routine at all");
  assert.equal(pointers.size, 1, "real play now presents a second incoming pointer, so the crafted " +
    "cross is covering a different hole from the one this file records");
  assert.ok(!pointers.has(VELOCITY_TABLE), "a caller now arrives holding this entry's own table, " +
    "so a twin that forwards the incoming pointer can hide behind it");
  assert.equal(shadowed, 0, "a real dispatch now arrives with the accumulator already holding the " +
    "record's heading, so real play can no longer tell the two apart everywhere and the " +
    "accumulator twin's recorded counts are stale");
  assert.ok(bases.size > 1, "the corpus collapsed onto one record base, so nothing here speaks " +
    "for a second slot any more");
});

test("CORPUS: every dispatch of every session replays identically", { skip }, () => {
  const caught = corpusCaught(loc_5994);
  const total = sessions().reduce((n, s) => n + s.dispatches, 0);
  assert.ok(total > 0, "vacuous: no session reaches the routine at all");
  assert.deepEqual(caught, SESSIONS.map(() => 0), "the rewrite diverged on a real dispatch");
  console.log(`  CORPUS: ${total} real dispatches, RAM and the pair identical on each`);
});

/** Which registers a candidate parts company with the oracle on, over the whole cross. */
function movedOver(candidate) {
  const moved = new Set();
  for (const [heading, pointer] of cross()) {
    const a = withPointer(heading, pointer);
    const b = a.clone();
    oracle(a);
    candidate(b);
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return moved;
}

test("EXCLUDED, deliberately: no register outside the ceiling moves, over the cross", { skip }, () => {
  const moved = movedOver(loc_5994);
  // The absence is evidence only if the same measurement CAN report a register outside the
  // ceiling, so the control leaves a mark in one the contract does not cover.
  const control = movedOver((m) => {
    loc_5994(m);
    m.regs.iy = u16(m.regs.iy + 1);
  });
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !SCRATCH.includes(k)),
    "the measurement reports nothing outside the ceiling even for a candidate that deliberately " +
      "moves a register outside it, so a clean reading below proves nothing");
  const measured = REG_FIELDS.filter((k) => moved.has(k));
  console.log(`  EXCLUDED (measured): ${measured.join(", ")} — ceiling ${SCRATCH.join(", ")}; the ` +
    `control also moves ${REG_FIELDS.filter((k) => control.has(k) && !SCRATCH.includes(k)).join(", ")}`);
  // SCRATCH is a CEILING, not a set the rewrite is required to fill. deepEqual against it would
  // DEMAND the divergence and go RED on a rewrite that became register-exact.
  assert.deepEqual(measured.filter((k) => !SCRATCH.includes(k)), [], "a register outside the " +
    "declared ceiling diverged, so the contract this file gates on no longer describes the rewrite");
});

test("EXHAUSTIVE CROSS: every pointer by every heading is identical", { skip }, () => {
  for (const [heading, pointer] of cross()) {
    const d = unitDiff(loc_5994, withPointer(heading, pointer));
    assert.equal(d, null, `pointer ${hex4(pointer)} heading ${heading}: ${show(d)}`);
  }
  console.log(
    `  EXHAUSTIVE CROSS: ${POINTERS.length} pointers x ${HEADINGS} headings identical on RAM ` +
      "and on the pair",
  );
});

test("LIVE-OUT: the dead registers steer nothing and the pair steers the game", { skip }, () => {
  const dead = sessionCells(forceAfter(LEFT_BEHIND));
  assert.equal(dead.stopped, null, `a run stopped early (${dead.stopped})`);
  assert.equal(dead.frames, WHOLE_FRAMES, `compared ${dead.frames} of ${WHOLE_FRAMES} frames`);
  assert.ok(dead.fired > 0, "vacuous: the instrument never reached the routine");
  assert.equal(dead.cells, 0, "a hostile value in a register the rewrite does not promise reached " +
    "game memory: some caller CONSUMES it and the live-out declaration is wrong");
  const first = sessionCells(forceAfter(["de"]));
  const second = sessionCells(forceAfter(["bc"]));
  assert.ok(first.cells > 0, "forcing half the declared pair changed nothing, so the instrument " +
    "does not reach this routine and the arm above proves nothing");
  assert.ok(second.cells > 0, "forcing the other half changed nothing, so the instrument does " +
    "not reach this routine and the arm above proves nothing");
  console.log(
    `  LIVE-OUT: ${LEFT_BEHIND.join(", ")} forced hostile after all ${dead.fired} dispatches, no ` +
      `trace; the pair's halves fork ${first.cells} and ${second.cells} cells`,
  );
});

test("TABLE DISCRIMINATION: no two pointers agree on BOTH halves of the pair", { skip }, () => {
  const m = entryState();
  const peaks = LADDER.map((t) => Math.max(...everyHeading.map((h) => Math.abs(signedAt(m, t, h)))));
  console.log(`  TABLE DISCRIMINATION (measured): ladder peaks ${peaks.join("/")}`);
  assert.deepEqual(peaks, PEAKS, "the ladder of peak magnitudes moved");
  for (let i = 0; i < POINTERS.length; i++) {
    for (let j = i + 1; j < POINTERS.length; j++) {
      const both = everyHeading.filter(
        (h) => sampleAt(m, POINTERS[i], h) === sampleAt(m, POINTERS[j], h) &&
          sampleAt(m, POINTERS[i], h - QUARTER) === sampleAt(m, POINTERS[j], h - QUARTER),
      );
      assert.deepEqual(both, [], `${hex4(POINTERS[i])} and ${hex4(POINTERS[j])} agree on the whole ` +
        "pair somewhere, so a twin seating either one can hide at those headings and the twin " +
        "catch counts below must record them");
    }
  }
  console.log(
    `  TABLE DISCRIMINATION: no pair of the ${POINTERS.length} pointers agrees on both halves ` +
      "anywhere, which is what puts every wrong-table twin at one catch per crafted entry",
  );
});

test("DISSOLVES, NOT RESTATES: the module's text, with the lookup as a positive control", () => {
  const module = read("../loc_5994.js");
  assert.ok(callsRatherThanRestates(module, HELPER), `the module does not call ${HELPER[0]}`);
  assert.ok(!callsRatherThanRestates(read(HELPER[1]), HELPER), `the check passes ${HELPER[0]}'s ` +
    "OWN body, so it cannot tell a call from an inlined copy and proves nothing");
  console.log(`  DISSOLVES, NOT RESTATES: ${HELPER[0]} is called, and its own body fails the same check`);
});

test("WHOLE-MACHINE: a held session is byte-identical with the rewrite wired", { skip }, () => {
  const w = replay(loc_5994);
  assert.ok(w.fired > 0, "vacuous: the override never dispatched");
  assert.equal(w.stopped, null, `the replay stopped early: ${w.stopped}`);
  assert.equal(w.frames, WHOLE_FRAMES, "the replay ran short of the frames asked for");
  assert.equal(w.cells, 0, `forked at frame ${w.frame} on ${w.cells} cells`);
  console.log(`  WHOLE-MACHINE: ${w.frames} frames, ${w.fired} dispatches, identical`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin, craftedCaught, perSession] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    const caught = cross().filter(([h, p]) => unitDiff(twin, withPointer(h, p)) !== null).length;
    console.log(`  TEETH/${label}: caught on ${caught} of ${cross().length} crafted entries`);
    assert.ok(caught > 0, `the crafted cross missed the ${label} twin everywhere, so nothing in ` +
      "this file holds the rewrite against it");
    assert.equal(caught, craftedCaught, `the ${label} twin's crafted catch count moved`);
  });

  test(`TEETH: the ${label} twin is caught on an exact count of real dispatches`, { skip }, () => {
    const counts = corpusCaught(twin);
    const blind = SESSIONS.map(([l], i) => (DISPATCHES[l] > 0 && counts[i] === 0 ? l : null)).filter(Boolean);
    console.log(
      `  TEETH/${label}: real sessions catch ${counts.join("/")}` +
        (blind.length ? ` — BLIND to ${blind.join(",")}, as recorded` : ""),
    );
    assert.deepEqual(counts, perSession, `the ${label} twin's real catch counts moved`);
  });

  test(`TEETH: the whole machine forks on the ${label} twin`, { skip }, () => {
    const w = replay(twin);
    assert.ok(w.fired > 0, "vacuous: the twin never dispatched");
    console.log(`  TEETH/${label}: whole machine forks at frame ${w.frame} on ${w.cells} cells`);
    assert.ok(w.cells > 0, `the whole machine is BLIND to the ${label} twin, which is not what ` +
      "this file recorded when the counts were measured");
  });
}
