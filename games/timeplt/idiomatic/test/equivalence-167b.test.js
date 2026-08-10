// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_167b — memory-equivalent to the frozen oracle at ROM 0x167B.
 * GATE: every real coin-start dispatch plus a crafted entry for each of the four branches, on a
 *   MASKED memory diff that hides the body arm's two-byte return-address park (the dropped call to
 *   0x15b6). The register file is dropped; the void return value is asserted; teeth are caught
 *   OUTSIDE the mask, and each twin's caught-arm set is pinned exactly.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-167b.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, COIN_START_TAPE, romsPresent } from "./_harness.js";
import { loc_167b } from "../loc_167b.js";
import { loc_167b as oracle } from "../../translated/loc_167b.js";
import { advanceSequencePhase } from "../advanceSequencePhase.js";
import { hideAllSprites } from "../hideAllSprites.js";
import { startGameOnFreePlay } from "../startGameOnFreePlay.js";

const TARGET = 0x167b;
const CREDIT_COUNT = 0xa986;
const FREE_PLAY = 0xa9c0;
const IN0_MIRROR = 0xa9ae;
const START_BUTTONS = 0x18;
const DATA_TOP = 0xadff;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) =>
  !d ? "identical" : d.addr == null ? `return ${d.a} vs ${d.b}` : `${hex4(d.addr)}: oracle=${d.a} rewrite=${d.b}`;

/** Oracle vs candidate on independent clones, comparing RAM outside the body arm's push window and
 * the return value. The window floor is watched off the frozen side's own pushes. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  const ra = oracle(a);
  const rb = candidate(b);
  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    return { addr, a: da[i], b: db[i] };
  }
  return ra === rb ? null : { addr: null, a: ra, b: rb };
}

/** Bytes the oracle moves from this entry, and where its deepest push reaches. */
function footprint(machine) {
  const a = machine.clone();
  const before = a.dumpState().slice();
  oracle(a);
  const after = a.dumpState();
  let n = 0;
  for (let i = 0; i < after.length; i++) if (after[i] !== before[i]) n++;
  return n;
}

function pushSpan(machine) {
  const a = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  oracle(a);
  return { bytes: seat - low, low };
}

let captured = null;
function captureReal() {
  if (captured) return captured;
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    entries.push(mm.clone());
    return oracle(mm);
  }]]), { tape: COIN_START_TAPE });
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the driven run stopped early: ${m.stoppedBy}`);
  assert.ok(entries.length > 0, "vacuous: the coin-start tape never dispatched this address");
  captured = entries;
  return captured;
}

/** A captured real machine, with the three decision cells poked to force one branch. */
function craft(credit, freePlay, buttons) {
  const m = captureReal()[0].clone();
  m.mem8[CREDIT_COUNT] = credit;
  m.mem8[FREE_PLAY] = freePlay;
  m.mem8[IN0_MIRROR] = buttons;
  return m;
}

const ARMS = {
  A: () => craft(1, 0, 0),
  B: () => craft(0, 0, 0),
  C: () => craft(0, 5, 0),
  D: () => craft(0, 5, START_BUTTONS),
};

// ── broken twins ──────────────────────────────────────────────────────────────────────────

function brokenNoOp() {}

function brokenAlwaysBody(m) {
  hideAllSprites(m);
  return startGameOnFreePlay(m);
}

function brokenSkipHide(m) {
  const { mem8 } = m;
  if (mem8[CREDIT_COUNT] !== 0) return advanceSequencePhase(m);
  if (mem8[FREE_PLAY] === 0) return;
  if ((mem8[IN0_MIRROR] & START_BUTTONS) === 0) return;
  return startGameOnFreePlay(m);
}

function brokenSkipStart(m) {
  const { mem8 } = m;
  if (mem8[CREDIT_COUNT] !== 0) return advanceSequencePhase(m);
  if (mem8[FREE_PLAY] === 0) return;
  if ((mem8[IN0_MIRROR] & START_BUTTONS) === 0) return;
  return hideAllSprites(m);
}

function brokenSkipSeqPhase(m) {
  const { mem8 } = m;
  if (mem8[CREDIT_COUNT] !== 0) return;
  if (mem8[FREE_PLAY] === 0) return;
  if ((mem8[IN0_MIRROR] & START_BUTTONS) === 0) return;
  hideAllSprites(m);
  return startGameOnFreePlay(m);
}

function brokenInvertFreePlay(m) {
  const { mem8 } = m;
  if (mem8[CREDIT_COUNT] !== 0) return advanceSequencePhase(m);
  if (mem8[FREE_PLAY] !== 0) return;
  if ((mem8[IN0_MIRROR] & START_BUTTONS) === 0) return;
  hideAllSprites(m);
  return startGameOnFreePlay(m);
}

const TWINS = [
  ["no-op", brokenNoOp, ["A", "D"]],
  ["always-body", brokenAlwaysBody, ["A", "B", "C"]],
  ["skip-hide", brokenSkipHide, ["D"]],
  ["skip-start", brokenSkipStart, ["D"]],
  ["skip-seq-phase", brokenSkipSeqPhase, ["A"]],
  ["invert-free-play", brokenInvertFreePlay, ["D"]],
];

// ── the gate ──────────────────────────────────────────────────────────────────────────────

test("REAL DISPATCHES: every coin-start dispatch is masked-identical", { skip }, () => {
  const entries = captureReal();
  for (const e of entries) {
    const d = unitDiff(loc_167b, e);
    assert.equal(d, null, `a real dispatch diverged: ${show(d)}`);
  }
  const writing = entries.filter((e) => footprint(e) > 0).length;
  assert.ok(writing > 0, "vacuous: every real dispatch made the oracle write nothing");
  const caught = entries.filter((e) => unitDiff(brokenNoOp, e)).length;
  assert.ok(caught > 0, "the no-op twin escaped every real dispatch, so this arm has no teeth");
  console.log(`  REAL: ${entries.length} dispatches identical, ${writing} writing, no-op caught on ${caught}`);
});

test("CRAFTED ARMS: all four branches masked-identical, writing arms write", { skip }, () => {
  for (const [name, make] of Object.entries(ARMS)) {
    assert.equal(unitDiff(loc_167b, make()), null, `arm ${name} diverged`);
  }
  assert.equal(footprint(ARMS.A()), 2, "arm A no longer steps the sequence phase pair");
  assert.ok(footprint(ARMS.D()) > 2, "arm D no longer hides sprites and starts a game");
  assert.equal(footprint(ARMS.B()), 0, "arm B is a bare return and must write nothing");
  assert.equal(footprint(ARMS.C()), 0, "arm C is a bare return and must write nothing");
  console.log(`  ARMS: A/B/C/D identical; footprints ${footprint(ARMS.A())}/${footprint(ARMS.B())}/${footprint(ARMS.C())}/${footprint(ARMS.D())}`);
});

test("SP WINDOW: only the body arm parks, exactly two bytes above the data", { skip }, () => {
  for (const name of ["A", "B", "C"]) {
    assert.equal(pushSpan(ARMS[name]()).bytes, 0, `arm ${name} pushed onto the stack`);
  }
  const span = pushSpan(ARMS.D());
  assert.equal(span.bytes, 2, `the body arm no longer parks exactly two bytes (${span.bytes})`);
  assert.ok(span.low > DATA_TOP, `the push window ${hex4(span.low)} reached into game data`);
  console.log(`  SP WINDOW: body arm parks 2 bytes at ${hex4(span.low)}, above the data`);
});

test("LIVE-OUT: memory only — every arm returns undefined on both sides", { skip }, () => {
  for (const [name, make] of Object.entries(ARMS)) {
    assert.equal(oracle(make()), undefined, `arm ${name} oracle returned a value`);
    assert.equal(loc_167b(make()), undefined, `arm ${name} rewrite returned a value`);
  }
  console.log("  LIVE-OUT: memory only; all four arms return undefined");
});

for (const [label, twin, arms] of TWINS) {
  test(`TEETH: the ${label} twin is caught on exactly ${arms.join("/")}`, { skip }, () => {
    const caught = Object.keys(ARMS).filter((name) => unitDiff(twin, ARMS[name]()));
    assert.deepEqual(caught, arms, `the ${label} twin's caught-arm set moved`);
    console.log(`  TEETH/${label}: caught on ${caught.join(", ") || "nothing"}`);
  });
}
