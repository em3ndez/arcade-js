// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearSceneryEntriesThenRunEraScenery — memory-equivalent to the frozen oracle at ROM 0x30D1. GATE: the real coin/attract
 * dispatch (era below four, into the dissolved seat-and-scenery chain) is compared with the dead
 * six-byte stack scratch masked, the two cursors it leaves standing checked and the two-byte drift
 * asserted; crafted era-four entries drive the scenery arm and the guard-fail arm that transfers
 * into a data table and faults, where equivalence is a matching fault over identical RAM; corpus
 * over two tapes, and teeth. Registers scrambled by the dropped tail chains are not compared.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-30d1.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { clearSceneryEntriesThenRunEraScenery as candidate } from "../clearSceneryEntriesThenRunEraScenery.js";
import { loc_30d1 as oracle } from "../../translated/loc_30d1.js";
import { seedSceneryEntriesThenRunScenery } from "../seedSceneryEntriesThenRunScenery.js";
import { loc_315b } from "../loc_315b.js";
import { runSceneryForEra } from "../runSceneryForEra.js";

const TARGET = 0x30d1;
const G1 = 0xacc7;
const G2 = 0xacc8;
const GUARD_OK = 0x3b;
const SUB_A = 0x05;
const SUB_B = 0x10;
const ERA_FOUR = 4;
const SEAT_CELL = 0xaa30;
/** Every game cell any path writes lands at or below here; the stack seats far above it. */
const DATA_TOP = 0xadff;
const SEAT_DRIFT = 2;
const CORPUS_FRAMES = 2000;
const DISPATCHES = { coin: 3, attract: 1 };

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${d.addr == null ? "reg" : hex4(d.addr)}: frozen=${d.a} rewrite=${d.b}` : "identical");

// ── the masked comparison ─────────────────────────────────────────────────────────────────

/**
 * Oracle vs candidate on independent clones. Both dissolved arms drop a ROM ret and scramble the
 * scratch registers, so RAM is diffed outside [low, seat) — low measured by watching the oracle's
 * own pushes — the two cursors the run leaves standing are checked, and throw-agreement is required
 * so the fault arm counts as equal only when both faults land on identical RAM.
 */
function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  let threwA = false;
  let threwB = false;
  try { oracle(a); } catch { threwA = true; }
  try { cand(b); } catch { threwB = true; }
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    escaped = { addr, a: da[i], b: db[i] };
  }
  const throwMismatch = threwA !== threwB ? { addr: null, a: threwA ? "threw" : "returned", b: threwB ? "threw" : "returned" } : null;
  let cursor = null;
  if (!threwA && !threwB) {
    if (a.regs.ix !== b.regs.ix) cursor = { addr: null, a: `ix=${hex4(a.regs.ix)}`, b: `ix=${hex4(b.regs.ix)}` };
    else if (a.regs.iy !== b.regs.iy) cursor = { addr: null, a: `iy=${hex4(a.regs.iy)}`, b: `iy=${hex4(b.regs.iy)}` };
  }
  return { escaped, throwMismatch, cursor, spDiff: a.regs.sp - b.regs.sp, low, seat, threw: threwA };
}
const caught = (r) => r.escaped !== null || r.throwMismatch !== null || r.cursor !== null;

/** What the oracle leaves in every game cell it moves — addr=value pairs, so two arms that touch
 * the same cells with different bytes still read as different footprints. */
function footprint(machine) {
  const a = machine.clone();
  const before = a.dumpState().slice();
  try { oracle(a); } catch { /* the fault arm still wrote its fill run before faulting */ }
  const now = a.dumpState();
  const cells = [];
  for (let i = 0; i < now.length; i++) {
    const addr = a.stateOffsetToAddr(i);
    if (now[i] !== before[i] && addr <= DATA_TOP) cells.push(`${addr}=${now[i]}`);
  }
  return cells;
}

// ── the captured entry, and the crafted era-four entries ──────────────────────────────────

let entry = null;
function seatEntry() {
  if (entry === null) {
    const m = makeMachine(new Map([[TARGET, (mm) => {
      if (entry === null) entry = mm.clone();
      return oracle(mm);
    }]]));
    m.runFrames(ENTRY_FRAMES);
  }
  return entry;
}

/** The natural dispatch always carries era below four, so the era-four arms are reached by poking
 * the era register the routine branches on and the two work-RAM guards the deeper arm reads. */
function craft(mutate) {
  const m = seatEntry().clone();
  mutate(m);
  return m;
}
const scenarios = () => [
  { tag: "A-captured", m: seatEntry(), faults: false },
  { tag: "B-scenery-10", m: craft((m) => { m.regs.c = ERA_FOUR; m.mem8[G1] = GUARD_OK; m.mem8[G2] = SUB_B; }), faults: false },
  { tag: "B-scenery-05", m: craft((m) => { m.regs.c = ERA_FOUR; m.mem8[G1] = GUARD_OK; m.mem8[G2] = SUB_A; }), faults: false },
  { tag: "C-fault-g1", m: craft((m) => { m.regs.c = ERA_FOUR; m.mem8[G1] = 0x00; }), faults: true },
  { tag: "C-fault-g2", m: craft((m) => { m.regs.c = ERA_FOUR; m.mem8[G1] = GUARD_OK; m.mem8[G2] = 0x99; }), faults: true },
];

// ── twins ─────────────────────────────────────────────────────────────────────────────────

/** The rewrite with one deliberate defect each; every parameter matches clearSceneryEntriesThenRunEraScenery by default, and
 * each twin dissolves to the same callees so only the named defect can move the comparison. */
function variant({ fillStride = 2, fillCount = 8, eraFloor = 4, guardOk = 0x3b, subA = 0x05, subB = 0x10, seatTable = 0x315e, seatCount = 8, seatStride = 2, transfer = true } = {}) {
  return (m) => {
    const { regs, mem8 } = m;
    regs.hl = 0xaa60;
    regs.de = fillStride;
    regs.b = fillCount;
    do { mem8[regs.hl] = regs.a; regs.hl = (regs.hl + regs.de) & 0xffff; regs.b = (regs.b - 1) & 0xff; } while (regs.b !== 0);
    regs.a = regs.c;
    regs.cp(eraFloor);
    if (regs.fC) return seedSceneryEntriesThenRunScenery(m);
    regs.hl = G1;
    regs.a = mem8[regs.hl];
    regs.cp(guardOk);
    if (regs.fNZ) return loc_315b(m);
    regs.hl = (regs.hl + 1) & 0xffff;
    regs.a = mem8[regs.hl];
    regs.cp(subA);
    if (regs.fNZ) { regs.cp(subB); if (regs.fNZ) return loc_315b(m); }
    regs.b = seatCount;
    regs.iy = SEAT_CELL;
    regs.hl = seatTable;
    do {
      regs.a = mem8[regs.hl];
      mem8[(regs.iy + 0x31) & 0xffff] = regs.a;
      regs.hl = (regs.hl + 1) & 0xffff;
      regs.a = mem8[regs.hl];
      mem8[regs.iy & 0xffff] = regs.a;
      regs.hl = (regs.hl + 1) & 0xffff;
      regs.iy = (regs.iy + seatStride) & 0xffff;
      regs.b = (regs.b - 1) & 0xff;
    } while (regs.b !== 0);
    if (transfer) return runSceneryForEra(m);
  };
}

/** Scrambles a cursor the run leaves standing; the control that the cursor check has teeth. */
function brokenMovesCursor(m) {
  candidate(m);
  m.regs.ix = (m.regs.ix + 1) & 0xffff;
}

const TWINS = [
  ["no-op", () => {}, 5],
  ["fill-stride-1", variant({ fillStride: 1 }), 5],
  ["era-floor-5", variant({ eraFloor: 5 }), 4],
  ["guard-ok-3a", variant({ guardOk: 0x3a }), 2],
  ["sub-a-06", variant({ subA: 0x06 }), 1],
  ["seat-stride-1", variant({ seatStride: 1 }), 2],
  ["no-transfer", variant({ transfer: false }), 2],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: identical outside the six-byte scratch window", { skip }, () => {
  assert.notEqual(seatEntry(), null, "vacuous: the tape never reached the routine");
  const r = compare(candidate, seatEntry());
  assert.equal(r.escaped, null, `a divergence escaped the scratch window — ${show(r.escaped)}`);
  assert.equal(r.throwMismatch, null, `one side faulted and the other did not — ${show(r.throwMismatch)}`);
  assert.equal(r.cursor, null, `a cursor diverged — ${show(r.cursor)}`);
  assert.equal(r.spDiff, SEAT_DRIFT, "the dropped chain return no longer moves the pointer");
  // ★ The mask is safe only because its floor sits above every game cell any path writes.
  assert.ok(r.low > DATA_TOP, `the scratch floor ${hex4(r.low)} reached into game data`);
  console.log(`  EQUAL: sp=${hex4(r.seat)} window=[${hex4(r.low)},${hex4(r.seat)}) spDiff ${r.spDiff}`);
});

test("PATHS: the scenery arm and the fault arm are each equivalent, and really differ", { skip }, () => {
  const prints = {};
  for (const { tag, m, faults } of scenarios()) {
    const r = compare(candidate, m);
    assert.ok(!caught(r), `${tag} diverged — ${show(r.escaped ?? r.throwMismatch ?? r.cursor)}`);
    if (!faults) assert.equal(r.spDiff, SEAT_DRIFT, `${tag}: the dropped chain return no longer drifts by two`);
    // ★ Vacuity: the crafted era-four arms really fault (or seat) as their tag claims, not silently
    //   fall back to the captured arm's path.
    let threw = false;
    const probe = m.clone();
    try { oracle(probe); } catch { threw = true; }
    assert.equal(threw, faults, `${tag}: the oracle ${threw ? "faulted" : "returned"}, against the tag`);
    prints[tag] = footprint(m).join(",");
  }
  assert.notEqual(prints["A-captured"], prints["B-scenery-10"], "the seat arm and the scenery arm move the same cells");
  console.log(`  PATHS: 5 scenarios equivalent; scenery moves ${prints["B-scenery-10"].split(",").length} cells`);
});

test("CORPUS: every dispatch of two tapes replays, and all carry era below four", { skip }, () => {
  const run = (opts) => {
    let dispatched = 0;
    let missed = 0;
    let eraFour = 0;
    const m = makeMachine(new Map([[TARGET, (mm) => {
      dispatched++;
      if (mm.regs.c >= ERA_FOUR) eraFour++;
      if (caught(compare(candidate, mm))) missed++;
      return oracle(mm);
    }]]), opts);
    const frames = m.runFrames(CORPUS_FRAMES);
    assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
    assert.equal(frames.length, CORPUS_FRAMES, "the run ran short");
    return { dispatched, missed, eraFour };
  };
  const coin = run({});
  const attract = run({ tape: [] });
  assert.equal(coin.dispatched, DISPATCHES.coin, "the coin-start dispatch count moved");
  assert.equal(attract.dispatched, DISPATCHES.attract, "the attract dispatch count moved");
  assert.ok(attract.dispatched > 0, "vacuous: attract never reached the routine");
  assert.equal(coin.missed + attract.missed, 0, "the rewrite diverged on a real dispatch");
  assert.equal(coin.eraFour + attract.eraFour, 0, "a natural dispatch now carries era four, so the era-four arms are no longer crafted-only");
  console.log(`  CORPUS: coin ${coin.dispatched}, attract ${attract.dispatched}, all era below four, identical`);
});

test("LIVE-OUT: the two cursors are the register live-out, and the check has teeth", { skip }, () => {
  assert.equal(compare(candidate, seatEntry()).cursor, null, "a cursor diverged on the real dispatch");
  assert.notEqual(compare(brokenMovesCursor, seatEntry()).cursor, null, "the cursor control was not caught");
  console.log("  LIVE-OUT: cursors agree; the scramble control is caught");
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT on an exact count of scenarios`, { skip }, () => {
    let n = 0;
    for (const { m } of scenarios()) if (caught(compare(twin, m))) n++;
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    assert.equal(n, expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${n} of ${scenarios().length} scenarios`);
  });
}
