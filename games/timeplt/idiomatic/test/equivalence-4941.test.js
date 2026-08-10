// SPDX-License-Identifier: GPL-3.0-only
/** tallyCoinSlot1AndAwardCredit — memory-equivalent to the frozen oracle at ROM 0x4941. A pure leaf: its three ROM
 * calls are dissolved to direct imports, so the rewrite models no stack and omits its own ret.
 * Both tapes' real dispatches replay identically outside the masked stack scratch; four crafted
 * states drive the coinage branches the tapes never reach; register drift is held to a measured
 * ceiling. Run: node --test games/timeplt/idiomatic/test/equivalence-4941.test.js */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { tallyCoinSlot1AndAwardCredit as candidate } from "../tallyCoinSlot1AndAwardCredit.js";
import { loc_4941 as oracle } from "../../translated/loc_4941.js";
import { loc_57f1 } from "../loc_57f1.js";
import { paintCreditCountPanel } from "../paintCreditCountPanel.js";
import { pulseSlot1CoinCounter } from "../pulseSlot1CoinCounter.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x4941;
const COIN_SAMPLE = 0xa9ae;
const DEBOUNCE = 0xa9c7;
const COIN_TALLY = 0xa981;
const COINS_INSERTED = 0xa9c8;
const COINAGE = 0xa9c9;
const NO_CREDIT = 0xa9c0;
const CREDIT_COUNT = 0xa986;

// Every game write lands at or below here; the deepest oracle push stays above it, so masking the
// stack scratch can never hide a data divergence. Asserted against the measured floor below.
const DATA_TOP = 0xadff;
// The measured register ceiling: the callers tail-call and read no register, and the dissolved
// callees leave a/d/e/f/l where the frozen ex/ret path does not. Checked as a subset.
const EXCLUDED = ["a", "d", "e", "f", "l", "sp"];
const DISPATCHES_PER_TAPE = 1165;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

function capture(opts) {
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => { entries.push(mm.clone()); return oracle(mm); }]]), opts);
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the capture run ran short");
  return entries;
}

let corpusCache = null;
function corpus() {
  if (!corpusCache) corpusCache = [...capture({}), ...capture({ tape: [] })];
  return corpusCache;
}

// Oracle vs candidate on independent clones. The oracle pushes a return per delegated call and rets
// its own; the rewrite models no stack, so [low, seat) is masked, low watched off the oracle's pushes.
function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  const ra = oracle(a);
  const rb = cand(b);
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
  return { escaped, reg, low, seat, spDiff: a.regs.sp - b.regs.sp, retEq: ra === rb };
}

function footprint(machine) {
  const before = machine.dumpState().slice();
  const a = machine.clone();
  oracle(a);
  const now = a.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) if (now[i] !== before[i] && a.stateOffsetToAddr(i) <= DATA_TOP) n++;
  return n;
}

function fullWork() {
  const e = corpus().find((m) => footprint(m) > 4);
  assert.notEqual(e ?? null, null, "vacuous: no captured dispatch does the full credit work");
  return e;
}

// Crafted from a real full-work entry so the debounce edge still fires, then the coinage cells are
// forced to reach each of the four exits the tapes never do.
function craft(mut) { const m = fullWork().clone(); mut(m); return m; }
let branchCache = null;
function branches() {
  if (!branchCache) branchCache = {
    retnc: craft((m) => { m.mem8[COINS_INSERTED] = 0x00; m.mem8[COINAGE] = 0xf0; }),
    jrnz: craft((m) => { m.mem8[NO_CREDIT] = 1; m.mem8[COINAGE] = 0x11; m.mem8[COINS_INSERTED] = 0x20; }),
    daaNoOvf: craft((m) => { m.mem8[NO_CREDIT] = 0; m.mem8[COINAGE] = 0x13; m.mem8[COINS_INSERTED] = 0x20; m.mem8[CREDIT_COUNT] = 0x10; }),
    daaOvf: craft((m) => { m.mem8[NO_CREDIT] = 0; m.mem8[COINAGE] = 0x19; m.mem8[COINS_INSERTED] = 0x20; m.mem8[CREDIT_COUNT] = 0x95; }),
  };
  return branchCache;
}

// ── broken twins ────────────────────────────────────────────────────────────────────────────
function twin(o) {
  const { noop = false, noShift = false, cpVal = 0x01, guard = true, saturate = true, pulse = true } = o;
  return function body(m) {
    const { regs, mem8 } = m;
    if (noop) return;
    regs.a = mem8[COIN_SAMPLE];
    regs.hl = DEBOUNCE;
    regs.rrca();
    const rolled = regs.rl(mem8[DEBOUNCE]);
    if (!noShift) mem8[regs.hl] = rolled;
    regs.a = mem8[regs.hl];
    regs.and(0x07);
    regs.cp(cpVal);
    if (regs.fNZ) return;
    loc_57f1(m);
    mem8[COIN_TALLY] = mem8[COIN_TALLY] + 1;
    regs.hl = COINS_INSERTED;
    regs.a = mem8[regs.hl];
    regs.add(0x10);
    mem8[regs.hl] = regs.a;
    regs.b = regs.a;
    regs.hl = COINAGE;
    regs.a = mem8[regs.hl];
    regs.sub(regs.b);
    if (regs.fNC) return;
    regs.a = mem8[regs.hl];
    regs.c = regs.a;
    regs.and(0xf0);
    regs.add(0x10);
    regs.hl = COINS_INSERTED;
    regs.neg();
    regs.add(mem8[regs.hl]);
    mem8[regs.hl] = regs.a;
    if (guard && mem8[NO_CREDIT] !== 0) return pulse ? pulseSlot1CoinCounter(m) : undefined;
    regs.a = regs.c & 0x0f;
    regs.hl = CREDIT_COUNT;
    regs.add(mem8[regs.hl]);
    regs.daa();
    mem8[regs.hl] = regs.fNC ? regs.a : (saturate ? 0x99 : regs.a);
    paintCreditCountPanel(m);
    return pulse ? pulseSlot1CoinCounter(m) : undefined;
  };
}

// ★ control: scribbles h, a register OUTSIDE the ceiling — the positive control for EXCLUDED.
function control(m) { const r = candidate(m); m.regs.h = (m.regs.h + 1) & 0xff; return r; }

const TWINS = [
  ["no-op", twin({ noop: true }), 4],
  ["no-shift", twin({ noShift: true }), 4],
  ["wrong-edge", twin({ cpVal: 0x02 }), 4],
  ["no-guard", twin({ guard: false }), 1],
  ["no-saturate", twin({ saturate: false }), 1],
  ["no-pulse", twin({ pulse: false }), 3],
];

function sweepBranches(cand) {
  let caught = 0;
  for (const e of Object.values(branches())) {
    const r = compare(cand, e);
    if (r.escaped || r.reg) caught++;
  }
  return caught;
}

function movedOver(cand, set) {
  const moved = new Set();
  for (const e of set) {
    const a = e.clone();
    const b = e.clone();
    oracle(a);
    try { cand(b); } catch { continue; }
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return moved;
}

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("EQUAL at a full-work dispatch: RAM identical outside the masked stack scratch", { skip }, () => {
  const r = compare(candidate, fullWork());
  assert.equal(r.escaped, null, r.escaped && `escaped the mask at ${hex4(r.escaped.addr)}`);
  assert.equal(r.reg, null, r.reg && `register ${r.reg.k} diverged: ${r.reg.a} vs ${r.reg.b}`);
  assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached down into game data`);
  console.log(`  EQUAL: window [${hex4(r.low)},${hex4(r.seat)}) masked, spDiff ${r.spDiff}`);
});

test("CORPUS: every dispatch of both tapes replays identically, and not all are no-ops", { skip }, () => {
  for (const e of corpus()) {
    const r = compare(candidate, e);
    assert.equal(r.escaped, null, `${hex4(e.regs.sp)}: escaped at ${r.escaped && hex4(r.escaped.addr)}`);
    assert.equal(r.reg, null, `${hex4(e.regs.sp)}: register ${r.reg && r.reg.k} diverged`);
  }
  const working = corpus().filter((e) => footprint(e) > 0).length;
  assert.ok(working > 0, "no captured dispatch makes the oracle write, so the corpus is all no-ops");
  assert.equal(capture({}).length, DISPATCHES_PER_TAPE, "the coin-tape dispatch count moved");
  assert.equal(capture({ tape: [] }).length, DISPATCHES_PER_TAPE, "the attract dispatch count moved");
  console.log(`  CORPUS: ${corpus().length} dispatches identical, ${working} do work`);
});

test("PATHS: the four coinage exits are reached and each replays identically", { skip }, () => {
  const b = branches();
  for (const [label, e] of Object.entries(b)) {
    const r = compare(candidate, e);
    assert.equal(r.escaped, null, `${label} escaped at ${r.escaped && hex4(r.escaped.addr)}`);
    assert.equal(r.reg, null, `${label} diverged on ${r.reg && r.reg.k}`);
  }
  // ★ Vacuity guard: the credit path must reach 0xa986 and the guarded path must not, or a rewrite
  // that ignored the branch would pass every arm here.
  const wrote = (machine, addr) => { const before = machine.mem8[addr]; const a = machine.clone(); oracle(a); return a.mem8[addr] !== before; };
  assert.ok(wrote(b.daaNoOvf, CREDIT_COUNT), "the credit path did not touch the credit count");
  assert.ok(!wrote(b.jrnz, CREDIT_COUNT), "the guarded path credited anyway");
  console.log("  PATHS: retnc / jrnz / daa-noovf / daa-ovf all identical");
});

test("SP and RETURN: the oracle re-seats two bytes higher and both return the same", { skip }, () => {
  for (const e of [fullWork(), ...Object.values(branches())]) {
    const r = compare(candidate, e);
    assert.equal(r.spDiff, 2, "the oracle pops a return the rewrite does not");
    assert.ok(r.retEq, "the return value diverged");
  }
  console.log("  SP: +2 on every path; return values identical");
});

test("EXCLUDED, measured: nothing moves outside the ceiling, with a control that does", { skip }, () => {
  const set = [...corpus(), ...Object.values(branches())];
  const moved = movedOver(candidate, set);
  const ctrl = movedOver(control, set);
  assert.ok(REG_FIELDS.some((k) => ctrl.has(k) && !EXCLUDED.includes(k)),
    "the measurement reports nothing even for a twin that scribbles h, so a clean reading proves nothing");
  const unexpected = REG_FIELDS.filter((k) => moved.has(k) && !EXCLUDED.includes(k));
  assert.deepEqual(unexpected, [], "a register diverged outside the excluded set");
  console.log(`  EXCLUDED: candidate moves ${[...moved].join(",")}; control also moves ` +
    `${REG_FIELDS.filter((k) => ctrl.has(k) && !EXCLUDED.includes(k)).join(",")}`);
});

for (const [label, brokenTwin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of branches`, { skip }, () => {
    const caught = sweepBranches(brokenTwin);
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    assert.equal(caught, expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${Object.keys(branches()).length} branches`);
  });
}
