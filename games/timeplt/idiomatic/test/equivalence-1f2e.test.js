// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1f2e — memory-equivalent to the frozen oracle at ROM 0x1F2E.
 * GATE: crafted live-ins over machines captured at the scroll pipeline this data table falls into.
 *   The whole 65536 A/B space is classified by path and the classifier is checked against the
 *   oracle's own footprint. Both fold-and-RET arms leave the machine identical, so a strict
 *   whole-machine diff holds there; the one surviving pair falls through the dissolved 0x1F3E tail
 *   and is compared with the parked continuation word masked, the tail's dead registers excluded,
 *   and the +2 SP drift asserted. Teeth below. Run:
 *   node --test games/timeplt/idiomatic/test/equivalence-1f2e.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_1f2e as candidate } from "../loc_1f2e.js";
import { loc_1f2e as oracle } from "../../translated/loc_1f2e.js";
import { loc_1f99 } from "../loc_1f99.js";
import { snapHeadingOntoTheTurnTarget } from "../snapHeadingOntoTheTurnTarget.js";
import { PLAYER_HEADING } from "../names.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const PIPELINE = 0x1f42;
const CAP = 40;
const SCRATCH_BYTES = 2;
const SP_DRIFT = 2;
const SENTINEL = 0x37;
const EXPECTED = { retnz: 65280, retpo: 255, call: 0, fall: 1 };
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

/** The dissolved tail's dead registers — a ceiling measured by EXCLUDED, not a demand. */
const MOVED = ["a", "f", "d", "e", "h", "l", "sp"];

// ── the fold, classified without running the routine ────────────────────────────────────────
const u8 = (v) => v & 0xff;
const overflows = (a, b) => { const s = u8(a + b); return ((~(a ^ b) & (a ^ s)) & 0x80) !== 0; };
function classify(a, b) {
  const s = u8(a + b);
  if (s !== 0) return "retnz";
  if (!overflows(a, b)) return "retpo";
  return u8(s & b) !== 0 ? "call" : "fall";
}

// ── captured states ─────────────────────────────────────────────────────────────────────────
let corpus = null;
function captured() {
  if (corpus) return corpus;
  const entries = [];
  const real = TRANSLATED.get(PIPELINE);
  const m = makeMachine(new Map([[PIPELINE, (mm) => {
    if (entries.length < CAP) { const c = mm.clone(); c.assets = {}; c.video = null; entries.push(c); }
    return real(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `capture run stopped early: ${m.stoppedBy}`);
  assert.ok(entries.length > 0, "vacuous: the pipeline was never dispatched, no state to craft onto");
  corpus = entries;
  return corpus;
}

function craft(base, a, b, heading = null) {
  const m = base.clone();
  m.regs.a = a;
  m.regs.b = b;
  if (heading !== null) m.mem8[PLAYER_HEADING] = heading;
  return m;
}

const inScratch = (addr, seat) => addr !== null && addr >= seat - SCRATCH_BYTES && addr < seat;

function firstOutside(a, b, seat) {
  const da = a.dumpState(), db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (inScratch(addr, seat)) continue;
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

// The RET arms dissolve cleanly, so hold the whole machine; the FALL arm dissolves a tail that
// drops registers and parks a return word, so mask that window and exclude the dead registers.
function strictDiff(fn, machine) {
  const a = machine.clone(), b = machine.clone();
  const ro = oracle(a);
  let rc;
  try { rc = fn(b); }
  catch (e) { if (e instanceof ReferenceError || e instanceof TypeError) throw e; return { where: "threw", got: String(e).slice(0, 50) }; }
  const mem = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  if (mem) return { where: hex4(mem.addr ?? 0), got: `${mem.a} vs ${mem.b}` };
  for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) return { where: `reg ${k}`, got: `${a.regs[k]} vs ${b.regs[k]}` };
  if (a.pc !== b.pc) return { where: "pc", got: `${a.pc} vs ${b.pc}` };
  if (ro !== rc) return { where: "ret", got: `${ro} vs ${rc}` };
  return null;
}

function maskedDiff(fn, machine) {
  const seat = machine.regs.sp;
  const a = machine.clone(), b = machine.clone();
  oracle(a);
  try { fn(b); }
  catch (e) { if (e instanceof ReferenceError || e instanceof TypeError) throw e; return { where: "threw", got: String(e).slice(0, 50) }; }
  const mem = firstOutside(a, b, seat);
  if (mem) return { where: hex4(mem.addr ?? 0), got: `${mem.a} vs ${mem.b}` };
  for (const k of REG_FIELDS) if (!MOVED.includes(k) && a.regs[k] !== b.regs[k]) return { where: `reg ${k}`, got: `${a.regs[k]} vs ${b.regs[k]}` };
  return null;
}

const diffFor = (fn, machine, a, b) => (classify(a, b) === "fall" ? maskedDiff : strictDiff)(fn, machine);

const A_GRID = [0, 1, 2, 0x3f, 0x40, 0x7f, 0x80, 0x81, 0xbf, 0xc0, 0xfe, 0xff];
function sweep(fn, bases) {
  let checked = 0, caught = 0, first = null;
  for (const base of bases) for (const a of A_GRID) for (let b = 0; b < 256; b++) {
    const d = diffFor(fn, craft(base, a, b), a, b);
    checked++;
    if (d) { caught++; if (!first) first = { a, b, path: classify(a, b), ...d }; }
  }
  return { checked, caught, first };
}

function fallCatches(fn) {
  let n = 0;
  for (const base of captured()) if (maskedDiff(fn, craft(base, 0x80, 0x80, SENTINEL))) n++;
  return n;
}

// ── broken twins ────────────────────────────────────────────────────────────────────────────
function brokenNoOp() {}
function brokenInvertFirstRet(m) {
  const { regs } = m;
  regs.add(regs.b);
  if (regs.fZ) return m.ret();
  if (regs.fPO) return m.ret();
  regs.and(regs.b);
  if (regs.fNZ) return loc_1f99(m);
  return snapHeadingOntoTheTurnTarget(m);
}
function brokenSkipFirstRet(m) {
  const { regs } = m;
  regs.add(regs.b);
  if (regs.fPO) return m.ret();
  regs.and(regs.b);
  if (regs.fNZ) return loc_1f99(m);
  return snapHeadingOntoTheTurnTarget(m);
}
function brokenWrongFallCallee(m) {
  const { regs } = m;
  regs.add(regs.b);
  if (regs.fNZ) return m.ret();
  if (regs.fPO) return m.ret();
  regs.and(regs.b);
  return loc_1f99(m);
}
function brokenFallNoScroll(m) {
  const { regs } = m;
  regs.add(regs.b);
  if (regs.fNZ) return m.ret();
  if (regs.fPO) return m.ret();
  regs.and(regs.b);
  if (regs.fNZ) return loc_1f99(m);
  m.mem8[PLAYER_HEADING] = regs.b;
}
function brokenMovesIndex(m) { candidate(m); m.regs.ix = (m.regs.ix + 1) & 0xffff; }

const TWINS = [
  ["no-op", brokenNoOp],
  ["invert-first-ret", brokenInvertFirstRet],
  ["skip-first-ret", brokenSkipFirstRet],
  ["wrong-fall-callee", brokenWrongFallCallee],
  ["fall-no-scroll", brokenFallNoScroll],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("LIVE-IN SPACE: all 65536 A/B classified — the churn arm is dead, one pair falls through", { skip }, () => {
  const tally = { retnz: 0, retpo: 0, call: 0, fall: 0 };
  for (let a = 0; a < 256; a++) for (let b = 0; b < 256; b++) tally[classify(a, b)]++;
  assert.deepEqual(tally, EXPECTED, "the live-in space no longer splits as the routine's fold does");
  console.log(`  LIVE-IN SPACE: ${JSON.stringify(tally)}`);
});

test("PATHS: the classifier matches the oracle's own footprint and SP move", { skip }, () => {
  const base = captured()[0];
  const seat = base.regs.sp;
  let ret = 0, fall = 0;
  for (const a of A_GRID) for (let b = 0; b < 256; b++) {
    const before = craft(base, a, b);
    const after = before.clone();
    oracle(after);
    const wrote = firstOutside(before, after, seat) !== null;
    assert.equal((after.regs.sp - seat) & 0xffff, SP_DRIFT, `${hex4(a)}/${hex4(b)}: net SP move is not ${SP_DRIFT}`);
    if (classify(a, b).startsWith("ret")) { assert.ok(!wrote, `${hex4(a)}/${hex4(b)}: a RET path wrote memory`); ret++; }
    else { assert.ok(wrote, `${hex4(a)}/${hex4(b)}: the fall path wrote nothing`); fall++; }
  }
  assert.ok(ret > 0 && fall > 0, "the grid missed a whole class of path");
  console.log(`  PATHS: ${ret} RET dispatches wrote nothing, ${fall} fall dispatches wrote outside the window`);
});

test("EQUIVALENCE: candidate == oracle across the swept live-ins and every capture", { skip }, () => {
  const r = sweep(candidate, captured().slice(0, 8));
  assert.equal(r.caught, 0, r.first && `${hex4(r.first.a)}/${hex4(r.first.b)} (${r.first.path}) ${r.first.where}: ${r.first.got}`);
  console.log(`  EQUIVALENCE: ${r.checked} crafted dispatches identical`);
});

test("EXHAUSTIVE: candidate == oracle over all 65536 live-ins on one capture", { skip }, () => {
  const base = captured()[0];
  let caught = 0, first = null;
  for (let a = 0; a < 256; a++) for (let b = 0; b < 256; b++) {
    const d = diffFor(candidate, craft(base, a, b), a, b);
    if (d) { caught++; if (!first) first = { a, b, ...d }; }
  }
  assert.equal(caught, 0, first && `${hex4(first.a)}/${hex4(first.b)} ${first.where}: ${first.got}`);
  console.log("  EXHAUSTIVE: 65536 live-ins identical");
});

test("FALL-THROUGH: the dissolved tail is memory-equivalent, SP drifts by two", { skip }, () => {
  let n = 0;
  for (const base of captured()) {
    const m = craft(base, 0x80, 0x80);
    const seat = m.regs.sp;
    assert.equal(maskedDiff(candidate, m), null, "a captured fall dispatch diverged");
    const a = m.clone(); oracle(a);
    const b = m.clone(); candidate(b);
    assert.equal((a.regs.sp - seat) & 0xffff, SP_DRIFT, "the oracle's SP drift moved");
    assert.equal((b.regs.sp - seat) & 0xffff, 0, "the rewrite popped a slot it should leave to the seam");
    n++;
  }
  console.log(`  FALL-THROUGH: ${n} captures equivalent, oracle SP +${SP_DRIFT} / rewrite +0`);
});

test("WINDOW: the oracle parks exactly the masked width below its seat", { skip }, () => {
  let deepest = 0;
  for (const base of captured()) {
    const m = craft(base, 0x80, 0x80);
    const seat = m.regs.sp;
    let low = seat;
    const c = m.clone();
    const push = c.push16.bind(c);
    c.push16 = (v) => { const r = push(v); if (c.regs.sp < low) low = c.regs.sp; return r; };
    oracle(c);
    deepest = Math.max(deepest, (seat - low) & 0xffff);
  }
  assert.equal(deepest, SCRATCH_BYTES, "the oracle's stack footprint moved; the mask is the wrong width");
  console.log(`  WINDOW: the oracle reaches ${deepest} bytes below its seat`);
});

test("BOUNDARY: the mask hides its window and nothing adjacent", { skip }, () => {
  const m = craft(captured()[0], 0x80, 0x80);
  const seat = m.regs.sp;
  const scribble = (off) => (mm) => { candidate(mm); mm.mem8[(seat + off) & 0xffff] ^= 0xff; };
  assert.equal(maskedDiff(scribble(-1), m), null, "a byte inside the window is not masked");
  assert.notEqual(maskedDiff(scribble(-SCRATCH_BYTES - 1), m), null, "a byte below the window is masked too");
  console.log(`  BOUNDARY: ${hex4(seat - 1)} masked, ${hex4(seat - SCRATCH_BYTES - 1)} caught`);
});

test("EXCLUDED: no register outside the ceiling moves, with a control twin", { skip }, () => {
  const movedOver = (fn) => {
    const moved = new Set();
    for (const base of captured()) {
      const a = craft(base, 0x80, 0x80), b = a.clone();
      oracle(a);
      try { fn(b); } catch { continue; }
      for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
    }
    return moved;
  };
  const moved = movedOver(candidate);
  const control = movedOver(brokenMovesIndex);
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !MOVED.includes(k)),
    "the measurement reports nothing outside the ceiling even for a twin that scribbles an index register");
  assert.deepEqual(REG_FIELDS.filter((k) => moved.has(k) && !MOVED.includes(k)), [],
    "a register diverged outside the excluded set");
  console.log(`  EXCLUDED: moves ${REG_FIELDS.filter((k) => moved.has(k)).join(", ")}; ceiling ${MOVED.join(", ")}`);
});

test("NOT VACUOUS: the snap's write is observable and a no-op FAILS on a real cell", { skip }, () => {
  const m = craft(captured()[0], 0x80, 0x80, SENTINEL);
  const a = m.clone(); oracle(a);
  assert.equal(a.mem8[PLAYER_HEADING], 0x80, "the fall path no longer writes the heading");
  const d = maskedDiff(brokenNoOp, m);
  assert.notEqual(d, null, "the masked comparison passed a candidate that does nothing");
  assert.notEqual(d.where, "threw", "the no-op must be caught on a real cell, not an exception");
  console.log(`  NOT VACUOUS: heading ${hex4(SENTINEL)} -> ${hex4(0x80)}; no-op caught at ${d.where}`);
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const onGrid = sweep(twin, captured().slice(0, 4)).caught;
    const onFall = fallCatches(twin);
    assert.ok(onGrid + onFall > 0, `both sweeps PASSED the ${label} twin`);
    console.log(`  TEETH/${label}: ${onGrid} grid dispatches, ${onFall}/${captured().length} fall captures`);
  });
}
