// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchCollisionPassByEra — memory-equivalent to the frozen oracle at ROM 0x4E4F, the four-arm era/parity collision
 * dispatcher. GATE: a real corpus (coin-start runs era 0, attract era 1) plus crafted era-4 and even
 * era-1 entries poked from real captures, since neither tape reaches those two arms. Every arm
 * dissolves to a direct import, so the rewrite omits its ret and re-seats SP two bytes low; the RAM
 * diff masks the dead stack scratch below the seat, asserts the +2 drift and the return, and the
 * teeth catch each mis-dispatch on exactly its arms.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-4e4f.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { dispatchCollisionPassByEra as candidate } from "../dispatchCollisionPassByEra.js";
import { loc_4e4f as oracle } from "../../translated/loc_4e4f.js";
import { loc_4f2a } from "../loc_4f2a.js";
import { loc_4f35 } from "../loc_4f35.js";
import { splitCollisionWorkByFrameParity } from "../splitCollisionWorkByFrameParity.js";
import { runAllCollisionSweepsThisFrame } from "../runAllCollisionSweepsThisFrame.js";

const TARGET = 0x4e4f;
const ERA_INDEX = 0xad04;
const FRAME_TICK = 0xa980;
// Every arm's game write lands at or below here; the stack seats far above it, asserted below.
const DATA_TOP = 0xadff;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── the masked comparison ─────────────────────────────────────────────────────────────────

/** Oracle vs candidate on independent clones; the diff excludes [low, seat) — the dead return
 * scratch the oracle's dissolved tail leaves — low watched off the oracle's own pushes. */
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
  const retO = oracle(a);
  const retC = cand(b);
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    escaped = { addr, oracle: da[i], candidate: db[i] };
  }
  return { escaped, low, seat, spDiff: a.regs.sp - b.regs.sp, retO, retC };
}

/** How many game cells the oracle moves from a state — one arm's footprint, for non-vacuity. */
function footprint(machine) {
  const a = machine.clone();
  const before = a.dumpState().slice();
  oracle(a);
  const now = a.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) {
    if (now[i] !== before[i] && a.stateOffsetToAddr(i) <= DATA_TOP) n++;
  }
  return n;
}

/** The cells-and-values the oracle moves, as a string — distinct arms leave distinct signatures. */
function stateSig(machine) {
  const a = machine.clone();
  const before = a.dumpState().slice();
  oracle(a);
  const now = a.dumpState();
  let s = "";
  for (let i = 0; i < now.length; i++) {
    const addr = a.stateOffsetToAddr(i);
    if (addr <= DATA_TOP && now[i] !== before[i]) s += `${addr}:${now[i]};`;
  }
  return s;
}

// ── the corpus and crafted arms ─────────────────────────────────────────────────────────────

let coinStart = null;
let attract = null;
function capture(tape) {
  const arr = [];
  const m = makeMachine(new Map([[TARGET, (mm) => { arr.push(mm.clone()); return oracle(mm); }]]),
    tape === undefined ? {} : { tape });
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the run ran short");
  return arr;
}
const coin = () => (coinStart ??= capture(undefined));
const dark = () => (attract ??= capture([]));

/** How many cells the oracle would move if this entry ran era `era` — used to pick writing arms. */
const writesAsEra = (e, era) => {
  const p = e.clone();
  p.mem8[ERA_INDEX] = era;
  return footprint(p);
};

/** One representative writing entry per arm. era 4 and even era-1 never occur in either tape, so
 * they are poked onto real coin-start captures whose collision RAM makes the chosen arm write. */
function scenarios() {
  const even = coin().find((e) => !(e.mem8[FRAME_TICK] & 1) && footprint(e));
  const odd = coin().find((e) => (e.mem8[FRAME_TICK] & 1) && footprint(e));
  const era1src = coin().find((e) => !(e.mem8[FRAME_TICK] & 1) && writesAsEra(e, 1) > 0);
  const era4src = coin().find((e) => (e.mem8[FRAME_TICK] & 1) && writesAsEra(e, 4) > 0);
  const era1 = era1src.clone(); era1.mem8[ERA_INDEX] = 1;
  const era4 = era4src.clone(); era4.mem8[ERA_INDEX] = 4;
  return [["era0-even", even], ["era0-odd", odd], ["era1", era1], ["era4", era4]];
}

// ── the twins ─────────────────────────────────────────────────────────────────────────────

const dispatchByParity = (m) =>
  (m.mem8[FRAME_TICK] & 1) ? loc_4f35(m) : runAllCollisionSweepsThisFrame(m);

const twinSwapParity = (m) => {
  const era = m.mem8[ERA_INDEX];
  if (era === 4) return loc_4f2a(m);
  if (era === 1) return splitCollisionWorkByFrameParity(m);
  return (m.mem8[FRAME_TICK] & 1) ? runAllCollisionSweepsThisFrame(m) : loc_4f35(m);
};
const twinDropEra1 = (m) => (m.mem8[ERA_INDEX] === 4 ? loc_4f2a(m) : dispatchByParity(m));
const twinDropEra4 = (m) =>
  (m.mem8[ERA_INDEX] === 1 ? splitCollisionWorkByFrameParity(m) : dispatchByParity(m));

const TWINS = [
  ["no-op", () => {}, ["era0-even", "era0-odd", "era1", "era4"]],
  ["always-4f2a", (m) => loc_4f2a(m), ["era0-odd", "era1"]],
  ["always-runAll", (m) => runAllCollisionSweepsThisFrame(m), ["era0-odd", "era1", "era4"]],
  ["swap-parity", twinSwapParity, ["era0-even", "era0-odd"]],
  ["drop-era1", twinDropEra1, ["era1"]],
  ["drop-era4", twinDropEra4, ["era4"]],
];

// ── the gate ──────────────────────────────────────────────────────────────────────────────

test("REACHED: both tapes dispatch this address, and every real entry is equivalent", { skip }, () => {
  for (const [label, corpus] of [["coin-start", coin()], ["attract", dark()]]) {
    assert.ok(corpus.length > 0, `${label} never dispatched this address`);
    let writing = 0;
    for (const e of corpus) {
      const r = compare(candidate, e);
      assert.equal(r.escaped, null, r.escaped && `${label} escaped the mask at ${hex4(r.escaped.addr)}`);
      assert.equal(r.spDiff, 2, `${label}: the oracle pops a return the rewrite does not`);
      assert.equal(r.retO, r.retC, `${label}: the return value diverged`);
      assert.ok(r.low > DATA_TOP, `${label}: the stack window ${hex4(r.low)} reached game data`);
      if (footprint(e) > 0) writing++;
    }
    // ★ The sweep is worth nothing if the oracle writes on none of these entries.
    assert.ok(writing > 0, `${label}: no dispatch makes the oracle write a byte`);
    console.log(`  REACHED: ${label} — ${corpus.length} dispatches identical, ${writing} write`);
  }
});

test("PATHS: every arm is equivalent, re-seats +2, returns the same, and the arms really differ", { skip }, () => {
  const sigs = new Set();
  for (const [label, m] of scenarios()) {
    const r = compare(candidate, m);
    assert.equal(r.escaped, null, `${label} escaped at ${r.escaped && hex4(r.escaped.addr)}`);
    assert.equal(r.spDiff, 2, `${label}: the oracle re-seats two bytes higher and the rewrite does not`);
    assert.equal(r.retO, r.retC, `${label}: the return value diverged`);
    assert.ok(footprint(m) > 0, `${label}: the oracle writes nothing here, so its teeth catch nothing`);
    sigs.add(stateSig(m));
  }
  // ★ Vacuity guard: four arms must leave four distinct states, or a crafted arm did not fire.
  assert.equal(sigs.size, 4, "two arms leave identical state, so a crafted entry did not fire");
  console.log("  PATHS: 4 arms equivalent, +2 each, 4 distinct signatures");
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on exactly its arms`, { skip }, () => {
    const caught = scenarios().filter(([, m]) => compare(twin, m).escaped).map(([n]) => n);
    assert.deepEqual(caught.sort(), [...expected].sort(), `the ${label} twin's caught arms moved`);
    console.log(`  TEETH/${label}: caught on ${caught.join(",") || "(none)"}`);
  });
}
