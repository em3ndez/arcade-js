// SPDX-License-Identifier: GPL-3.0-only
/**
 * fileScoreIntoHighScoreTable — high-score insertion, reached only at game over so neither tape dispatches it. Entries
 * are CRAFTED: a real machine's RAM with a seated descending board and a candidate score. Oracle vs
 * rewrite on independent clones, RAM diffed outside the masked stack scratch, carry (the live-out)
 * pinned, registers held to a measured {sp,f,c} ceiling. Run: node --test this file.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { fileScoreIntoHighScoreTable as candidate } from "../fileScoreIntoHighScoreTable.js";
import { loc_4cc3 as oracle } from "../../translated/loc_4cc3.js";
import { REG_FIELDS, F_C } from "../../../../core/cpu/z80.js";

const ACTIVE_PLAYER = 0xad32;
const P1_SCORE = 0xad35;
const P2_SCORE = 0xad38;
const BOARD_SCORE = 0xab0b;
const RANK_COLUMN = 0xab08;
const SLOT_PTR = 0xa991;
const RECORD_STRIDE = 8;
const RECORD_COUNT = 5;
const BASE_FRAME = 900;

// Every game write is at or below here; the stack seats above it, so masking the scratch window
// can never hide a data divergence. Proved against the measured floor in the EQUAL arm.
const DATA_TOP = 0xadff;

// Measured ceiling: the rewrite omits its own ret (sp), and on the dropped-score path the shared
// compare leaves f and c where the frozen one does not. Carry, the live-out, is checked on its own.
const EXCLUDED = ["sp", "f", "c"];

// The ROM-default board, descending packed decimal.
const BOARD = [10000, 8800, 8460, 6520, 4300];

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

let baseCache = null;
function base() {
  if (!baseCache) {
    baseCache = makeMachine();
    baseCache.runFrames(BASE_FRAME);
  }
  return baseCache;
}

function bcd(n) {
  const s = n.toString().padStart(6, "0");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

function seat(m, ptr, score) {
  const [msb, mid, lsb] = bcd(score);
  m.mem8[ptr] = msb;
  m.mem8[(ptr - 1) & 0xffff] = mid;
  m.mem8[(ptr - 2) & 0xffff] = lsb;
}

function craft({ player = 0, score }) {
  const m = base().clone();
  m.mem8[ACTIVE_PLAYER] = player;
  for (let r = 0; r < RECORD_COUNT; r++) seat(m, BOARD_SCORE + r * RECORD_STRIDE, BOARD[r]);
  seat(m, player ? P2_SCORE : P1_SCORE, score);
  return m;
}

// [label, input, filed?]
const SCENARIOS = [
  ["insert-top", { score: 12000 }, true],
  ["insert-2nd", { score: 9000 }, true],
  ["insert-3rd", { score: 8500 }, true],
  ["insert-4th", { score: 7000 }, true],
  ["insert-last", { score: 5700 }, true],
  ["equal-top", { score: 10000 }, true],
  ["equal-last", { score: 4300 }, true],
  ["player-two", { player: 1, score: 8500 }, true],
  ["dropped", { score: 3000 }, false],
];
const INSERTS = SCENARIOS.filter(([, , filed]) => filed);

function compare(cand, m) {
  const a = m.clone();
  const b = m.clone();
  const seatSp = a.regs.sp;
  let low = seatSp;
  const push = a.push16.bind(a);
  a.push16 = (v) => {
    push(v);
    if (a.regs.sp < low) low = a.regs.sp;
  };
  oracle(a);
  try {
    cand(b);
  } catch (e) {
    return { escaped: { addr: null }, reg: null, carryOk: false, threw: String(e).slice(0, 40) };
  }
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seatSp) continue;
    escaped = { addr, oracle: da[i], candidate: db[i] };
  }
  let reg = null;
  for (const k of REG_FIELDS) {
    if (EXCLUDED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) { reg = { k, a: a.regs[k], b: b.regs[k] }; break; }
  }
  const carryOk = (a.regs.f & F_C) === (b.regs.f & F_C);
  return { escaped, reg, carryOk, low, seat: seatSp, spDiff: a.regs.sp - b.regs.sp };
}

function footprint(m) {
  const before = m.dumpState().slice();
  const a = m.clone();
  oracle(a);
  const now = a.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) {
    if (now[i] !== before[i] && a.stateOffsetToAddr(i) <= DATA_TOP) n++;
  }
  return n;
}

// ── broken twins ────────────────────────────────────────────────────────────────────────────

/** BUG: files nothing, so an insert's whole footprint is missing. */
function brokenNoOp() {}

/** BUG: corrupts a blanked name cell of the freed slot. */
function brokenWrongSentinel(m) {
  candidate(m);
  const slot = m.mem.read16(SLOT_PTR);
  m.mem8[slot] ^= 0xff;
}

/** BUG: renumbers the rank column 1..5 instead of 0..4. */
function brokenWrongRank(m) {
  candidate(m);
  for (let r = 0; r < RECORD_COUNT; r++) m.mem8[RANK_COLUMN + r * RECORD_STRIDE] = r + 1;
}

/** BUG: scribbles a register outside the ceiling; the control for EXCLUDED. */
function brokenMovesRegister(m) {
  candidate(m);
  m.regs.b = (m.regs.b + 1) & 0xff;
}

function caughtInMemory(cand) {
  return INSERTS.filter(([, input]) => compare(cand, craft(input)).escaped !== null).length;
}

function movedOver(cand) {
  const moved = new Set();
  for (const [, input] of SCENARIOS) {
    const m = craft(input);
    const a = m.clone();
    const b = m.clone();
    oracle(a);
    try {
      cand(b);
    } catch {
      continue;
    }
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return moved;
}

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("EQUAL: every crafted scenario is RAM-identical, carry matches, sp re-seats by two", { skip }, () => {
  for (const [label, input] of SCENARIOS) {
    const r = compare(candidate, craft(input));
    assert.equal(r.escaped, null, `${label}: escaped at ${r.escaped && hex4(r.escaped.addr)}`);
    assert.equal(r.reg, null, `${label}: register ${r.reg && r.reg.k} diverged`);
    assert.ok(r.carryOk, `${label}: the carry live-out diverged`);
    assert.equal(r.spDiff, 2, `${label}: the frozen ret no longer re-seats two bytes`);
    // ★ The mask is safe only if it never covers a data cell.
    assert.ok(r.low > DATA_TOP, `${label}: the stack window ${hex4(r.low)} reached into game data`);
  }
  console.log(`  EQUAL: ${SCENARIOS.length} scenarios identical, spDiff 2, mask floor above data`);
});

test("PATHS: an insert writes the board, a dropped score writes nothing", { skip }, () => {
  for (const [label, input] of INSERTS) {
    assert.ok(footprint(craft(input)) > 0, `${label}: the insert path wrote nothing`);
  }
  const dropped = SCENARIOS.find(([, , filed]) => !filed);
  assert.equal(footprint(craft(dropped[1])), 0, "the dropped-score path wrote to game data");
  console.log(`  PATHS: ${INSERTS.length} inserts write, the dropped score writes 0`);
});

test("EXCLUDED, measured: nothing moves outside the ceiling, with a control that does", { skip }, () => {
  const moved = movedOver(candidate);
  const control = movedOver(brokenMovesRegister);
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !EXCLUDED.includes(k)),
    "the measurement reports nothing even for a twin that scribbles a register, so a clean reading " +
      "here proves nothing");
  const unexpected = REG_FIELDS.filter((k) => moved.has(k) && !EXCLUDED.includes(k));
  assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
  console.log(`  EXCLUDED: observed moving ${EXCLUDED.filter((k) => moved.has(k)).join(", ")}; ` +
    `control also moves ${REG_FIELDS.filter((k) => control.has(k) && !EXCLUDED.includes(k)).join(", ")}`);
});

const MEMORY_TWINS = [
  ["no-op", brokenNoOp],
  ["wrong-sentinel", brokenWrongSentinel],
  ["wrong-rank", brokenWrongRank],
];

for (const [label, twin] of MEMORY_TWINS) {
  test(`TEETH: the ${label} twin is caught IN MEMORY on every insert`, { skip }, () => {
    const caught = caughtInMemory(twin);
    assert.equal(caught, INSERTS.length, `the ${label} twin escaped the memory diff on an insert`);
    console.log(`  TEETH/${label}: caught in memory on ${caught}/${INSERTS.length} inserts`);
  });
}

test("TEETH: the register control is caught, and the real rewrite is not", { skip }, () => {
  let control = 0;
  let real = 0;
  for (const [, input] of SCENARIOS) {
    if (compare(brokenMovesRegister, craft(input)).reg) control++;
    const r = compare(candidate, craft(input));
    if (r.escaped || r.reg || !r.carryOk) real++;
  }
  assert.equal(control, SCENARIOS.length, "the register control slipped a scenario");
  assert.equal(real, 0, "the real rewrite was flagged on a scenario");
  console.log(`  TEETH/register: control caught ${control}/${SCENARIOS.length}, real rewrite ${real}`);
});
