// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence gate for the idiomatic loc_42b7 (ROM 0x42B7) — the launcher the free-slot finder at
 * 0x4243 tails into. All six ROM calls are dissolved to direct imports, so the rewrite pushes no
 * return address; the oracle's stack scratch [low, seat) is masked (floor proven above game data)
 * and its unbalanced tail ret shows as spDiff 2. RAM outside the mask is compared whole, registers
 * held to a measured ceiling. The coin-start tape reaches it with era 0 only, so crafted-era
 * machines drive the other three bodies. Run: node --test games/timeplt/idiomatic/test/equivalence-42b7.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_42b7 as candidate } from "../loc_42b7.js";
import { loc_42b7 as oracle } from "../../translated/loc_42b7.js";
import { loc_4243 as dispatcher } from "../../translated/loc_4243.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x42b7;
const DISPATCHER = 0x4243;
const ERA = 0xad04;
const NEW_RECORD = 0xa991;
const NEW_ENTRY = 0xa993;
const COOLDOWN = 0xa8f4;
const ERA4_EXTRA_SRC = 0xa8e6;
const DATA_TOP = 0xadff; // every game cell this routine writes is at or below here

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// The measured ceiling: this tail-terminal routine leaves scratch in these and the dissolved tails
// leave others differently. A subset check, so a register-exact rewrite still passes; ix/iy held.
const EXCLUDED = ["a", "f", "b", "c", "d", "e", "h", "l", "sp", "a_"];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── capture and craft ─────────────────────────────────────────────────────────────────────

function captureTape(opts) {
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => { entries.push(mm.clone()); return oracle(mm); }]]), opts);
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `capture stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "capture ran short");
  return entries;
}

let corpusCache = null;
function corpus() { if (!corpusCache) corpusCache = captureTape({}); return corpusCache; }

// Only 0xAD04 is changed, so the staged record/entry pointers stay valid and one branch is retargeted.
function craftEra(era) { const m = corpus()[0].clone(); m.mem8[ERA] = era; return m; }

// ── comparison, oracle stack scratch masked ─────────────────────────────────────────────────

function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  const retA = oracle(a);
  let retB;
  try { retB = cand(b); } catch (e) {
    return { escaped: { addr: null, o: "returned", c: String(e).slice(0, 50) }, reg: null, low, seat, spDiff: 0, retA, retB };
  }
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue; // the oracle's pushes, which the rewrite omits
    escaped = { addr, o: da[i], c: db[i] };
  }
  let reg = null;
  for (const k of REG_FIELDS) {
    if (EXCLUDED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) { reg = { k, a: a.regs[k], b: b.regs[k] }; break; }
  }
  return { escaped, reg, low, seat, spDiff: a.regs.sp - b.regs.sp, retA, retB };
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

function movedOver(cand, machines) {
  const moved = new Set();
  for (const e of machines) {
    const a = e.clone();
    const b = e.clone();
    oracle(a);
    try { cand(b); } catch { continue; }
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return moved;
}

function allMachines() { return [...corpus(), ...[0, 1, 2, 3, 4].map(craftEra)]; }

// ── broken twins ────────────────────────────────────────────────────────────────────────────

function twinNoOp() {}
function twinSkipCountDown(m) { const r = candidate(m); const rec = m.mem16[NEW_RECORD]; m.mem8[rec] = (m.mem8[rec] + 1) & 0xff; return r; }
function twinSkipCooldown(m) { const r = candidate(m); m.mem8[COOLDOWN] = (m.mem8[COOLDOWN] + 1) & 0xff; return r; }
function twinWrongFacing(m) { const r = candidate(m); const rec = m.mem16[NEW_RECORD]; m.mem8[rec + 0x01] = (m.mem8[rec + 0x01] + 1) & 0xff; return r; }
function twinEra0Marker(m) { const r = candidate(m); if (m.mem8[ERA] === 0) { const rec = m.mem16[NEW_RECORD]; m.mem8[rec + 0x08] = (m.mem8[rec + 0x08] + 1) & 0xff; } return r; }
function brokenMovesIy(m) { const r = candidate(m); m.regs.iy = (m.regs.iy + 1) & 0xffff; return r; }

const TWINS = [
  ["no-op", twinNoOp],
  ["skips-countdown", twinSkipCountDown],
  ["skips-cooldown", twinSkipCooldown],
  ["wrong-facing", twinWrongFacing],
  ["era0-wrong-marker", twinEra0Marker],
];

// ── the gate ──────────────────────────────────────────────────────────────────────────────────

test("REACH: the driven tape dispatches it via the slot-finder; the idle tape cannot", { skip }, () => {
  const count = (opts) => {
    const seen = { [TARGET]: 0, [DISPATCHER]: 0 };
    const m = makeMachine(new Map([
      [TARGET, (mm) => { seen[TARGET]++; return oracle(mm); }],
      [DISPATCHER, (mm) => { seen[DISPATCHER]++; return dispatcher(mm); }],
    ]), opts);
    m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `run stopped early: ${m.stoppedBy}`);
    return seen;
  };
  const driven = count({});
  const idle = count({ tape: [] });
  assert.ok(driven[TARGET] > 0, "vacuous: the driven tape never reached the launcher");
  assert.equal(idle[DISPATCHER], 0, "the idle tape runs the slot-finder now, so its zero needs a new reason");
  assert.equal(idle[TARGET], 0, "the idle tape reached the launcher; capture plain entries instead");
  console.log(`  REACH: ${hex4(TARGET)} entered ${driven[TARGET]} driven / ${idle[TARGET]} idle; finder ${hex4(DISPATCHER)} ${driven[DISPATCHER]} / ${idle[DISPATCHER]}`);
});

test("CORPUS: every captured dispatch replays identically, and the corpus writes", { skip }, () => {
  const entries = corpus();
  assert.ok(entries.length > 0, "vacuous: nothing captured");
  for (const e of entries) {
    const r = compare(candidate, e);
    assert.equal(r.escaped, null, r.escaped && `escaped at ${hex4(r.escaped.addr ?? 0)}: ${r.escaped.o} vs ${r.escaped.c}`);
    assert.equal(r.reg, null, r.reg && `register ${r.reg.k}: ${r.reg.a} vs ${r.reg.b}`);
  }
  const writing = entries.filter((e) => footprint(e) > 0).length;
  assert.ok(writing > 0, "no captured dispatch makes the oracle write, so the corpus is idle");
  console.log(`  CORPUS: ${entries.length} dispatches identical, ${writing} write`);
});

test("STACK: the masked window sits above all game data and the drift is two bytes", { skip }, () => {
  for (const e of [corpus()[0], craftEra(3)]) {
    const r = compare(candidate, e);
    // ★ the mask is safe only if it never covers a data cell: prove its floor sits above them all.
    assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached into game data`);
    assert.equal(r.spDiff, 2, `the oracle no longer re-seats two bytes higher (${r.spDiff})`);
    assert.equal(r.retA, r.retB, "the return value diverged");
  }
  const r = compare(candidate, corpus()[0]);
  console.log(`  STACK: window [${hex4(r.low)},${hex4(r.seat)}) masked, spDiff 2`);
});

test("ERAS: all four launch bodies replay identically, and each takes its own branch", { skip }, () => {
  for (const era of [0, 1, 2, 3, 4]) {
    const r = compare(candidate, craftEra(era));
    assert.equal(r.escaped, null, `era ${era} escaped at ${r.escaped && hex4(r.escaped.addr ?? 0)}`);
    assert.equal(r.reg, null, `era ${era} register ${r.reg && r.reg.k} diverged`);
  }
  // ★ Vacuity: read distinctive cells off the oracle, so a craft that fell through one shared body
  // rather than four could not pass.
  const record = corpus()[0].mem16[NEW_RECORD];
  const entry = corpus()[0].mem16[NEW_ENTRY];
  const run = (era) => { const a = craftEra(era); oracle(a); return a; };
  const e0 = run(0), e3 = run(3), e4 = run(4);
  assert.equal(e0.mem8[entry + 0x01], 0x4f, "era 0 body did not run");
  assert.equal(e3.mem8[record + 0x0e], 0x20, "era 3 body did not run");
  assert.equal(e4.mem8[record + 0x04], e4.mem8[ERA4_EXTRA_SRC], "era 4 did not seed the extra byte");
  const fps = [0, 1, 3].map((era) => footprint(craftEra(era)));
  assert.ok(fps[0] !== fps[2], "era 0 and era 3 move the same number of cells, so the branch is inert");
  console.log(`  ERAS: 0-4 identical; footprints era 0/1/3 = ${fps.join("/")}`);
});

test("EXCLUDED: no register outside the ceiling moves, with a control that does", { skip }, () => {
  const machines = allMachines();
  const moved = movedOver(candidate, machines);
  const control = movedOver(brokenMovesIy, machines);
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !EXCLUDED.includes(k)),
    "the control scribbles iy yet nothing outside the ceiling is reported, so the reading is blind");
  assert.deepEqual(REG_FIELDS.filter((k) => moved.has(k) && !EXCLUDED.includes(k)), [],
    "a register diverged outside the ceiling");
  console.log(`  EXCLUDED: moving ${[...moved].sort().join(",")}; control adds ${REG_FIELDS.filter((k) => control.has(k) && !EXCLUDED.includes(k)).join(",")}`);
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is caught`, { skip }, () => {
    const machines = allMachines();
    let caught = 0;
    for (const e of machines) { const r = compare(twin, e); if (r.escaped || r.reg) caught++; }
    assert.ok(caught > 0, `every machine passed the ${label} twin`);
    console.log(`  TEETH/${label}: caught on ${caught}/${machines.length}`);
  });
}
