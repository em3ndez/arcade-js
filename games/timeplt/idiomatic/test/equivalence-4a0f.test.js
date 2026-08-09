// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_4a0f — memory-equivalent to the frozen oracle at ROM 0x4A0F. A pure leaf: fillCellRun,
 * setSavedPenFromEra and advanceSequenceSubStep are dissolved into direct imports, so the rewrite
 * pushes no return address and omits the tail ret. No tape reaches this address, so the gate is a
 * crafted sweep of the base colour and the saved-pen player selector; RAM is compared with the dead
 * stack scratch masked out, the +2 SP re-seat and the undefined return checked, and registers held
 * to a measured ceiling no caller reads. Run: node --test .../equivalence-4a0f.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_4a0f as candidate } from "../loc_4a0f.js";
import { loc_4a0f as oracle } from "../../translated/loc_4a0f.js";
import { u8 } from "../../../../core/int.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x4a0f;
const SEQUENCE_DISPATCHER = 0x0f1f; // a hot address, the positive control for "never reached"

const BASE_COLOUR = 0xad0c;
const BASE_NEIGHBOUR = 0xad0d;
const ACTIVE_PLAYER = 0xad32;
const ROUND_P1 = 0xad14;
const ROUND_P2 = 0xad24;
const PEN_P1 = 0xad1b;
const PEN_P2 = 0xad2b;

const SUBSTEP = 0xa9ac;
const POINTER_LO = 0xa9f7;
const ATTR_LAST = 0xa40c;
const DATA_TOP = 0xadff;
const BASE_FRAMES = 600;
const EXCLUDED = ["f", "b", "c", "d", "e", "h", "l", "sp"];
const SWEEP = 2 * 256;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

let baseCache = null;
function base() {
  if (!baseCache) {
    const m = makeMachine();
    const frames = m.runFrames(BASE_FRAMES);
    assert.equal(m.stoppedBy, null, `the base run stopped early: ${m.stoppedBy}`);
    assert.equal(frames.length, BASE_FRAMES, "the base run ran short");
    baseCache = m;
  }
  return baseCache;
}

function craft(baseColour, activePlayer) {
  const m = base().clone();
  m.mem8[BASE_COLOUR] = baseColour;
  m.mem8[BASE_NEIGHBOUR] = 0x00;
  m.mem8[ACTIVE_PLAYER] = activePlayer;
  m.mem8[ROUND_P1] = 0x07;
  m.mem8[ROUND_P2] = 0x0b;
  m.mem8[PEN_P1] = 0; m.mem8[PEN_P1 + 1] = 0;
  m.mem8[PEN_P2] = 0; m.mem8[PEN_P2 + 1] = 0;
  return m;
}

let corpusCache = null;
function corpus() {
  if (!corpusCache) {
    corpusCache = [];
    for (const ap of [0x00, 0xff]) for (let bc = 0; bc < 256; bc++) corpusCache.push(craft(bc, ap));
  }
  return corpusCache;
}

// Oracle vs candidate on independent clones. The oracle pushes a return per delegated call and rets
// its own tail; the rewrite models no stack, so [low, seat) — low watched off the oracle's pushes —
// is masked, and anything outside it has escaped.
function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  const retOracle = oracle(a);
  const retCand = cand(b);
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

/** Data cells the oracle moves from a state, ignoring the stack scratch above DATA_TOP. */
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

function sweep(cand) {
  let caught = 0;
  for (const e of corpus()) { const r = compare(cand, e); if (r.escaped || r.reg) caught++; }
  return caught;
}

function movedOver(cand) {
  const moved = new Set();
  for (const e of corpus()) {
    const a = e.clone();
    const b = e.clone();
    oracle(a);
    try { cand(b); } catch { continue; }
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return moved;
}

// ── broken twins ──────────────────────────────────────────────────────────────────────────────

function brokenNoOp() {}

function brokenWrongBaseCell(m) {
  const saved = m.mem8[BASE_COLOUR];
  m.mem8[BASE_COLOUR] = m.mem8[BASE_NEIGHBOUR];
  candidate(m);
  m.mem8[BASE_COLOUR] = saved;
}

function brokenShortAttrRun(m) {
  candidate(m);
  m.mem8[ATTR_LAST] = u8(m.mem8[ATTR_LAST] + 1);
}

function brokenWrongPointer(m) {
  candidate(m);
  m.mem8[POINTER_LO] = u8(m.mem8[POINTER_LO] ^ 0xff);
}

function brokenNoSubStep(m) {
  const held = m.mem8[SUBSTEP];
  candidate(m);
  m.mem8[SUBSTEP] = held;
}

function brokenNoSavedPen(m) {
  const held = [m.mem8[PEN_P1], m.mem8[PEN_P1 + 1], m.mem8[PEN_P2], m.mem8[PEN_P2 + 1]];
  candidate(m);
  m.mem8[PEN_P1] = held[0]; m.mem8[PEN_P1 + 1] = held[1];
  m.mem8[PEN_P2] = held[2]; m.mem8[PEN_P2 + 1] = held[3];
}

/** BUG: scribbles the accumulator, outside the ceiling; the control for EXCLUDED. */
function brokenMovesA(m) {
  const r = candidate(m);
  m.regs.a = u8(m.regs.a + 1);
  return r;
}

const TWINS = [
  ["no-op", brokenNoOp, SWEEP],
  ["wrong-base-cell", brokenWrongBaseCell, SWEEP - 2],
  ["short-attr-run", brokenShortAttrRun, SWEEP],
  ["wrong-pointer", brokenWrongPointer, SWEEP],
  ["no-sub-step", brokenNoSubStep, SWEEP],
  ["no-saved-pen", brokenNoSavedPen, SWEEP],
];

// ── the gate ──────────────────────────────────────────────────────────────────────────────────

test("UNREACHED: no tape dispatches this address, with a hot control that fires", { skip }, () => {
  const seen = { [TARGET]: 0, [SEQUENCE_DISPATCHER]: 0 };
  const real = makeMachine().routines.get(SEQUENCE_DISPATCHER);
  const m = makeMachine(new Map([
    [TARGET, (mm) => (seen[TARGET]++, oracle(mm))],
    [SEQUENCE_DISPATCHER, (mm) => (seen[SEQUENCE_DISPATCHER]++, real(mm))],
  ]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the tape run stopped early: ${m.stoppedBy}`);
  assert.ok(seen[SEQUENCE_DISPATCHER] > 0, "the control never fired, so the zero beside it is blind");
  assert.equal(seen[TARGET], 0, "the tape now reaches this address, so the crafted gate is stale");
  console.log(`  UNREACHED: ${hex4(TARGET)} entered ${seen[TARGET]}, control ${seen[SEQUENCE_DISPATCHER]}`);
});

test("EQUIVALENCE: the crafted sweep is identical outside the masked stack scratch", { skip }, () => {
  assert.equal(sweep(candidate), 0, "the rewrite diverged somewhere in the crafted sweep");
  // ★ the mask is safe only if its floor never reaches a data cell; prove it sits above them all.
  const r = compare(candidate, corpus()[0]);
  assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached down into game data`);
  const feet = corpus().map(footprint);
  assert.ok(Math.min(...feet) > 0, "a craft makes the oracle write nothing, so the sweep is vacuous");
  console.log(`  EQUIVALENCE: ${SWEEP} crafts identical; footprint ${Math.min(...feet)}..${Math.max(...feet)} cells`);
});

test("SP and RETURN: the oracle re-seats two bytes higher and both return undefined", { skip }, () => {
  for (const e of [corpus()[0], corpus()[SWEEP - 1]]) {
    const r = compare(candidate, e);
    assert.equal(r.spDiff, 2, "the oracle no longer pops a return the rewrite leaves");
    assert.equal(r.retOracle, undefined, "the oracle no longer returns undefined");
    assert.equal(r.retCand, r.retOracle, "the return value diverged");
  }
  console.log("  SP: +2 on every craft; both sides return undefined");
});

test("EXCLUDED, measured: nothing moves outside the ceiling, with a control that does", { skip }, () => {
  const moved = movedOver(candidate);
  const control = movedOver(brokenMovesA);
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !EXCLUDED.includes(k)),
    "the measurement reports nothing even for a twin that scribbles the accumulator");
  const unexpected = REG_FIELDS.filter((k) => moved.has(k) && !EXCLUDED.includes(k));
  assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
  console.log(`  EXCLUDED: moving ${EXCLUDED.filter((k) => moved.has(k)).join(", ")}; ` +
    `control also moves ${REG_FIELDS.filter((k) => control.has(k) && !EXCLUDED.includes(k)).join(", ")}`);
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafts`, { skip }, () => {
    const caught = sweep(twin);
    assert.ok(caught > 0, `the ${label} twin is not caught at all`);
    assert.equal(caught, expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${SWEEP} crafts`);
  });
}
