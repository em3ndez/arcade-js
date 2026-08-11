// SPDX-License-Identifier: GPL-3.0-only
/**
 * meterCoinageTowardCreditOnEdge — memory-equivalent to the frozen oracle at ROM 0x4911. Both tapes DO dispatch it (~1165
 * times each) but always with the selector/phase cells at zero, so every real entry takes the first
 * ret nz and is a no-op; the crafted cross forces the phase gate open to exercise the sound request,
 * the counter bump, the low/high stepping and the credit-and-coin tail. RAM compared with the dead
 * stack scratch below the seated SP masked out (the oracle pushes and rets, the rewrite neither), the
 * +2 SP re-seat and the return checked. Registers are not compared: the dissolved tail does not
 * reproduce the register dance and the caller consumes none.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-4911.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { meterCoinageTowardCreditOnEdge as candidate } from "../meterCoinageTowardCreditOnEdge.js";
import { loc_4911 as oracle } from "../../translated/loc_4911.js";
import { requestCoinSound } from "../requestCoinSound.js";
import { awardCoinCreditThenPulseCoinCounter as award } from "../awardCoinCreditThenPulseCoinCounter.js";

const TARGET = 0x4911;
const SELECTOR = 0xa9ae;
const PHASE = 0xa9ca;
const TICK = 0xa982;
const LOW = 0xa9cb;
const HIGH = 0xa9cc;
const FREE_PLAY = 0xa9c0;
const CREDIT = 0xa986;

const STEP = 0x10;
const GATE_OPEN = 0x02; // selector bit that rotates a 1 into an all-zero phase cell
const DATA_TOP = 0xadff; // every game cell sits at or below here; the stack seats far above it

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── the masked comparison ─────────────────────────────────────────────────────────────────────

function compare(cand, machine) {
  const seat = machine.regs.sp;
  const a = machine.clone();
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  const retO = oracle(a);
  const b = machine.clone();
  let retC, threw = null;
  try { retC = cand(b); } catch (e) { threw = String(e).slice(0, 60); }
  if (threw) return { escaped: { addr: null, o: "returned", c: threw }, low, seat, spDiff: null };
  const da = a.dumpState(), db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue; // dead stack scratch the oracle leaves
    escaped = { addr, o: da[i], c: db[i] };
  }
  if (!escaped && retO !== retC) escaped = { addr: null, o: String(retO), c: String(retC) };
  return { escaped, low, seat, spDiff: a.regs.sp - b.regs.sp };
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

const show = (d) => (d ? `${d.addr == null ? "return" : hex4(d.addr)}: oracle=${d.o} rewrite=${d.c}` : "identical");

// ── the real corpus (all no-ops) and the crafted cross that opens the gate ──────────────────────

function captureTape(opts) {
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => { entries.push(mm.clone()); return oracle(mm); }]]), opts);
  const frames = m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, ENTRY_FRAMES, "the capture run ran short");
  return entries;
}

let corpusCache = null;
function corpus() {
  if (!corpusCache) corpusCache = [...captureTape({}), ...captureTape({ tape: [] })];
  return corpusCache;
}

const HIS = [0x00, 0x05, 0x10, 0x2f, 0x33, 0x40, 0x7f, 0x80, 0x90, 0xff];
const LOS = [0x00, 0x05, 0x0f, 0x20, 0xf0, 0xff];
const FPS = [0, 1];
const CRS = [0x00, 0x05, 0x98];

function cross() {
  const base = corpus()[0];
  const out = [];
  for (const hi of HIS) for (const lo of LOS) for (const fp of FPS) for (const cr of CRS) {
    const m = base.clone();
    m.mem8[SELECTOR] = GATE_OPEN; m.mem8[PHASE] = 0x00;
    m.mem8[HIGH] = hi; m.mem8[LOW] = lo; m.mem8[FREE_PLAY] = fp; m.mem8[CREDIT] = cr;
    out.push(m);
  }
  return out;
}

const tailRuns = (m) => m.mem8[HIGH] < ((m.mem8[LOW] + STEP) & 0xff);

// ── the twins ───────────────────────────────────────────────────────────────────────────────

function gate(m) {
  const { regs, mem8 } = m;
  regs.a = mem8[SELECTOR]; regs.rrca(); regs.rrca();
  mem8[PHASE] = regs.rl(mem8[PHASE]);
  return (mem8[PHASE] & 0x07) === 0x01;
}

const brokenNoOp = () => {};

/** BUG: opens the gate but runs no body — no sound, no bump, no stepping, no tail. */
function brokenSkipBody(m) { gate(m); }

/** BUG: bumps nothing, so the counter never advances. */
function brokenNoTick(m) {
  const { regs, mem8 } = m;
  if (!gate(m)) return;
  requestCoinSound(m);
  const s = (mem8[LOW] + STEP) & 0xff; mem8[LOW] = s;
  if (mem8[HIGH] >= s) return;
  regs.c = mem8[HIGH]; mem8[LOW] = (s - ((mem8[HIGH] & 0xf0) + STEP)) & 0xff;
  return award(m);
}

/** BUG: folds the low byte into the credit count instead of the high byte. */
function brokenWrongCreditReg(m) {
  const { regs, mem8 } = m;
  if (!gate(m)) return;
  requestCoinSound(m); mem8[TICK] = (mem8[TICK] + 1) & 0xff;
  const s = (mem8[LOW] + STEP) & 0xff; mem8[LOW] = s;
  if (mem8[HIGH] >= s) return;
  regs.c = mem8[LOW]; mem8[LOW] = (s - ((mem8[HIGH] & 0xf0) + STEP)) & 0xff;
  return award(m);
}

/** BUG: inverts the catch-up branch, so the tail runs when it should stop and vice versa. */
function brokenInvertCatch(m) {
  const { regs, mem8 } = m;
  if (!gate(m)) return;
  requestCoinSound(m); mem8[TICK] = (mem8[TICK] + 1) & 0xff;
  const s = (mem8[LOW] + STEP) & 0xff; mem8[LOW] = s;
  if (mem8[HIGH] < s) return;
  regs.c = mem8[HIGH]; mem8[LOW] = (s - ((mem8[HIGH] & 0xf0) + STEP)) & 0xff;
  return award(m);
}

const TWINS = [
  ["no-op", brokenNoOp, 360],
  ["skip-body", brokenSkipBody, 360],
  ["no-tick", brokenNoTick, 360],
  ["invert-catch", brokenInvertCatch, 342],
  ["wrong-credit-reg", brokenWrongCreditReg, 28],
];

const caughtOver = (twin, set) => set.filter((m) => compare(twin, m).escaped).length;

// ── the gate ──────────────────────────────────────────────────────────────────────────────────

test("CORPUS: every real entry is equivalent, and every one is the phase-gate no-op", { skip }, () => {
  const entries = corpus();
  assert.ok(entries.length > 0, "vacuous: neither tape dispatched the address");
  for (const e of entries) {
    const r = compare(candidate, e);
    assert.equal(r.escaped, null, `a real entry diverged: ${show(r.escaped)}`);
    assert.equal(r.spDiff, 2, "the oracle pops a return the rewrite does not");
    assert.equal(footprint(e), 0, "a real entry moved a byte, so the corpus is no longer all no-ops");
  }
  console.log(`  CORPUS: ${entries.length} real entries identical, all no-ops (selector stays zero)`);
});

test("CROSS: the gate forced open, every crafted state equivalent and moving bytes", { skip }, () => {
  const states = cross();
  let deepest = 0;
  for (const m of states) {
    const r = compare(candidate, m);
    assert.equal(r.escaped, null, `a crafted state diverged: ${show(r.escaped)}`);
    assert.equal(r.spDiff, 2, "the SP re-seat drifted");
    assert.ok(r.low > DATA_TOP, `the mask floor ${hex4(r.low)} reached into game data`);
    assert.ok(footprint(m) > 0, "a crafted state moved nothing, so this arm would pass a no-op");
    deepest = Math.max(deepest, r.seat - r.low);
  }
  console.log(`  CROSS: ${states.length} states identical, mask reaches ${deepest} bytes below seat`);
});

test("PATHS: both post-gate branches are exercised by the cross", { skip }, () => {
  const states = cross();
  const tail = states.filter(tailRuns).length;
  assert.ok(tail > 0 && tail < states.length, "the cross does not straddle the catch-up branch");
  console.log(`  PATHS: ${tail} of ${states.length} run the credit tail, ${states.length - tail} stop at the second return`);
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count`, { skip }, () => {
    const caught = caughtOver(twin, cross());
    assert.ok(caught > 0, `every crafted state PASSED the ${label} twin`);
    assert.equal(caught, expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught}/${cross().length} crafted states`);
  });
}
