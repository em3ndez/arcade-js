// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_37d6 — memory-equivalent to the frozen oracle at ROM 0x37D6. A pure leaf: every ROM call is
 * dissolved into a direct import, so the rewrite pushes no return addresses and omits its own ret.
 * GATE: the whole recursive pass replayed on each side (the loop re-enters this address), RAM
 * compared with the dead stack scratch below the seated SP masked out, the +2 SP re-seat and the
 * return checked, and registers held to a measured ceiling {a,d,e,f,sp,alt-set} no caller reads.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-37d6.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_37d6 as candidate } from "../loc_37d6.js";
import { loc_37d6 as oracle } from "../../translated/loc_37d6.js";
import { drawRandomByte } from "../drawRandomByte.js";
import { fetchTableByte } from "../fetchTableByte.js";
import { pickScriptAtRandomOrInTurn } from "../pickScriptAtRandomOrInTurn.js";
import { stepShapeAnimation } from "../stepShapeAnimation.js";
import { u8, u16 } from "../../../../core/int.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x37d6;
const SCROLL_ANGLE = 0xa802;
const HEADING_TABLE = 0x39fb;
const VELOCITY_TABLE = 0x3a3b;
const SHARED_ZERO = 0xacc5;
const BANK_TOP = 0xa8b0;
const RECORD_STRIDE = 0x10;
const BANK_SLOTS = 5;

// Every game write lands at or below here; the stack seats far above it, so masking the scratch
// window can never hide a data divergence. Asserted against the measured floor below.
const DATA_TOP = 0xadff;
const COIN_TURNS = 40;
const ATTRACT_TURNS = 24;

// The measured ceiling: the callers tail-call and read no register, and the dissolved generator
// leaves the accumulator, d/e and the alternate set where the frozen swap does not. Checked as a
// subset, so a rewrite that diverges on fewer still passes.
const EXCLUDED = ["a", "d", "e", "f", "sp", "a_", "f_", "b_", "c_", "d_", "e_", "h_", "l_"];

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── whole-pass wiring ───────────────────────────────────────────────────────────────────────

// ★ The loop re-enters this address every turn, so a comparison that ran the rewrite only at the
// top would run the frozen twin for turns two onward. dispatchBody makes the loop's own re-entries
// run whichever side is under way, so the whole pass is on one implementation.
let dispatchBody = oracle;
function runAs(body, m) {
  dispatchBody = body;
  try {
    return body(m);
  } finally {
    dispatchBody = oracle;
  }
}

function captureTape(opts) {
  let collecting = true;
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (collecting) entries.push(mm.clone());
    return dispatchBody(mm);
  }]]), opts);
  const frames = m.runFrames(ENTRY_FRAMES);
  collecting = false;
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the capture run ran short");
  return entries;
}

let corpusCache = null;
function corpus() {
  if (!corpusCache) corpusCache = [...captureTape({}), ...captureTape({ tape: [] })];
  return corpusCache;
}

/**
 * Oracle vs candidate on independent clones. The oracle pushes a return address per delegated call
 * and rets its own, all popped again; the rewrite models no stack. So the diff excludes [low, seat)
 * — low measured by watching the oracle's own pushes — and anything outside it has escaped.
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
  const retOracle = runAs(oracle, a);
  const retCand = runAs(cand, b);
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    escaped = { addr, oracle: da[i], candidate: db[i] };
  }
  let reg = null;
  for (const k of REG_FIELDS) {
    if (EXCLUDED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) { reg = { k, a: a.regs[k], b: b.regs[k] }; break; }
  }
  return { escaped, reg, low, seat, spDiff: a.regs.sp - b.regs.sp, retOracle, retCand };
}

/** Cells the oracle moves from a state, ignoring the stack scratch — a turn's footprint. */
function footprint(machine) {
  const before = machine.dumpState().slice();
  const a = machine.clone();
  runAs(oracle, a);
  const now = a.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) {
    if (now[i] !== before[i] && a.stateOffsetToAddr(i) <= DATA_TOP) n++;
  }
  return n;
}

function firstFree() {
  const e = corpus().find((m) => m.mem8[m.regs.ix & 0xffff] === 0);
  assert.notEqual(e ?? null, null, "vacuous: no captured turn found a free slot");
  return e;
}

/** A turn seated on a bank whose every reachable head is busy, so no slot is filled. */
function craftAllBusy() {
  const m = firstFree().clone();
  m.regs.ix = BANK_TOP;
  m.regs.b = BANK_SLOTS;
  for (let i = 0; i < BANK_SLOTS; i++) m.mem8[BANK_TOP - i * RECORD_STRIDE] = 0xff;
  return m;
}

// ── broken twins ────────────────────────────────────────────────────────────────────────────

/**
 * The rewrite with one deliberate defect each; every parameter matches loc_37d6 by default. On the
 * occupied-slot path it walks the pass with ITSELF rather than delegating: the real close tail now
 * imports the concrete generator, so calling it would run the correct body on every turn but the
 * first and hide the defect on all of them. Stepping and re-entering `body` keeps the whole pass on
 * the twin, which is what the loop does for the oracle through its own dispatch.
 */
function twin({ noop = false, claim = 0xff, facingBias = 0x80, jitterBias = 0x08, animate = true }) {
  return function body(m, record = m.regs.ix, entry = m.regs.iy) {
    if (noop) return;
    const { regs, mem8 } = m;
    if (mem8[record + 0x00] !== 0) {
      regs.ix = regs.ix - RECORD_STRIDE;
      regs.iy = regs.iy - 2;
      regs.b = regs.b - 1;
      return regs.b !== 0 ? body(m) : undefined;
    }
    mem8[record + 0x00] = claim;
    const base = mem8[SCROLL_ANGLE] >> 2;
    const jitter = (drawRandomByte(m) & 0x0f) - jitterBias;
    regs.a = (base + jitter) & 0x3f;
    regs.hl = HEADING_TABLE;
    regs.a = u8(fetchTableByte(m) * 4);
    regs.hl = VELOCITY_TABLE;
    mem8[entry + 0x31] = fetchTableByte(m);
    regs.hl = u16(regs.hl + 1);
    regs.a = mem8[regs.hl];
    mem8[entry + 0x00] = regs.a;
    regs.a = u8(mem8[SCROLL_ANGLE] + facingBias);
    mem8[record + 0x01] = regs.a;
    mem8[record + 0x02] = regs.a;
    mem8[record + 0x0a] = pickScriptAtRandomOrInTurn(m);
    regs.a = 0;
    mem8[SHARED_ZERO] = regs.a;
    mem8[record + 0x03] = 0x00;
    mem8[record + 0x05] = 0x00;
    mem8[record + 0x09] = 0x20;
    if (animate) stepShapeAnimation(m, record);
    mem8[record + 0x0e] = 0x00;
  };
}

/** BUG: scribbles a register outside the ceiling; the control for EXCLUDED. */
function brokenMovesCursor(m) {
  const r = candidate(m);
  m.regs.iy = (m.regs.iy + 1) & 0xffff;
  return r;
}

const TWINS = [
  ["no-op", twin({ noop: true }), 64],
  ["wrong-claim", twin({ claim: 0xfe }), 44],
  ["wrong-facing", twin({ facingBias: 0x81 }), 44],
  ["skip-animation", twin({ animate: false }), 44],
  ["wrong-jitter", twin({ jitterBias: 0x07 }), 44],
];

function sweepCorpus(cand) {
  let caught = 0;
  for (const e of corpus()) if (compare(cand, e).escaped || compare(cand, e).reg) caught++;
  return caught;
}

function movedOver(cand) {
  const moved = new Set();
  for (const e of corpus()) {
    const a = e.clone();
    const b = e.clone();
    runAs(oracle, a);
    try {
      runAs(cand, b);
    } catch {
      continue;
    }
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return moved;
}

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: RAM identical outside the masked stack scratch", { skip }, () => {
  const r = compare(candidate, firstFree());
  assert.equal(r.escaped, null, r.escaped && `escaped the mask at ${hex4(r.escaped.addr)}`);
  assert.equal(r.reg, null, r.reg && `register ${r.reg.k} diverged: ${r.reg.a} vs ${r.reg.b}`);
  // ★ The mask is safe only if it never covers a data cell: prove its floor sits above them all.
  assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached down into game data`);
  console.log(`  EQUAL: window [${hex4(r.low)},${hex4(r.seat)}) masked, spDiff ${r.spDiff}`);
});

test("CORPUS: every turn of both tapes replays identically, and the corpus is not all no-ops",
  { skip }, () => {
    for (const e of corpus()) {
      const r = compare(candidate, e);
      assert.equal(r.escaped, null, `${hex4(e.regs.ix)}: escaped at ${r.escaped && hex4(r.escaped.addr)}`);
      assert.equal(r.reg, null, `${hex4(e.regs.ix)}: register ${r.reg && r.reg.k} diverged`);
    }
    const writing = corpus().filter((e) => footprint(e) > 0).length;
    assert.ok(writing > 0, "no captured turn makes the oracle write a byte, so the corpus is all " +
      "no-ops and every arm over it would pass a rewrite that did nothing");
    assert.equal(captureTape({}).length, COIN_TURNS, "the coin-start turn count moved");
    assert.equal(captureTape({ tape: [] }).length, ATTRACT_TURNS, "the attract turn count moved");
    console.log(`  CORPUS: ${corpus().length} turns identical, ${writing} of them make the oracle write`);
  });

test("PATHS: a claimed slot and an all-busy bank move different amounts", { skip }, () => {
  const free = footprint(firstFree());
  const allBusy = footprint(craftAllBusy());
  // ★ Vacuity guard: the claim path writes and the exhausted-bank path does not, or a rewrite that
  // ignored the branch would pass.
  assert.ok(free > 0, "the free-slot path wrote nothing");
  assert.equal(allBusy, 0, "the all-busy bank wrote something, so the branch is not what it seems");
  const r = compare(candidate, craftAllBusy());
  assert.equal(r.escaped, null, "the all-busy pass diverged");
  assert.equal(r.reg, null, "the all-busy pass diverged on a register");
  console.log(`  PATHS: free moves ${free} cells, all-busy ${allBusy}`);
});

test("SP and RETURN: the oracle re-seats two bytes higher and both return the same", { skip }, () => {
  for (const e of [firstFree(), craftAllBusy()]) {
    const r = compare(candidate, e);
    assert.equal(r.spDiff, 2, "the oracle pops a return the rewrite does not");
    assert.equal(r.retOracle, r.retCand, "the return value diverged");
  }
  console.log("  SP: +2 on every path; return values identical");
});

test("EXCLUDED, measured: nothing moves outside the ceiling, with a control that does", { skip }, () => {
  const moved = movedOver(candidate);
  const control = movedOver(brokenMovesCursor);
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !EXCLUDED.includes(k)),
    "the measurement reports nothing even for a twin that scribbles a cursor, so a clean reading " +
      "here proves nothing");
  const unexpected = REG_FIELDS.filter((k) => moved.has(k) && !EXCLUDED.includes(k));
  assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
  console.log(`  EXCLUDED: observed moving ${EXCLUDED.filter((k) => moved.has(k)).join(", ")}; ` +
    `control also moves ${REG_FIELDS.filter((k) => control.has(k) && !EXCLUDED.includes(k)).join(", ")}`);
});

for (const [label, brokenTwin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of turns`, { skip }, () => {
    const caught = sweepCorpus(brokenTwin);
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    assert.equal(caught, expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${corpus().length} turns`);
  });
}
