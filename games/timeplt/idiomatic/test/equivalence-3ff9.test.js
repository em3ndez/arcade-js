// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3ff9 — memory-equivalent to the frozen oracle at ROM 0x3FF9.
 * GATE: crafted-entry sweep over the bank's occupancy on a real captured machine, seated exactly as
 *   the loop's fall-through entry seats it. The oracle brackets each service with a pushed return the
 *   rewrite never writes, so RAM is compared with the dead stack scratch below the seat masked out,
 *   the SP drift asserted, registers not compared, and teeth. Run:
 *   node --test games/timeplt/idiomatic/test/equivalence-3ff9.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_3ff9 as candidate } from "../loc_3ff9.js";
import { loc_3ff9 as oracle } from "../../translated/loc_3ff9.js";
import { loc_3fea as seedOracle } from "../../translated/loc_3fea.js";
import { flyAlongBallisticArc } from "../flyAlongBallisticArc.js";
import { runOneShotAnimatedObjectSlot } from "../runOneShotAnimatedObjectSlot.js";

const TARGET = 0x3ff9;
// The fall-through entry that seats the cursor and count and runs this loop head inline; the only
// site that reaches this block in a driven session, so it is the UNREACHED arm's positive control.
const SEED_SITE = 0x3fea;

const IX0 = 0xa8c0;
const IY0 = 0xaa28;
const COUNT = 3;
const RECORD_STRIDE = 0x10;
const ENTRY_STRIDE = 2;
// empty / ballistic / live-countdown: the three treatments a slot's head byte selects.
const HEADS = [0x00, 0xff, 0x50];

// Every data write lands at or below here; the stack seats far above, so masking the scratch window
// can never hide a game-data divergence. Asserted against the measured floor below.
const DATA_TOP = 0xadff;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

/** What the fall-through entry seats before the loop head. */
function seat(mm) {
  mm.regs.ix = IX0;
  mm.regs.iy = IY0;
  mm.regs.b = COUNT;
}

let entry = null;
function entryState() {
  if (entry === null) {
    const m = makeMachine(new Map([[SEED_SITE, (mm) => {
      if (entry === null) entry = mm.clone();
      return seedOracle(mm);
    }]]));
    m.runFrames(ENTRY_FRAMES);
  }
  return entry;
}

function craft(heads) {
  const m = entryState().clone();
  for (let i = 0; i < COUNT; i++) m.mem8[IX0 + i * RECORD_STRIDE] = heads[i];
  return m;
}

function* combos() {
  for (const a of HEADS) for (const b of HEADS) for (const c of HEADS) {
    yield [[a, b, c].map(hex4).join(","), craft([a, b, c])];
  }
}

/**
 * Oracle vs candidate on independent clones, both seated. The oracle nests service calls and leaves
 * dead return addresses in the stack scratch the rewrite never writes, so the diff excludes
 * [low, seat) — low measured by watching the oracle's own pushes. Anything outside that has escaped.
 */
function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  seat(a);
  seat(b);
  const seatSp = a.regs.sp;
  let low = seatSp;
  const push = a.push16.bind(a);
  a.push16 = (v) => {
    push(v);
    if (a.regs.sp < low) low = a.regs.sp;
  };
  oracle(a);
  cand(b);
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seatSp) continue;
    escaped = { addr, oracle: da[i], candidate: db[i] };
  }
  return { escaped, low, seatSp, spDiff: a.regs.sp - b.regs.sp };
}

/** Data cells the oracle moves from a seated state, ignoring the stack scratch. */
function footprint(machine) {
  const a = machine.clone();
  seat(a);
  const before = a.dumpState().slice();
  oracle(a);
  const now = a.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) {
    if (now[i] !== before[i] && a.stateOffsetToAddr(i) <= DATA_TOP) n++;
  }
  return n;
}

function sweep(twin) {
  let caught = 0;
  for (const [, m] of combos()) if (compare(twin, m).escaped) caught++;
  return caught;
}

// ── twins ───────────────────────────────────────────────────────────────────────────────────

function loopTwin(body) {
  return (m) => {
    const { regs, mem8 } = m;
    let record = regs.ix;
    let entryPtr = regs.iy;
    let count = regs.b;
    for (;;) {
      regs.ix = record;
      regs.iy = entryPtr;
      body(m, mem8[record]);
      record = (record + RECORD_STRIDE) & 0xffff;
      entryPtr = (entryPtr + ENTRY_STRIDE) & 0xffff;
      count = (count - 1) & 0xff;
      if (count === 0) break;
    }
  };
}

const noOp = () => {};
const swapServices = loopTwin((m, h) => {
  if (h === 0xff) runOneShotAnimatedObjectSlot(m);
  else if (h !== 0) flyAlongBallisticArc(m);
});
const serviceEmpty = loopTwin((m, h) => {
  if (h === 0xff) flyAlongBallisticArc(m);
  else runOneShotAnimatedObjectSlot(m);
});
function wrongStride(m) {
  const { regs, mem8 } = m;
  let record = regs.ix;
  let entryPtr = regs.iy;
  let count = regs.b;
  for (;;) {
    regs.ix = record;
    regs.iy = entryPtr;
    const h = mem8[record];
    if (h === 0xff) flyAlongBallisticArc(m);
    else if (h !== 0) runOneShotAnimatedObjectSlot(m);
    record = (record + RECORD_STRIDE + 1) & 0xffff;
    entryPtr = (entryPtr + ENTRY_STRIDE) & 0xffff;
    count = (count - 1) & 0xff;
    if (count === 0) break;
  }
}
function oneSlotShort(m) {
  const { regs, mem8 } = m;
  let record = regs.ix;
  let entryPtr = regs.iy;
  let count = (regs.b - 1) & 0xff;
  if (count === 0) return;
  for (;;) {
    regs.ix = record;
    regs.iy = entryPtr;
    const h = mem8[record];
    if (h === 0xff) flyAlongBallisticArc(m);
    else if (h !== 0) runOneShotAnimatedObjectSlot(m);
    record = (record + RECORD_STRIDE) & 0xffff;
    entryPtr = (entryPtr + ENTRY_STRIDE) & 0xffff;
    count = (count - 1) & 0xff;
    if (count === 0) break;
  }
}

const TWINS = [
  ["no-op", noOp, 26],
  ["swap-services", swapServices, 26],
  ["service-empty", serviceEmpty, 19],
  ["wrong-stride", wrongStride, 24],
  ["one-slot-short", oneSlotShort, 18],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────────

test("UNREACHED: neither tape dispatches this address, with a live control", { skip }, () => {
  for (const [label, opts] of [["coin-start", {}], ["attract", { tape: [] }]]) {
    const seen = { [TARGET]: 0, [SEED_SITE]: 0 };
    const m = makeMachine(new Map([[TARGET, (mm) => {
      seen[TARGET]++;
      return oracle(mm);
    }]]), opts);
    const real = m.routines.get(SEED_SITE);
    m.routines.set(SEED_SITE, (mm) => {
      seen[SEED_SITE]++;
      return real(mm);
    });
    m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the ${label} run stopped early: ${m.stoppedBy}`);
    // ★ The zero counts only because the same tap, same run, saw the site that runs this loop.
    assert.ok(seen[SEED_SITE] > 0, `${label}: the control tap fired nothing, so the zero is blind`);
    assert.equal(seen[TARGET], 0, `${label} now dispatches this address; capture plain entries`);
    console.log(`  UNREACHED: ${label} — ${hex4(TARGET)} ${seen[TARGET]}, control ${hex4(SEED_SITE)} ${seen[SEED_SITE]}`);
  }
});

test("SWEEP: every occupancy is memory-equivalent outside the masked stack scratch", { skip }, () => {
  assert.notEqual(entryState(), null, "vacuous: the tape never reached the seeding site");
  let worstLow = 0xffff;
  for (const [label, m] of combos()) {
    const r = compare(candidate, m);
    assert.equal(r.escaped, null, `${label} escaped at ${r.escaped && hex4(r.escaped.addr)}`);
    assert.equal(r.spDiff, 2, `${label}: the oracle pops one return the rewrite does not`);
    worstLow = Math.min(worstLow, r.low);
  }
  // ★ The mask is safe only if its floor never reaches game data.
  assert.ok(worstLow > DATA_TOP, `the stack window ${hex4(worstLow)} reached into game data`);
  // ★ Vacuity guard: occupied banks move data, and different banks move different amounts.
  const empty = footprint(craft([0, 0, 0]));
  const full = footprint(craft([0xff, 0xff, 0xff]));
  assert.equal(empty, 0, "an all-empty bank moved data, so the crafting is not what it claims");
  assert.notEqual(empty, full, "an empty and a full bank move the same data; the pokes are inert");
  console.log(`  SWEEP: 27 occupancies identical; window floor ${hex4(worstLow)}, full bank moves ${full} cells`);
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT on an exact count`, { skip }, () => {
    const caught = sweep(twin);
    assert.ok(expected > 0, `the ${label} twin is not caught at all`);
    assert.equal(caught, expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught} of 27 occupancies`);
  });
}
