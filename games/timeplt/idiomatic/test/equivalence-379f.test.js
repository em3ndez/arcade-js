// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_379f vs the frozen oracle: poked real dispatches, the four decision branches crafted, and a
 * full occupancy x gate x owed-kills sweep, each masked for the dead stack scratch the dissolved
 * tails leave and held to a register ceiling. Run:
 *   node --test games/timeplt/idiomatic/test/equivalence-379f.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_379f as candidate } from "../loc_379f.js";
import { loc_379f as oracle } from "../../translated/loc_379f.js";
import { loc_3793 } from "../loc_3793.js";
import { spawnEnemyIntoFreeSlotElseStepSearch as spawn } from "../spawnEnemyIntoFreeSlotElseStepSearch.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x379f;
const GATE_CELL = 0xad05;
const CRAFT_BAND = 0xa850;
const RECORD_STRIDE = 0x10;
const BAND_SLOTS = 7;
const OWED_KILLS = 0xad02;
const ROUND_CRAFT_COUNT = 0xacc1;
const OPEN_PHASE = 0x30;

// The two cells that steer the caller into this address, and from which frame the poke forces them.
const PHASE_MID = 0xad06;
const DISPATCH_DIGIT = 0x08;
const POKE_FROM = 600;
const CAP = 60;

// Every data write lands at or below here; the seat sits far above it, so masking the scratch can
// never hide a real byte. Asserted against the watched floor below.
const DATA_TOP = 0xadff;

// The dissolved tail leaves the accumulator, the staging pair and the shadow set where the frozen
// side does not, and re-seats the stack; checked as a subset so a cleaner rewrite still passes.
const EXCLUDED = ["a", "d", "e", "f", "sp", "a_", "f_", "b_", "c_", "d_", "e_", "h_", "l_"];

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── real dispatches ───────────────────────────────────────────────────────────────────────────

let capturedCache = null;
function captured() {
  if (capturedCache) return capturedCache;
  const entries = [];
  let collecting = true;
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (collecting && entries.length < CAP) entries.push(mm.clone());
    return oracle(mm);
  }]]));
  m.pokes = [{ frame: POKE_FROM, addr: PHASE_MID, val: DISPATCH_DIGIT }];
  const frames = m.runFrames(ENTRY_FRAMES);
  collecting = false;
  assert.equal(m.stoppedBy, null, `the poked run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the poked run ran short");
  capturedCache = entries;
  return entries;
}

// ── the masked comparison ─────────────────────────────────────────────────────────────────────

// Oracle vs candidate on independent clones. The frozen side tail-calls a body that pushes below
// its seat and pops a return the rewrite never models, so [low, seat) is masked with low watched off
// the oracle's own pushes; anything outside it, or a register outside the ceiling, has escaped.
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

function craft({ gate, occ = 0, kills = 3 }) {
  const m = captured()[0].clone();
  m.regs.hl = GATE_CELL;
  m.mem8[GATE_CELL] = gate;
  for (let i = 0; i < BAND_SLOTS; i++) {
    m.mem8[CRAFT_BAND + i * RECORD_STRIDE] = (occ >> i) & 1 ? 0xff : 0;
  }
  m.mem8[OWED_KILLS] = kills;
  return m;
}

// Every occupancy against each gate value (idle-open, phase-open, shut) and each owed-kills arm.
function corpus() {
  const out = [];
  for (const gate of [0x00, OPEN_PHASE, 0x55]) {
    for (const kills of [0, 3]) {
      for (let occ = 0; occ < 1 << BAND_SLOTS; occ++) out.push(craft({ gate, occ, kills }));
    }
  }
  return out;
}

// ── broken twins ──────────────────────────────────────────────────────────────────────────────

// The rewrite with one deliberate defect; defaults match the candidate. Re-implemented rather than
// wrapped so the defect governs the whole body, not a patch after it.
function twin({ noop = false, ceiling = 0x02, openPhase = OPEN_PHASE, honorMode = true }) {
  return function body(m) {
    if (noop) return;
    const { regs, mem8 } = m;
    regs.a = mem8[regs.hl];
    regs.and(regs.a);
    if (regs.a !== 0x00) { regs.cp(openPhase); if (regs.a !== openPhase) return; }
    regs.hl = CRAFT_BAND; regs.de = RECORD_STRIDE; regs.b = BAND_SLOTS; regs.c = 0x00;
    do {
      regs.a = mem8[regs.hl];
      regs.and(regs.a);
      if (regs.a !== 0x00) regs.c = regs.inc8(regs.c);
      regs.hl = (regs.hl + regs.de) & 0xffff;
    } while (regs.djnz() !== 0);
    regs.a = regs.c;
    regs.cp(ceiling);
    if (regs.a >= ceiling) return;
    regs.a = mem8[OWED_KILLS];
    regs.and(regs.a);
    if (honorMode && regs.a === 0x00) return loc_3793(m);
    regs.a = mem8[ROUND_CRAFT_COUNT]; regs.b = regs.a; regs.ix = 0xa8b0; regs.iy = 0xaa26;
    return spawn(m);
  };
}

// The control for EXCLUDED: scribbles a register the routine has no business touching.
function movesCursor(m) { const r = candidate(m); m.regs.h = (m.regs.h + 1) & 0xff; return r; }

const TWINS = [
  ["no-op", twin({ noop: true }), 512],
  ["wrong-ceiling", twin({ ceiling: 0x03 }), 84],
  ["gate-only-zero", twin({ openPhase: 0x00 }), 256],
  ["skip-mode", twin({ honorMode: false }), 16],
];

function sweep(cand, states) {
  let caught = 0;
  for (const e of states) if (diverges(cand, e)) caught++;
  return caught;
}

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

test("REAL: every poked dispatch replays identically, and some write", { skip }, () => {
  const entries = captured();
  assert.ok(entries.length > 0, "vacuous: forcing the phase digit no longer reaches this address");
  for (const e of entries) {
    const r = compare(candidate, e);
    assert.equal(r.threw, null, r.threw && `the candidate threw: ${r.threw}`);
    assert.equal(r.escaped, null, r.escaped && `escaped the mask at ${hex4(r.escaped.addr)}`);
    assert.equal(r.reg, null, r.reg && `register ${r.reg.k} diverged: ${r.reg.a} vs ${r.reg.b}`);
  }
  const wrote = entries.filter((e) => footprint(e) > 0).length;
  assert.ok(wrote > 0, "no poked dispatch makes the oracle write, so this arm would pass a no-op");
  console.log(`  REAL: ${entries.length} dispatches identical, ${wrote} of them write`);
});

test("PATHS: the four decision branches each replay, and the branch really branches", { skip }, () => {
  const shut = craft({ gate: 0x55 });
  const busy2 = craft({ gate: 0x00, occ: 0b0000011 });
  const via3793 = craft({ gate: 0x00, occ: 0, kills: 0 });
  const via37d6 = craft({ gate: OPEN_PHASE, occ: 0, kills: 3 });
  for (const [name, m] of [["shut", shut], ["busy2", busy2], ["via3793", via3793], ["via37d6", via37d6]]) {
    const r = compare(candidate, m);
    assert.equal(r.escaped, null, `${name}: escaped at ${r.escaped && hex4(r.escaped.addr)}`);
    assert.equal(r.reg, null, `${name}: register ${r.reg && r.reg.k} diverged`);
  }
  // ★ Vacuity guard: the shut and busy branches write nothing while both spawn branches do, so a
  // rewrite that ignored the gate, the count or the mode could not pass all four.
  assert.equal(footprint(shut), 0, "the shut gate wrote something");
  assert.equal(footprint(busy2), 0, "the two-busy bank wrote something");
  assert.ok(footprint(via3793) > 0 && footprint(via37d6) > 0, "a spawn branch wrote nothing");
  console.log(`  PATHS: shut/busy write ${footprint(shut)}/${footprint(busy2)}, spawns ` +
    `${footprint(via3793)}/${footprint(via37d6)}`);
});

test("CORPUS: occupancy x gate x owed-kills all replay, and the sweep is not all no-ops",
  { skip }, () => {
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

test("SP AND RETURN: +2 re-seat on every path, mask floor over the data, returns equal",
  { skip }, () => {
    for (const m of [craft({ gate: 0x55 }), craft({ gate: 0x00, occ: 0, kills: 0 }),
      craft({ gate: OPEN_PHASE, occ: 0, kills: 3 })]) {
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
  const control = movedOver(movesCursor, states);
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
  assert.equal(sweep(movesCursor, states), states.length, "the control twin slipped a state");
  console.log(`  TEETH CONTROL: caught on ${states.length}/${states.length}`);
});

for (const [label, brokenTwin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted states`, { skip }, () => {
    const states = corpus();
    const caught = sweep(brokenTwin, states);
    assert.ok(caught > 0, `the ${label} twin is not caught at all`);
    assert.equal(caught, expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught}/${states.length}`);
  });
}
