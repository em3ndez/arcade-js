// SPDX-License-Identifier: GPL-3.0-only
/**
 * seedSceneryEntriesThenRunScenery — memory-equivalent to the frozen oracle at ROM 0x3117.
 * The frogger standard applies: every register the body touches on the seat arm is dead-after-return
 * scratch — the seat arm hands on to the scenery run, which reseats both cursors before reading
 * either, so RAM is the whole contract and no register is pinned (GENUINE_LIVE_OUTS empty). The
 * captured dispatch drives the seat arm; crafted sentinel-fail entries drive the divert arm, which
 * leaves for the lifted destination that stores through the walked pointer and folds the byte under
 * it — so a wrong pointer shows up as a wrong store, caught on RAM. Both arms drop a tail return and
 * scramble the scratch, so RAM is diffed with the dead stack window masked (its floor measured by
 * watching the oracle's own pushes) and the two-byte drift asserted. Corpus over two tapes, and
 * teeth, with a scratch-not-pinned control beside the RAM measurement.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-3117.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { seedSceneryEntriesThenRunScenery as candidate } from "../seedSceneryEntriesThenRunScenery.js";
import { loc_3117 as oracle } from "../../translated/loc_3117.js";
import { trampolineToLoc_307f } from "../trampolineToLoc_307f.js";
import { runSceneryForEra } from "../runSceneryForEra.js";

const TARGET = 0x3117;
const SENTINEL = 0xad39;
const ERA = 0xad04;
/** Every game cell either arm writes lands at or below here; the scratch floor sits above it. */
const DATA_TOP = 0xadff;
const SEAT_DRIFT = 2;
const CORPUS_FRAMES = 2000;
const DISPATCHES = { coin: 3, attract: 1 };
const SEAT_CELL = 0xaa61; // a cell the seat arm moves and the divert arm leaves alone
const SCRIBBLE_CELL = 0xa5af; // a compared (non-stack) cell the teeth flip to prove the RAM measurement bites

/** The frogger standard: RAM (masked over the frozen side's stack scratch) is the contract, and only
 *  genuine named register live-outs are pinned beside it. This routine has none — the seat arm hands
 *  on to a callee that reseats both cursors, so the body's registers are dead-after-return scratch,
 *  and the divert arm's pointer/byte are proven through the store they drive, not pinned. */
const GENUINE_LIVE_OUTS = [];

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${d.addr == null ? "reg" : hex4(d.addr)}: frozen=${d.a} rewrite=${d.b}` : "identical");

// ── the masked comparison (frogger standard) ────────────────────────────────────────────────────

/**
 * Oracle vs candidate on independent clones. Both arms drop a tail return and scramble the scratch
 * registers, so RAM is diffed outside [low, seat) — low measured by watching the oracle's own pushes.
 * Throw-agreement is required so a faulting arm counts as equal only when both faults land on
 * identical RAM, and only genuine register live-outs are pinned (none here).
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
  let liveOut = null;
  if (!threwA && !threwB) {
    for (const k of GENUINE_LIVE_OUTS) {
      if (a.regs[k] !== b.regs[k]) { liveOut = { addr: null, a: `${k}=${a.regs[k]}`, b: `${k}=${b.regs[k]}` }; break; }
    }
  }
  return { escaped, throwMismatch, liveOut, spDiff: a.regs.sp - b.regs.sp, low, seat };
}
const caught = (r) => r.escaped !== null || r.throwMismatch !== null || r.liveOut !== null;

/** What the oracle leaves in every game cell it moves — addr=value pairs, so two arms that touch
 * different cells read as different footprints. */
function footprint(machine) {
  const a = machine.clone();
  const before = a.dumpState().slice();
  try { oracle(a); } catch { /* a faulting arm still wrote its run before faulting */ }
  const now = a.dumpState();
  const cells = [];
  for (let i = 0; i < now.length; i++) {
    const addr = a.stateOffsetToAddr(i);
    if (now[i] !== before[i] && addr <= DATA_TOP) cells.push(`${addr}=${now[i]}`);
  }
  return cells;
}

// ── the captured entry, and the crafted divert entries ────────────────────────────────────

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

/** The natural sentinel always passes, so the divert arm is reached only by poking it. */
function craft(mutate) {
  const m = seatEntry().clone();
  mutate(m);
  return m;
}
const scenarios = () => [
  { tag: "A-seat", m: seatEntry(), faults: false },
  { tag: "B-divert-byte0", m: craft((m) => { m.mem8[SENTINEL] = 0x00; }), faults: false },
  { tag: "B-divert-byte1", m: craft((m) => { m.mem8[SENTINEL + 1] = 0x07; }), faults: false },
];

// ── twins ─────────────────────────────────────────────────────────────────────────────────

/** The rewrite with one deliberate defect each; every parameter matches the routine by default, and
 * each twin dissolves to the same callees so only the named defect can move the comparison. */
function variant({ shadow = true, tintOff = 0x10, count = 4, stride = 4, transfer = true, divertHlOff = 0 } = {}) {
  return (m) => {
    const { regs, mem8 } = m;
    regs.hl = SENTINEL;
    regs.a = mem8[regs.hl];
    if (regs.a !== 0x68) return (regs.hl = (regs.hl + divertHlOff) & 0xffff, trampolineToLoc_307f(m));
    regs.hl = (regs.hl + 1) & 0xffff;
    regs.a = mem8[regs.hl];
    if (regs.a !== 0x10 && regs.a !== 0x05) return (regs.hl = (regs.hl + divertHlOff) & 0xffff, trampolineToLoc_307f(m));
    regs.hl = 0x316e;
    regs.iy = 0xaa30;
    regs.b = count;
    do {
      const tint = mem8[regs.hl];
      mem8[(regs.iy + 0x31) & 0xffff] = tint;
      if (shadow) mem8[(regs.iy + 0x33) & 0xffff] = (tint + tintOff) & 0xff;
      const shape = mem8[(regs.hl + 1) & 0xffff];
      mem8[regs.iy & 0xffff] = shape;
      mem8[(regs.iy + 2) & 0xffff] = shape;
      regs.hl = (regs.hl + 2) & 0xffff;
      regs.iy = (regs.iy + stride) & 0xffff;
      regs.b = (regs.b - 1) & 0xff;
    } while (regs.b !== 0);
    if (transfer) return runSceneryForEra(m);
  };
}

// ── scratch-not-pinned controls: a register-only twin passes by design; RAM still bites ──────────
const scribbleScratchReg = (m) => { candidate(m); m.regs.b = (m.regs.b + 1) & 0xff; };
const scribbleData = (m) => { candidate(m); m.mem8[SCRIBBLE_CELL] ^= 0xff; };

const TWINS = [
  ["no-op", () => {}, 3],
  ["skip-shadow", variant({ shadow: false }), 1],
  ["wrong-tint", variant({ tintOff: 0x11 }), 1],
  ["one-object-short", variant({ count: 3 }), 1],
  ["wrong-stride", variant({ stride: 5 }), 1],
  ["no-transfer", variant({ transfer: false }), 1],
  ["divert-stale-pointer", variant({ divertHlOff: 1 }), 2],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: identical outside the scratch window", { skip }, () => {
  assert.notEqual(seatEntry(), null, "vacuous: the tape never reached the routine");
  const r = compare(candidate, seatEntry());
  assert.equal(r.escaped, null, `a divergence escaped the scratch window — ${show(r.escaped)}`);
  assert.equal(r.throwMismatch, null, `one side faulted and the other did not — ${show(r.throwMismatch)}`);
  assert.equal(r.liveOut, null, `a pinned live-out diverged — ${show(r.liveOut)}`);
  assert.equal(r.spDiff, SEAT_DRIFT, "the dropped scenery-run return no longer moves the pointer");
  // ★ The mask is safe only because its floor sits above every game cell either arm writes.
  assert.ok(r.low > DATA_TOP, `the scratch floor ${hex4(r.low)} reached into game data`);
  console.log(`  EQUAL: era=${hex4(seatEntry().mem8[ERA])} sp=${hex4(r.seat)} window=[${hex4(r.low)},${hex4(r.seat)}) spDiff ${r.spDiff}`);
});

test("PATHS: the seat arm and the divert arm are each equivalent, and really differ", { skip }, () => {
  const prints = {};
  for (const { tag, m, faults } of scenarios()) {
    const r = compare(candidate, m);
    assert.ok(!caught(r), `${tag} diverged — ${show(r.escaped ?? r.throwMismatch ?? r.liveOut)}`);
    if (!faults) assert.equal(r.spDiff, SEAT_DRIFT, `${tag}: the dropped chain return no longer drifts by two`);
    // ★ Vacuity: the crafted divert entries really leave down the divert arm, not silently fall back
    //   to the seat arm.
    const probe = m.clone();
    const before = probe.mem8[SEAT_CELL];
    oracle(probe);
    const seated = probe.mem8[SEAT_CELL] !== before;
    assert.equal(seated, tag === "A-seat", `${tag}: the oracle ${seated ? "seated" : "diverted"}, against the tag`);
    prints[tag] = footprint(m).join(",");
  }
  assert.notEqual(prints["A-seat"], prints["B-divert-byte0"], "the seat arm and the divert arm move the same cells");
  console.log(`  PATHS: 3 scenarios equivalent; seat moves ${prints["A-seat"].split(",").length} cells`);
});

test("CORPUS: every dispatch of two tapes replays, and all take the seat path", { skip }, () => {
  const run = (opts) => {
    let dispatched = 0;
    let missed = 0;
    let diverted = 0;
    const m = makeMachine(new Map([[TARGET, (mm) => {
      dispatched++;
      if (mm.mem8[SENTINEL] !== 0x68) diverted++;
      if (caught(compare(candidate, mm))) missed++;
      return oracle(mm);
    }]]), opts);
    const frames = m.runFrames(CORPUS_FRAMES);
    assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
    assert.equal(frames.length, CORPUS_FRAMES, "the run ran short");
    return { dispatched, missed, diverted };
  };
  const coin = run({});
  const attract = run({ tape: [] });
  assert.equal(coin.dispatched, DISPATCHES.coin, "the coin-start dispatch count moved");
  assert.equal(attract.dispatched, DISPATCHES.attract, "the attract dispatch count moved");
  assert.ok(attract.dispatched > 0, "vacuous: attract never reached the routine");
  assert.equal(coin.missed + attract.missed, 0, "the rewrite diverged on a real dispatch");
  assert.equal(coin.diverted + attract.diverted, 0, "a natural dispatch now fails the sentinel, so the divert arm is no longer crafted-only");
  console.log(`  CORPUS: coin ${coin.dispatched}, attract ${attract.dispatched}, all seat path, identical`);
});

test("SCRATCH NOT PINNED: a register-only twin passes; a RAM scribble is caught", { skip }, () => {
  // No genuine register live-outs, so a twin that only scribbles a scratch register after the routine
  // is DELIBERATELY not flagged — and the same measurement must still catch a scribbled RAM cell, or
  // the clean read on the register twin would be worthless. Runs on the returning (non-fault) arms.
  const states = scenarios().filter((s) => !s.faults).map((s) => s.m);
  for (const s of states) {
    assert.ok(!caught(compare(scribbleScratchReg, s)),
      "a scratch-register scribble was flagged, but this routine has no genuine register live-outs to pin");
    const r = compare(scribbleData, s);
    assert.ok(caught(r), "the RAM measurement missed a scribbled cell, so it has no teeth");
    assert.notEqual(r.escaped, null, "the RAM scribble must be caught on a cell, not a register");
  }
  console.log(`  SCRATCH NOT PINNED: register twin ignored; RAM twin caught on all ${states.length}`);
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
