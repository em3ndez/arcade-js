// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnAtEdgeAhead — memory-equivalent to the frozen oracle at ROM 0x4853.
 *
 * GATE: unit-capture judged by a MASKED RAM diff, a replayed corpus of every dispatch from two
 *   sessions, a crafted sweep that reaches all four of the routine's exits, and teeth.
 *
 *   THE ONE EXCLUSION is the dead stack scratch: the frozen routine reaches its table lookup
 *   through a call, so the two bytes just below the entry stack pointer can hold that call's
 *   return slot. The window is exactly [SP-2, SP) and every arm PINS it.
 *
 * What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — identical outside that two-byte window.
 *   2. NOT VACUOUS — a candidate that does nothing FAILS the same masked comparison. THE REAL
 *      DISPATCH TAKES AN EARLY EXIT, so that arm is run at a crafted entry where the placing
 *      really happens, and the file says which.
 *   3. CORPUS — every dispatch of a driven and an undriven session, counts asserted, together
 *      with WHICH EXIT each dispatch took, so a corpus that only ever bounces off a guard is
 *      reported as such rather than read as coverage.
 *   4. EXCLUDED — the register divergence pinned to a measured set.
 *   5. EXHAUSTIVE — all four exits, and the placing arm over every one of the 256 headings:
 *      the gate cell open and shut, the frame bit set and clear, and the delay at the value that
 *      expires and at values that do not.
 *   6. TEETH — eight twins, each caught on an exact count of crafted entries. The two guard
 *      twins score in the low tens where the rest score in the hundreds, and that is the family
 *      reporting its own shape: a guard that is not consulted can only differ on the entries
 *      where that guard would have stopped the routine.
 *
 * HOLE: the two cursors are the ones the captured dispatch arrived with, so which record and
 * which sprite entry get written is not varied here — the corpus arm is the only thing that
 * speaks for those, and it presents ONE of each, which it asserts.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-4853.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { spawnAtEdgeAhead } from "../spawnAtEdgeAhead.js";
import { loc_4853 as oracle } from "../../translated/loc_4853.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u8, u16 } from "../../../../core/int.js";
import { FRAME_TICK } from "../names.js";

const TARGET = 0x4853;
const skip = romsPresent() ? false : "ROM images are gitignored and absent";

const SCRATCH_BYTES = 2;
const ACTION_GATE = 0xad0d;
const PLAYER_HEADING = 0xa802;
const EVERY_OTHER_FRAME = 0x01;
const DELAY = 0x0e;
const STATE = 0x00;
const LIVE = 0xff;
const EDGE_POSITIONS = 0x488d;
const FIRST_COORDINATE = 0x00;
const SECOND_COORDINATE = 0x31;
const RESET_FIELDS = [[0x0a, 0], [0x0b, 0], [0x0c, 64], [0x0d, 0]];

const CORPUS_FRAMES = 2000;
const TAPES = [["shared", {}], ["attract", { tape: [] }]];
/** Dispatches each session produces in CORPUS_FRAMES frames. Measured; a move here is a finding. */
const DISPATCHES = { shared: 598, attract: 844 };

/**
 * The captured dispatch bounces off the frame bit, so it moves almost nothing; the set is
 * therefore pinned at BOTH that entry and a crafted one that runs the whole body.
 */
const EXCLUDED_AT_ENTRY = ["sp"];
const EXCLUDED_WHEN_PLACING = ["f", "sp"];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: frozen=${d.a} candidate=${d.b}` : "identical");

// ── the entry, and the masked comparison ────────────────────────────────────────────────

let entry = null;

function gate(candidate) {
  return unitEquivalence(
    makeMachine,
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
  if (entry === null) gate(spawnAtEdgeAhead);
  return entry;
}

const inScratch = (addr, sp) => addr >= sp - SCRATCH_BYTES && addr < sp;

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

function unitDiff(candidate, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  return allDiffs(a, b).find((d) => !inScratch(d.addr, sp)) ?? null;
}

/** Which of the four exits a state takes, named by what stops it. */
function exitOf(m) {
  if (m.mem8[ACTION_GATE] !== 0) return "gate";
  if ((m.mem8[FRAME_TICK] & EVERY_OTHER_FRAME) === 0) return "frame";
  if (u8(m.mem8[u16(m.regs.ix + DELAY)] - 1) !== 0) return "delay";
  return "places";
}

function craft(gateCell, counter, delay, heading) {
  const m = entryState().clone();
  m.mem8[ACTION_GATE] = gateCell;
  m.mem8[FRAME_TICK] = counter;
  m.mem8[u16(m.regs.ix + DELAY)] = delay;
  m.mem8[PLAYER_HEADING] = heading;
  return m;
}

const GATES = [0, 1, 0xff];
const COUNTERS = [0x00, 0x01, 0xfe, 0xff];
const DELAYS = [1, 2, 0];

function craftedPoints() {
  const points = [];
  for (const g of GATES) {
    for (const c of COUNTERS) {
      for (const d of DELAYS) points.push([g, c, d, 0x40]);
    }
  }
  for (let heading = 0; heading < 256; heading++) points.push([0, 1, 1, heading]);
  return points;
}

const POINTS = craftedPoints();

function sweepCaught(candidate) {
  let caught = 0;
  for (const [g, c, d, h] of POINTS) if (unitDiff(candidate, craft(g, c, d, h))) caught++;
  return caught;
}

// ── replaying whole sessions ────────────────────────────────────────────────────────────

function replaySession(opts, candidate) {
  let dispatches = 0;
  let caught = 0;
  const exits = new Map();
  const records = new Set();
  const m = makeMachine(
    new Map([[TARGET, (mm) => {
      dispatches++;
      records.add(mm.regs.ix);
      const which = exitOf(mm);
      exits.set(which, (exits.get(which) ?? 0) + 1);
      if (unitDiff(candidate, mm)) caught++;
      return oracle(mm);
    }]]),
    opts,
  );
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "session ran short");
  return { dispatches, caught, exits, records };
}

let sessionCache = null;
function sessions() {
  if (!sessionCache) {
    sessionCache = TAPES.map(([label, opts]) => ({ label, ...replaySession(opts, spawnAtEdgeAhead) }));
  }
  return sessionCache;
}

// ── the twins ───────────────────────────────────────────────────────────────────────────

function place(m, { round = 8, order = 0, live = true, reset = true } = {}) {
  const { regs, mem8 } = m;
  const sector = u8(mem8[PLAYER_HEADING] + round) >> 4;
  const first = mem8[EDGE_POSITIONS + 2 * sector];
  const second = mem8[EDGE_POSITIONS + 2 * sector + 1];
  mem8[u16(regs.iy + SECOND_COORDINATE)] = order === 0 ? first : second;
  mem8[u16(regs.iy + FIRST_COORDINATE)] = order === 0 ? second : first;
  if (reset) for (const [f, v] of RESET_FIELDS) mem8[u16(regs.ix + f)] = v;
  if (live) mem8[u16(regs.ix + STATE)] = LIVE;
}

function guarded(m, options, { checkGate = true, checkFrame = true, writeDelay = true } = {}) {
  const { regs, mem8 } = m;
  if (checkGate && mem8[ACTION_GATE] !== 0) return;
  if (checkFrame && (mem8[FRAME_TICK] & EVERY_OTHER_FRAME) === 0) return;
  const delay = u8(mem8[u16(regs.ix + DELAY)] - 1);
  if (writeDelay) mem8[u16(regs.ix + DELAY)] = delay;
  if (delay !== 0) return;
  place(m, options);
}

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: the gate cell is never consulted. */
function brokenIgnoresTheGate(m) {
  guarded(m, {}, { checkGate: false });
}

/** BUG: the frame bit is never consulted, so it acts twice as often. */
function brokenIgnoresTheFrameBit(m) {
  guarded(m, {}, { checkFrame: false });
}

/** BUG: the delay is tested but never stored back, so it never counts down. */
function brokenDoesNotStoreTheDelay(m) {
  guarded(m, {}, { writeDelay: false });
}

/** BUG: the heading is truncated instead of rounded to the nearer sector. */
function brokenTruncatesTheHeading(m) {
  guarded(m, { round: 0 });
}

/** BUG: the coordinate pair goes into the entry the other way round. */
function brokenSwapsThePair(m) {
  guarded(m, { order: 1 });
}

/** BUG: the four working bytes are left as they were. */
function brokenSkipsTheReset(m) {
  guarded(m, { reset: false });
}

/** BUG: the slot is placed but never marked live. */
function brokenNeverArms(m) {
  guarded(m, { live: false });
}

const TWINS = [
  ["no-op", brokenNoOp, 262],
  ["ignores-the-gate", brokenIgnoresTheGate, 12],
  ["ignores-the-frame-bit", brokenIgnoresTheFrameBit, 6],
  ["does-not-store-the-delay", brokenDoesNotStoreTheDelay, 262],
  ["truncates-the-heading", brokenTruncatesTheHeading, 128],
  ["swaps-the-pair", brokenSwapsThePair, 242],
  ["skips-the-reset", brokenSkipsTheReset, 258],
  ["never-arms", brokenNeverArms, 258],
];

/** A crafted entry that really does place, for the arms that must not be vacuous. */
const placingEntry = () => craft(0, 1, 1, 0x40);

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: identical outside the two-byte scratch window", { skip }, () => {
  gate(spawnAtEdgeAhead);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  const sp = entryState().regs.sp;
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  spawnAtEdgeAhead(b);
  const strays = allDiffs(a, b).filter((d) => !inScratch(d.addr, sp));
  assert.deepEqual(strays, [], `a divergence escaped the scratch window: ${show(strays[0])}`);
  console.log(
    `  EQUAL: entry record=${hex4(entryState().regs.ix)} exit=${exitOf(entryState())} sp=${hex4(sp)}`,
  );
});

test("NOT VACUOUS: an empty candidate FAILS, at an entry that really places", { skip }, () => {
  const placing = placingEntry();
  assert.equal(exitOf(placing), "places", "the crafted entry no longer reaches the placing arm");
  const d = unitDiff(brokenNoOp, placing);
  assert.notEqual(d, null, "the masked diff passed an empty candidate at a placing entry");
  console.log(`  NOT VACUOUS: caught at a placing entry — ${show(d)}`);
});

test("CORPUS: every dispatch of two whole sessions, with the exits it took", { skip }, () => {
  let total = 0;
  const exits = new Set();
  for (const s of sessions()) {
    assert.equal(s.dispatches, DISPATCHES[s.label], `the ${s.label} dispatch count moved`);
    assert.ok(s.dispatches > 0, `vacuous: the ${s.label} tape never reached the routine`);
    assert.equal(s.caught, 0, `the rewrite diverged on ${s.caught} ${s.label} dispatches`);
    for (const k of s.exits.keys()) exits.add(k);
    assert.equal(s.records.size, 1, `the ${s.label} tape now presents more than one record, so ` +
      "the hole this file states about the cursors is out of date");
    total += s.dispatches;
  }
  console.log(
    `  CORPUS: ${total} dispatches, identical on each; exits reached ${[...exits].sort().join(", ")}` +
      ` — ${sessions().map((s) => `${s.label} ${[...s.exits].map(([k, n]) => `${k}:${n}`).join(" ")}`).join("; ")}`,
  );
});

function movedRegisters(machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  spawnAtEdgeAhead(b);
  assert.notEqual(a.pc, b.pc, "the frozen routine's return moves pc; the rewrite returns to JS");
  return REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
}

test("EXCLUDED, deliberately: pinned at the captured entry AND at a placing one", { skip }, () => {
  assert.deepEqual(
    movedRegisters(entryState()),
    EXCLUDED_AT_ENTRY,
    "the excluded set at the captured entry changed shape",
  );
  assert.deepEqual(
    movedRegisters(placingEntry()),
    EXCLUDED_WHEN_PLACING,
    "the excluded set at a placing entry changed shape",
  );
  console.log(
    `  EXCLUDED: ${EXCLUDED_AT_ENTRY.join(", ")} at the captured entry, ` +
      `${EXCLUDED_WHEN_PLACING.join(", ")} when it places, and pc in both`,
  );
});

test("EXHAUSTIVE: all four exits, and every heading through the placing one", { skip }, () => {
  assert.equal(sweepCaught(spawnAtEdgeAhead), 0, "the rewrite diverged somewhere in the crafted space");
  const reached = new Set(POINTS.map(([g, c, d, h]) => exitOf(craft(g, c, d, h))));
  assert.deepEqual(
    [...reached].sort(),
    ["delay", "frame", "gate", "places"],
    "the crafted family no longer reaches all four exits",
  );
  console.log(`  EXHAUSTIVE: ${POINTS.length} crafted entries identical, all four exits reached`);
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    assert.equal(sweepCaught(twin), expected, `the ${label} twin's catch count moved`);
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    console.log(`  TEETH/${label}: caught on ${expected} of ${POINTS.length} crafted entries`);
  });
}
