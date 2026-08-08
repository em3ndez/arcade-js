// SPDX-License-Identifier: GPL-3.0-only
/**
 * placeDiagonallyAbuttingTile — memory-equivalent to the frozen oracle at ROM 0x308A.
 *
 * WHAT IT IS. One sprite entry's two coordinate bytes read as a single sixteen-bit number, moved
 * by a fixed diagonal step, and written to the entry one stride on; then both of the caller's
 * cursors are advanced by the already-decompiled advanceToNextSlot, so that transfer is dissolved
 * into a direct call here.
 *
 * ★ THE CARRY BETWEEN THE TWO BYTES IS THE WHOLE SUBTLETY. The step is applied to the PAIR, not to
 *   each byte on its own, so a low byte that wraps borrows from the high one. The low axis moves
 *   ON by a pitch and the high axis BACK by a pitch, which means the borrow happens exactly when
 *   the low byte's value plus the pitch passes 255. The crafted sweep runs both bytes over their
 *   whole range at that boundary and the no-carry twin is the tooth that says the arm can fail.
 *
 * GATE: strict unit-capture, three replayed sessions at every dispatch, an exhaustive sweep of one
 *   byte and a cross over both, and a whole-machine replay. Holes stated:
 *
 *   1. EQUAL at the real dispatch — RAM byte-identical.
 *   2. NOT VACUOUS — a no-op FAILS that same diff.
 *   3. EXCLUDED — over the crafted cross nothing outside the scratch set moves. The set is an
 *      upper BOUND on the divergence, not a measurement of it: a rewrite that leaves fewer of
 *      those registers dirty is strictly better and still passes. The two cursors the caller
 *      relies on are checked as live-outs rather than excluded.
 *   4. UNIFORM CORPUS — which sessions reach this entry and how many sprite bases they present.
 *   5. CORPUS — every dispatch of three sessions.
 *   6. EXHAUSTIVE — the low byte swept 0..255 against a fixed high byte, then the reverse.
 *   7. CRAFTED CROSS — both bytes over a grid that straddles the borrow boundary.
 *   8. WHOLE-MACHINE — an attract session with the rewrite wired, diffed every frame.
 *   9. TEETH — eight twins, each with an exact catch count over the sweep and per session.
 *
 * HOLE: the sprite base itself is never varied by any crafted arm; the corpus arm reports how many
 * bases real play presents and that is the whole coverage of them.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-308a.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, COIN_FRAME, START_FRAME, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { placeDiagonallyAbuttingTile } from "../placeDiagonallyAbuttingTile.js";
import { advanceToNextSlot } from "../advanceToNextSlot.js";
import { loc_308a as oracle } from "../../translated/loc_308a.js";
import {
  firstStateDiff,
  unitEquivalence,
  wholeMachineEquivalence,
} from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x308a;

const ENTRY_STRIDE = 2;
const RECORD_STRIDE = 16;
const SPRITE_PITCH = 16;
const HIGH_AXIS = 49;
const LOW_AXIS = 0;

const MOVED = ["b", "c", "h", "l", "sp"];
const LIVE_OUT = ["ix", "iy"];

const CORPUS_FRAMES = 2000;
const WHOLE_FRAMES = 1400;
const RET_TSTATES = 10;

const IN0 = 0xc300;
const IN1 = 0xc320;
const HOLD = 8;
const TURN_HOLD = 60;
const TURN_FIRST_FRAME = 640;

const skip = romsPresent() ? false : "ROM images are not assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");
const everyByte = Array.from({ length: 256 }, (_unused, v) => v);

function turnTape() {
  const tape = [
    { frame: COIN_FRAME, port: IN0, bits: 0x01, dur: HOLD },
    { frame: START_FRAME, port: IN0, bits: 0x08, dur: HOLD },
    { frame: TURN_FIRST_FRAME - HOLD, port: IN1, bits: 0x10, dur: CORPUS_FRAMES },
  ];
  const compass = [0x01, 0x05, 0x04, 0x06, 0x02, 0x0a, 0x08, 0x09, 0x01, 0x04, 0x02, 0x08];
  let frame = TURN_FIRST_FRAME;
  for (const bits of compass) {
    tape.push({ frame, port: IN1, bits, dur: TURN_HOLD });
    frame += TURN_HOLD;
  }
  return tape;
}

const sharedMachine = (overrides) => makeMachine(overrides);
const attractMachine = (overrides) => makeMachine(overrides, { tape: [] });
const turningMachine = (overrides) => makeMachine(overrides, { tape: turnTape() });

const SESSIONS = [
  ["attract", attractMachine],
  ["shared", sharedMachine],
  ["turning", turningMachine],
];

/** Dispatches each session produces in CORPUS_FRAMES frames. Measured; a move here is a finding. */
const DISPATCHES = { attract: 1102, shared: 0, turning: 0 };

const highAt = (m) => (m.regs.iy + HIGH_AXIS) & 0xffff;
const lowAt = (m) => (m.regs.iy + LOW_AXIS) & 0xffff;
const nextHighAt = (m) => (m.regs.iy + ENTRY_STRIDE + HIGH_AXIS) & 0xffff;
const nextLowAt = (m) => (m.regs.iy + ENTRY_STRIDE + LOW_AXIS) & 0xffff;
const WRITTEN = [nextHighAt, nextLowAt];

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
    { maxFrames: ENTRY_FRAMES },
  );
}

function entryState() {
  if (entry === null) gate(placeDiagonallyAbuttingTile);
  return entry;
}

/** Oracle vs candidate on clones of one machine: RAM first, then the two cursors. */
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

/** A real captured machine with the entry's two coordinate bytes forced. */
function craft(high, low) {
  const m = entryState().clone();
  m.mem8[highAt(m)] = high;
  m.mem8[lowAt(m)] = low;
  return m;
}

/** A grid that straddles the borrow boundary on the low axis and the wrap on the high one. */
const GRID = [0, 1, 15, 16, 17, 127, 128, 129, 200, 238, 239, 240, 241, 254, 255];

let crossCache = null;
function cross() {
  if (crossCache) return crossCache;
  const out = [];
  for (const high of GRID) for (const low of everyByte) out.push([high, low]);
  crossCache = out;
  return out;
}

// ── replaying whole sessions ────────────────────────────────────────────────────────────

function replaySession(factory, candidate) {
  let dispatches = 0;
  let caught = 0;
  let borrowing = 0;
  const bases = new Set();
  const m = factory(
    new Map([[TARGET, (mm) => {
      dispatches++;
      bases.add(mm.regs.iy);
      if (mm.mem8[lowAt(mm)] + SPRITE_PITCH > 255) borrowing++;
      if (unitDiff(candidate, mm)) caught++;
      return oracle(mm);
    }]]),
  );
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "session ran short");
  return { dispatches, caught, borrowing, bases };
}

let sessionCache = null;
function sessions() {
  if (sessionCache) return sessionCache;
  sessionCache = SESSIONS.map(([label, factory]) => ({ label, ...replaySession(factory, placeDiagonallyAbuttingTile) }));
  return sessionCache;
}

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

function brokenNoOp() {}

/** BUG: the two bytes are stepped independently, so the low axis' wrap never borrows. */
function brokenNoBorrow(m) {
  const { mem8, regs } = m;
  const entryBase = regs.iy;
  mem8[entryBase + ENTRY_STRIDE + HIGH_AXIS] = mem8[entryBase + HIGH_AXIS] - SPRITE_PITCH;
  mem8[entryBase + ENTRY_STRIDE + LOW_AXIS] = mem8[entryBase + LOW_AXIS] + SPRITE_PITCH;
  advanceToNextSlot(m);
}

/** BUG: both axes step the same way, so the tile is placed alongside rather than cornered. */
function brokenNotDiagonal(m) {
  const { mem8, regs } = m;
  const entryBase = regs.iy;
  const moved =
    ((mem8[entryBase + HIGH_AXIS] << 8) + mem8[entryBase + LOW_AXIS] + SPRITE_PITCH * 256 + SPRITE_PITCH) & 0xffff;
  mem8[entryBase + ENTRY_STRIDE + HIGH_AXIS] = moved >> 8;
  mem8[entryBase + ENTRY_STRIDE + LOW_AXIS] = moved;
  advanceToNextSlot(m);
}

/** BUG: the high axis is left where it was, which is the abutting sibling's behaviour. */
function brokenHighAxisCopied(m) {
  const { mem8, regs } = m;
  const entryBase = regs.iy;
  mem8[entryBase + ENTRY_STRIDE + HIGH_AXIS] = mem8[entryBase + HIGH_AXIS];
  mem8[entryBase + ENTRY_STRIDE + LOW_AXIS] = mem8[entryBase + LOW_AXIS] + SPRITE_PITCH;
  advanceToNextSlot(m);
}

/** BUG: writes over the CURRENT entry instead of the next one. */
function brokenWritesCurrent(m) {
  const { mem8, regs } = m;
  const entryBase = regs.iy;
  const moved =
    ((mem8[entryBase + HIGH_AXIS] << 8) + mem8[entryBase + LOW_AXIS] - SPRITE_PITCH * 256 + SPRITE_PITCH) & 0xffff;
  mem8[entryBase + HIGH_AXIS] = moved >> 8;
  mem8[entryBase + LOW_AXIS] = moved;
  advanceToNextSlot(m);
}

/** BUG: the cursors are not advanced, so a caller chaining a further tile overwrites this one. */
function brokenCursorsHeld(m) {
  const { mem8, regs } = m;
  const entryBase = regs.iy;
  const moved =
    ((mem8[entryBase + HIGH_AXIS] << 8) + mem8[entryBase + LOW_AXIS] - SPRITE_PITCH * 256 + SPRITE_PITCH) & 0xffff;
  mem8[entryBase + ENTRY_STRIDE + HIGH_AXIS] = moved >> 8;
  mem8[entryBase + ENTRY_STRIDE + LOW_AXIS] = moved;
}

/** BUG: only the record cursor advances, so the two run out of step. */
function brokenOneCursorOnly(m) {
  const { mem8, regs } = m;
  const entryBase = regs.iy;
  const moved =
    ((mem8[entryBase + HIGH_AXIS] << 8) + mem8[entryBase + LOW_AXIS] - SPRITE_PITCH * 256 + SPRITE_PITCH) & 0xffff;
  mem8[entryBase + ENTRY_STRIDE + HIGH_AXIS] = moved >> 8;
  mem8[entryBase + ENTRY_STRIDE + LOW_AXIS] = moved;
  regs.ix = regs.ix + RECORD_STRIDE;
}

/** BUG: the two axes change places. */
function brokenAxesSwapped(m) {
  const { mem8, regs } = m;
  const entryBase = regs.iy;
  const moved =
    ((mem8[entryBase + LOW_AXIS] << 8) + mem8[entryBase + HIGH_AXIS] - SPRITE_PITCH * 256 + SPRITE_PITCH) & 0xffff;
  mem8[entryBase + ENTRY_STRIDE + HIGH_AXIS] = moved >> 8;
  mem8[entryBase + ENTRY_STRIDE + LOW_AXIS] = moved;
  advanceToNextSlot(m);
}

/** The crafted grid holds 15 high bytes x 256 low bytes; 16 low bytes of each row borrow. */
const EVERY_ENTRY = GRID.length * 256;
const BORROWING_ENTRIES = GRID.length * SPRITE_PITCH;

const TWINS = [
  ["no-op", brokenNoOp, EVERY_ENTRY, [1102, 0, 0], true],
  ["no-borrow", brokenNoBorrow, BORROWING_ENTRIES, [105, 0, 0], true],
  ["not-diagonal", brokenNotDiagonal, EVERY_ENTRY, [1102, 0, 0], true],
  ["high-axis-copied", brokenHighAxisCopied, EVERY_ENTRY, [1102, 0, 0], true],
  ["writes-current-entry", brokenWritesCurrent, EVERY_ENTRY, [1102, 0, 0], true],
  ["cursors-held", brokenCursorsHeld, EVERY_ENTRY, [1102, 0, 0], true],
  ["one-cursor-only", brokenOneCursorOnly, EVERY_ENTRY, [1102, 0, 0], true],
  ["axes-swapped", brokenAxesSwapped, 3825, [1098, 0, 0], true],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: placeDiagonallyAbuttingTile == oracle on RAM", { skip }, () => {
  const r = gate(placeDiagonallyAbuttingTile);
  assert.notEqual(entry, null, "vacuous: the session never reached the routine");
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  const e = entryState();
  console.log(
    `  EQUAL: entry base ${hex4(e.regs.iy)} holding ${e.mem8[highAt(e)]}/${e.mem8[lowAt(e)]}; identical`,
  );
});

test("NOT VACUOUS: a no-op candidate FAILS the RAM diff at the real dispatch", { skip }, () => {
  const d = unitDiff(brokenNoOp, entryState());
  assert.notEqual(d, null, "the RAM diff passed a candidate that does nothing, so RAM is NOT " +
    "this gate and the whole file must be re-derived");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

test("EXCLUDED, deliberately: only scratch registers move, over the whole cross", { skip }, () => {
  const moved = new Set();
  for (const [high, low] of cross()) {
    const a = craft(high, low);
    const b = a.clone();
    oracle(a);
    placeDiagonallyAbuttingTile(b);
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
    for (const at of WRITTEN) assert.equal(a.mem8[at(a)], b.mem8[at(b)], `live-out ${hex4(at(a))}`);
    for (const k of LIVE_OUT) assert.equal(a.regs[k], b.regs[k], `live-out ${k}`);
  }
  console.log(`  EXCLUDED (measured): ${REG_FIELDS.filter((k) => moved.has(k)).join(", ")}`);
  const unexpected = REG_FIELDS.filter((k) => moved.has(k) && !MOVED.includes(k));
  assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
});

test("UNIFORM CORPUS: which sessions reach this entry, and with what", { skip }, () => {
  const seen = sessions();
  console.log(
    `  UNIFORM CORPUS (measured): ${seen.map((s) =>
      `${s.label} ${s.dispatches} dispatches / ${s.bases.size} bases / ${s.borrowing} borrowing`).join("; ")}`,
  );
  for (const s of seen) assert.equal(s.dispatches, DISPATCHES[s.label], `${s.label} count moved`);
  const borrowing = seen.reduce((n, s) => n + s.borrowing, 0);
  assert.ok(borrowing > 0, "no real dispatch crosses the borrow boundary, so the no-borrow twin " +
    "would be invisible on real data and only the crafted sweep holds it");
});

test("CORPUS: every dispatch of three real sessions replays identically", { skip }, () => {
  let total = 0;
  for (const s of sessions()) {
    assert.equal(s.caught, 0, `the rewrite diverged on ${s.caught} ${s.label} dispatches`);
    total += s.dispatches;
  }
  assert.ok(total > 0, "vacuous: no session reaches the routine at all");
  console.log(`  CORPUS: ${total} real dispatches, RAM and the cursors identical on each`);
});

test("CRAFTED: both coordinate bytes over a grid that straddles the borrow", { skip }, () => {
  for (const [high, low] of cross()) {
    const d = unitDiff(placeDiagonallyAbuttingTile, craft(high, low));
    assert.equal(d, null, `high ${high} low ${low}: ${show(d)}`);
  }
  console.log(`  CRAFTED: ${cross().length} entries identical`);
});

test("WHOLE-MACHINE: attract is byte-identical with the rewrite wired", { skip }, () => {
  const w = replay(placeDiagonallyAbuttingTile);
  assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the override never dispatched");
  assert.equal(w.framesCompared, WHOLE_FRAMES, "the replay ran short of the frames asked for");
  assert.equal(w.equal, true, `forked at frame ${w.frame} on ${hex4(w.addr ?? 0)}`);
  console.log(`  WHOLE-MACHINE: ${w.framesCompared} frames, ${w.invocations.get(TARGET)} dispatches, identical`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin, crossCaught, perSession, wholeRunSees] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    const caught = cross().filter(([h, l]) => unitDiff(twin, craft(h, l)) !== null).length;
    console.log(`  TEETH/${label}: caught on ${caught} of ${cross().length} crafted entries`);
    assert.equal(caught, crossCaught, `the ${label} twin's crafted catch count moved`);
    assert.ok(caught > 0, `the crafted cross missed the ${label} twin everywhere`);
  });

  test(`TEETH: the ${label} twin is caught on an exact count of real dispatches`, { skip }, () => {
    const counts = SESSIONS.map(([, factory]) => replaySession(factory, twin));
    console.log(`  TEETH/${label}: real sessions catch ${counts.map((r) => r.caught).join("/")}`);
    for (const [i, r] of counts.entries()) {
      assert.equal(r.caught, perSession[i], `the ${label} twin's ${SESSIONS[i][0]} count moved`);
    }
  });

  test(`TEETH: the whole machine sees the ${label} twin, or is recorded blind`, { skip }, () => {
    const w = replay(twin);
    console.log(
      `  TEETH/${label}: whole machine ${w.equal ? "is BLIND, as recorded" : `forks at frame ${w.frame}`}`,
    );
    assert.ok(w.invocations.get(TARGET) > 0, "vacuous: the twin never dispatched");
    assert.equal(w.equal, !wholeRunSees, `the whole-machine verdict on the ${label} twin changed`);
  });
}
