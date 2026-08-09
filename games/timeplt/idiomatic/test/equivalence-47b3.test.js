// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_47b3 — memory-equivalent to the frozen oracle at ROM 0x47B3. Unit-capture at the real
 * dispatch plus crafted branch entries; RAM diffed with the dead stack scratch below the seated SP
 * masked out (the oracle nests calls, the rewrite does not), the +2 SP re-seat and the return value
 * checked, plus teeth. Registers are not compared: the dissolved callees drop the register dance.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_47b3 as candidate } from "../loc_47b3.js";
import { loc_47b3 as oracle } from "../../translated/loc_47b3.js";
import { fetchTableByte } from "../fetchTableByte.js";
import { driftWithWorldScroll } from "../driftWithWorldScroll.js";
import { flyAlongStoredVelocity } from "../flyAlongStoredVelocity.js";
import { hasReachedRetireLine } from "../hasReachedRetireLine.js";
import { spawnAtEdgeAhead } from "../spawnAtEdgeAhead.js";
import { postNextParachutistBonus } from "../postNextParachutistBonus.js";
import { showParachutistAward } from "../showParachutistAward.js";
import { retireSlotIntoCooldown } from "../retireSlotIntoCooldown.js";

const TARGET = 0x47b3;
const ERA_INDEX = 0xad04;
const STATE = 0xa8f0;
const RECORD = 0xa8f0;
const SPRITE = 0xaa2e;
const COLUMN_CELL = 0xaa2e;
const ROW_CELL = 0xaa5f;
const FRAME_TICK = 0xa980;
const SHAPE_TABLE = 0x47ea;
const VELOCITY = [0xa8fa, 0xa8fb, 0xa8fc, 0xa8fd];
const WORLD_SCROLL = [0xa808, 0xa809, 0xa80a, 0xa80b];

const DATA_TOP = 0xadff;
const CORPUS_FRAMES = 2000;
const COINSTART_DISPATCHES = 598;
const ATTRACT_DISPATCHES = 879;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── the masked comparison ─────────────────────────────────────────────────────────────────
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
  return { escaped, low, seat, spDiff: a.regs.sp - b.regs.sp, retOracle, retCand };
}

/** Cells the oracle moves from a state, ignoring the stack scratch — a branch's footprint. */
function footprint(machine) {
  const a = machine.clone();
  const before = a.dumpState().slice();
  oracle(a);
  const now = a.dumpState();
  const cells = [];
  for (let i = 0; i < now.length; i++) {
    const addr = a.stateOffsetToAddr(i);
    if (now[i] !== before[i] && addr <= DATA_TOP) cells.push(addr);
  }
  return cells;
}

// ── the captured entry, and the crafted branch entries ──────────────────────────────────
let entry = null;
function entryState() {
  if (entry === null) {
    const m = makeMachine(new Map([[TARGET, (mm) => {
      if (entry === null) entry = mm.clone();
      return oracle(mm);
    }]]));
    m.runFrames(ENTRY_FRAMES);
  }
  return entry;
}

function craft(mutate) {
  const m = entryState().clone();
  mutate(m);
  return m;
}

/** The captured entry takes the free-slot path; every other arm is poked in on both sides. */
function scenarios() {
  const stillWater = (m) => { for (const a of [...VELOCITY, ...WORLD_SCROLL]) m.mem8[a] = 0; };
  return [
    ["spawn", craft(() => {})],
    ["era-gate", craft((m) => { m.mem8[ERA_INDEX] = 4; })],
    ["bonus", craft((m) => { m.mem8[STATE] = 0x10; })],
    ["award", craft((m) => { m.mem8[STATE] = 0x50; })],
    ["retire0", craft((m) => { m.mem8[STATE] = 0x01; })],
    ["counting", craft((m) => { m.mem8[STATE] = 0x05; })],
    ["live-retire", craft((m) => { m.mem8[STATE] = 0xff; m.mem8[COLUMN_CELL] = 0x04; stillWater(m); })],
    ["live-animate", craft((m) => {
      m.mem8[STATE] = 0xff; m.mem8[COLUMN_CELL] = 0x80; m.mem8[ROW_CELL] = 0x80; stillWater(m);
    })],
  ];
}

// ── the twins ─────────────────────────────────────────────────────────────────────────────
/** The rewrite with one deliberate defect each; every knob matches loc_47b3 by default. */
function twin({ drift = true, dec = 1, shiftBy = 4, retireInv = false, awardFrom = 0x3c }) {
  return (m) => {
    const { regs, mem8 } = m;
    if (mem8[ERA_INDEX] === 4) return;
    regs.ix = RECORD;
    regs.iy = SPRITE;
    const state = mem8[RECORD];
    if (state === 0x00) return spawnAtEdgeAhead(m);
    if (state !== 0xff) {
      if (drift) driftWithWorldScroll(m);
      if (state === 0x10) return postNextParachutistBonus(m);
      if (state >= awardFrom) return showParachutistAward(m);
      mem8[RECORD] = state - dec;
      if (mem8[RECORD] !== 0) return;
      return retireSlotIntoCooldown(m);
    }
    flyAlongStoredVelocity(m);
    const reached = hasReachedRetireLine(m);
    if (retireInv ? !reached : reached) return retireSlotIntoCooldown(m);
    regs.hl = SHAPE_TABLE;
    regs.a = (mem8[FRAME_TICK] >> shiftBy) & 7;
    mem8[SPRITE + 1] = fetchTableByte(m);
    mem8[SPRITE + 0x30] = 0x75;
  };
}

const TWINS = [
  ["no-op", () => {}, 6],
  ["skip-drift", twin({ drift: false }), 3],
  ["dec-by-two", twin({ dec: 2 }), 2],
  ["wrong-shift", twin({ shiftBy: 3 }), 1],
  ["retire-inverted", twin({ retireInv: true }), 2],
  ["wrong-award-floor", twin({ awardFrom: 0x60 }), 1],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────
test("EQUAL at the real dispatch: RAM identical outside the masked stack scratch", { skip }, () => {
  const r = compare(candidate, entryState());
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  assert.equal(r.escaped, null, r.escaped && `escaped the mask at ${hex4(r.escaped.addr)}`);
  // ★ the mask is safe only if its floor never covers a data cell.
  assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached into game data`);
  console.log(`  EQUAL: window [${hex4(r.low)},${hex4(r.seat)}) masked, spDiff ${r.spDiff}`);
});

test("PATHS: every branch is memory-equivalent, and the branches really differ", { skip }, () => {
  const prints = {};
  for (const [label, m] of scenarios()) {
    const r = compare(candidate, m);
    assert.equal(r.escaped, null, `${label} escaped at ${r.escaped && hex4(r.escaped.addr)}`);
    prints[label] = footprint(m).join(",");
  }
  // ★ vacuity guard: distinct branches must move distinct cells, or a rewrite ignoring the branch
  // would pass.
  assert.notEqual(prints.bonus, prints.award, "the bonus and award branches move the same cells");
  assert.notEqual(prints["live-retire"], prints["live-animate"], "retire and animate move the same cells");
  assert.notEqual(prints.bonus, "", "the bonus branch moved nothing");
  console.log(`  PATHS: ${scenarios().length} scenarios equivalent`);
});

test("SP and RETURN: the oracle re-seats two bytes higher and both return the same", { skip }, () => {
  for (const [label, m] of scenarios()) {
    const r = compare(candidate, m);
    assert.equal(r.spDiff, 2, `${label}: the oracle pops a return address and the rewrite does not`);
    assert.equal(r.retOracle, r.retCand, `${label}: the return value diverged`);
  }
  console.log("  SP: +2 on every path; return values identical");
});

test("CORPUS: every dispatch replays identically, coin-start and attract", { skip }, () => {
  const run = (opts) => {
    let dispatched = 0;
    let caught = 0;
    const m = makeMachine(new Map([[TARGET, (mm) => {
      dispatched++;
      if (compare(candidate, mm).escaped) caught++;
      return oracle(mm);
    }]]), opts);
    const frames = m.runFrames(CORPUS_FRAMES);
    assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
    assert.equal(frames.length, CORPUS_FRAMES, "the run ran short");
    return { dispatched, caught };
  };
  const coinStart = run({});
  const attract = run({ tape: [] });
  assert.equal(coinStart.dispatched, COINSTART_DISPATCHES, "the coin-start dispatch count moved");
  assert.equal(coinStart.caught, 0, `the rewrite diverged on ${coinStart.caught} coin-start dispatches`);
  assert.equal(attract.dispatched, ATTRACT_DISPATCHES, "the attract dispatch count moved");
  assert.equal(attract.caught, 0, `the rewrite diverged on ${attract.caught} attract dispatches`);
  console.log(`  CORPUS: ${coinStart.dispatched} coin-start, ${attract.dispatched} attract, all identical`);
});

for (const [label, brokenTwin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of scenarios`, { skip }, () => {
    let caught = 0;
    for (const [, m] of scenarios()) if (compare(brokenTwin, m).escaped) caught++;
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    assert.equal(caught, expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${scenarios().length} scenarios`);
  });
}
