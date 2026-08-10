// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceEra0BallisticObjectBank vs the frozen oracle at ROM 0x3fea: real coin-start dispatches, the four decision
 * branches crafted, and a three-slot occupancy x era sweep, each masked for the dead stack scratch
 * the dissolved tails leave and held to a register ceiling. Run:
 *   node --test games/timeplt/idiomatic/test/equivalence-3fea.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { serviceEra0BallisticObjectBank as candidate } from "../serviceEra0BallisticObjectBank.js";
import { loc_3fea as oracle } from "../../translated/loc_3fea.js";
import { loc_400b } from "../loc_400b.js";
import { sweepObjectSlotBankServicingFirstSlot as sweep } from "../sweepObjectSlotBankServicingFirstSlot.js";
import { flyAlongBallisticArc as fly } from "../flyAlongBallisticArc.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x3fea;
const ERA_INDEX = 0xad04;
const RECORD_SEAT = 0xa8c0;
const RECORD_STRIDE = 0x10;
const BANK_SLOTS = 3;
const EMPTY = 0x00;
const OTHER = 0x40;
const BALLISTIC = 0xff;
const MARKERS = [EMPTY, OTHER, BALLISTIC];

// Every data write lands at or below here; the seat sits far above it, so masking the scratch can
// never hide a real byte. Asserted against the watched floor below.
const DATA_TOP = 0xadff;

// The dissolved tails leave the accumulator, the staging pair and the flag/HL working set where the
// frozen side does not, and re-seat the stack; checked as a subset so a cleaner rewrite still passes.
const EXCLUDED = ["a", "d", "e", "f", "h", "l", "sp", "a_", "f_", "b_", "c_", "d_", "e_", "h_", "l_"];

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── real dispatches ───────────────────────────────────────────────────────────────────────────

let capturedCache = null;
function captured() {
  if (capturedCache) return capturedCache;
  const entries = [];
  let collecting = true;
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (collecting && entries.length < 320) entries.push(mm.clone());
    return oracle(mm);
  }]]));
  const frames = m.runFrames(ENTRY_FRAMES);
  collecting = false;
  assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the run ran short");
  capturedCache = entries;
  return entries;
}

// ── the masked comparison ─────────────────────────────────────────────────────────────────────

// Oracle vs candidate on independent clones. The frozen side tails into a body that pushes below its
// seat and pops a return the rewrite never models, so [low, seat) is masked with low watched off the
// oracle's own pushes; anything outside it, or a register outside the ceiling, has escaped.
function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  const rO = oracle(a);
  let rC, threw = null;
  try { rC = cand(b); } catch (e) { threw = String(e).slice(0, 60); }
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (threw || da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    escaped = { addr, oracle: da[i], candidate: db[i] };
  }
  let reg = null;
  if (!threw) {
    for (const k of REG_FIELDS) {
      if (EXCLUDED.includes(k)) continue;
      if (a.regs[k] !== b.regs[k]) { reg = { k, a: a.regs[k], b: b.regs[k] }; break; }
    }
  }
  return { escaped, reg, threw, low, seat, spDiff: a.regs.sp - b.regs.sp, rO, rC };
}
const diverges = (cand, m) => { const r = compare(cand, m); return !!(r.escaped || r.reg || r.threw); };

// Cells the oracle moves at or below the data top from a state — a turn's footprint.
function footprint(machine) {
  const before = machine.dumpState().slice();
  const a = machine.clone();
  oracle(a);
  const now = a.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) {
    if (now[i] !== before[i] && a.stateOffsetToAddr(i) <= DATA_TOP) n++;
  }
  return n;
}

// ── crafted states ────────────────────────────────────────────────────────────────────────────

function craft(era, marks) {
  const m = captured()[0].clone();
  m.mem8[ERA_INDEX] = era;
  for (let i = 0; i < BANK_SLOTS; i++) m.mem8[RECORD_SEAT + i * RECORD_STRIDE] = marks[i];
  return m;
}

// Every three-slot marker pattern against the run-era and a skip-era.
function corpus() {
  const out = [];
  for (const era of [0, 4]) {
    for (const s0 of MARKERS) for (const s1 of MARKERS) for (const s2 of MARKERS) out.push(craft(era, [s0, s1, s2]));
  }
  return out;
}

// ── broken twins ──────────────────────────────────────────────────────────────────────────────

function twinBody({ era = true, ix = 0xa8c0, iy = 0xaa28, b = 3, guardEmpty = true, flyBallistic = true }) {
  return function body(m) {
    const { regs, mem8 } = m;
    if (era && mem8[ERA_INDEX] !== 0) return;
    regs.ix = ix; regs.iy = iy; regs.b = b;
    const marker = mem8[regs.ix];
    if (guardEmpty && marker === EMPTY) return loc_400b(m);
    if (marker !== BALLISTIC) return sweep(m);
    if (flyBallistic) fly(m);
    return loc_400b(m);
  };
}

// The control for EXCLUDED: scribbles a register the routine has no business touching.
function movesSpare(m) { const r = candidate(m); m.regs.c = (m.regs.c + 1) & 0xff; return r; }

const TWINS = [
  ["no-op", () => {}, 27],
  ["ignore-era", twinBody({ era: false }), 27],
  ["wrong-record-seat", twinBody({ ix: 0xa8d0 }), 27],
  ["wrong-sprite-seat", twinBody({ iy: 0xaa2a }), 27],
  ["wrong-count", twinBody({ b: 2 }), 27],
  ["empty-goes-sweep", twinBody({ guardEmpty: false }), 9],
  ["ballistic-skips-fly", twinBody({ flyBallistic: false }), 9],
];

function movedOver(cand, states) {
  const moved = new Set();
  for (const e of states) {
    const a = e.clone();
    const b = e.clone();
    oracle(a);
    try { cand(b); } catch { continue; }
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return moved;
}

// ── the gate ──────────────────────────────────────────────────────────────────────────────────

test("REAL: every coin-start dispatch replays identically, and some write", { skip }, () => {
  const entries = captured();
  assert.ok(entries.length > 0, "vacuous: the tape no longer reaches this address");
  for (const e of entries) {
    const r = compare(candidate, e);
    assert.equal(r.threw, null, r.threw && `the candidate threw: ${r.threw}`);
    assert.equal(r.escaped, null, r.escaped && `escaped the mask at ${hex4(r.escaped.addr)}`);
    assert.equal(r.reg, null, r.reg && `register ${r.reg.k} diverged: ${r.reg.a} vs ${r.reg.b}`);
  }
  const wrote = entries.filter((e) => footprint(e) > 0).length;
  assert.ok(wrote > 0, "no dispatch makes the oracle write, so this arm would pass a no-op");
  console.log(`  REAL: ${entries.length} dispatches identical, ${wrote} of them write`);
});

test("PATHS: the four branches each replay, and the branch really branches", { skip }, () => {
  const skipEra = craft(4, [EMPTY, EMPTY, EMPTY]);
  const empty = craft(0, [EMPTY, EMPTY, EMPTY]);
  const other = craft(0, [OTHER, EMPTY, EMPTY]);
  const ballistic = craft(0, [BALLISTIC, EMPTY, EMPTY]);
  for (const [name, m] of [["skipEra", skipEra], ["empty", empty], ["other", other], ["ballistic", ballistic]]) {
    const r = compare(candidate, m);
    assert.equal(r.escaped, null, `${name}: escaped at ${r.escaped && hex4(r.escaped.addr)}`);
    assert.equal(r.reg, null, `${name}: register ${r.reg && r.reg.k} diverged`);
  }
  // ★ Vacuity guard: the skip-era and all-empty paths write nothing while the two working paths do,
  // so a rewrite that ignored the era gate or the marker could not pass all four.
  assert.equal(footprint(skipEra), 0, "the skip-era path wrote something");
  assert.equal(footprint(empty), 0, "the all-empty bank wrote something");
  assert.ok(footprint(other) > 0 && footprint(ballistic) > 0, "a working path wrote nothing");
  console.log(`  PATHS: skip/empty write ${footprint(skipEra)}/${footprint(empty)}, working ` +
    `${footprint(other)}/${footprint(ballistic)}`);
});

test("CORPUS: three-slot occupancy x era all replay, and the sweep is not all no-ops", { skip }, () => {
  const states = corpus();
  for (const e of states) {
    const r = compare(candidate, e);
    assert.equal(r.escaped, null, `escaped at ${r.escaped && hex4(r.escaped.addr)}`);
    assert.equal(r.reg, null, `register ${r.reg && r.reg.k} diverged`);
  }
  const writing = states.filter((e) => footprint(e) > 0).length;
  assert.ok(writing > 0, "no crafted state makes the oracle write, so the sweep is decoration");
  console.log(`  CORPUS: ${states.length} states identical, ${writing} write`);
});

test("SP AND RETURN: +2 re-seat on every path, mask floor over the data, returns equal", { skip }, () => {
  for (const m of [craft(4, [EMPTY, EMPTY, EMPTY]), craft(0, [EMPTY, EMPTY, EMPTY]),
    craft(0, [OTHER, EMPTY, EMPTY]), craft(0, [BALLISTIC, EMPTY, EMPTY])]) {
    const r = compare(candidate, m);
    assert.equal(r.spDiff, 2, "the oracle no longer pops exactly one return the rewrite leaves");
    assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached into game data`);
    assert.equal(r.rO, r.rC, "the return value diverged");
  }
  console.log("  SP: +2 on every path; window over the data; returns identical");
});

test("EXCLUDED, measured: nothing moves outside the ceiling, with a control that does", { skip }, () => {
  const states = corpus();
  const moved = movedOver(candidate, states);
  const control = movedOver(movesSpare, states);
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !EXCLUDED.includes(k)),
    "the measurement reports nothing even for a twin that scribbles a register, so a clean reading " +
      "here proves nothing");
  const unexpected = REG_FIELDS.filter((k) => moved.has(k) && !EXCLUDED.includes(k));
  assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
  console.log(`  EXCLUDED: observed ${EXCLUDED.filter((k) => moved.has(k)).join(", ")}; control also ` +
    `moves ${REG_FIELDS.filter((k) => control.has(k) && !EXCLUDED.includes(k)).join(", ")}`);
});

test("TEETH CONTROL: the register-scribbling twin is caught on every crafted state", { skip }, () => {
  const states = corpus();
  const caught = states.filter((e) => diverges(movesSpare, e)).length;
  assert.equal(caught, states.length, "the control twin slipped a state");
  console.log(`  TEETH CONTROL: caught on ${caught}/${states.length}`);
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted states`, { skip }, () => {
    const states = corpus();
    const caught = states.filter((e) => diverges(twin, e)).length;
    assert.ok(caught > 0, `the ${label} twin is not caught at all`);
    assert.equal(caught, expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught}/${states.length}`);
  });
}
