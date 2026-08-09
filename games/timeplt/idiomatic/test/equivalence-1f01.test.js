// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1f01 — memory-equivalent to the frozen oracle at ROM 0x1F01.
 * GATE: crafted-entry + corpus. Captured at the real dispatch a turning tape produces, replayed
 * over the whole session, and swept over every era, heading and table index — the branches natural
 * play (era 0 only) never reaches. Masks the 2-byte dead stack slot the oracle's tail pushes.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, COIN_FRAME, START_FRAME, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_1f01 } from "../loc_1f01.js";
import { loc_1f01 as oracle } from "../../translated/loc_1f01.js";
import { fetchTableByte } from "../fetchTableByte.js";
import { scrollWorldAtTheEraPace } from "../scrollWorldAtTheEraPace.js";
import { PLAYER_HEADING, ERA_INDEX, WORLD_SCROLL_X, WORLD_SCROLL_Y } from "../names.js";
import { u8, u16 } from "../../../../core/int.js";

const TARGET = 0x1f01;
const WANTED_HEADING_TABLE = 0x1f2e;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const IN0 = 0xc300;
const IN1 = 0xc320;
const COIN = 0x01;
const START = 0x08;
const FIRE = 0x10;
const COMPASS = [0x01, 0x05, 0x04, 0x06, 0x02, 0x0a, 0x08, 0x09, 0x01, 0x04, 0x02, 0x08];
const HOLD = 8;
const TURN_HOLD = 60;
const TURN_FIRST = 640;
const CORPUS_FRAMES = 1500;

const ERAS = [0, 1, 2, 3, 5, 8, 15];
const INDICES = [0, 1, 2, 3, 5, 8, 13];
const HEADINGS = 256;

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

/** Walk the stick once round the compass while firing — the only input that reaches this entry. */
function turnTape() {
  const tape = [
    { frame: COIN_FRAME, port: IN0, bits: COIN, dur: HOLD },
    { frame: START_FRAME, port: IN0, bits: START, dur: HOLD },
    { frame: TURN_FIRST - HOLD, port: IN1, bits: FIRE, dur: CORPUS_FRAMES },
  ];
  let frame = TURN_FIRST;
  for (const bits of COMPASS) {
    tape.push({ frame, port: IN1, bits, dur: TURN_HOLD });
    frame += TURN_HOLD;
  }
  return tape;
}

const turningMachine = (overrides) => makeMachine(overrides, { tape: turnTape() });

let entry = null;
function entryState() {
  if (entry) return entry;
  const m = turningMachine(new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return oracle(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  if (entry === null) throw new Error("the turning tape never reached this entry");
  return entry;
}

/** Every address the two sides part company on, ignoring the pushed stack slot. */
function ramDiffs(candidate, machine, ignore = new Set()) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  const da = a.dumpState();
  const db = b.dumpState();
  const n = Math.min(da.length, db.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (ignore.has(addr)) continue;
    out.push({ addr, a: da[i], b: db[i] });
  }
  return out;
}

const pushedSlot = (machine) => new Set([u16(machine.regs.sp - 2), u16(machine.regs.sp - 1)]);

/** First divergence outside the pushed slot, or null. */
function unitDiff(candidate, machine) {
  const d = ramDiffs(candidate, machine, pushedSlot(machine));
  return d.length ? d[0] : null;
}

function craftEntry(era, heading, index) {
  const m = entryState().clone();
  m.mem8[ERA_INDEX] = era;
  m.mem8[PLAYER_HEADING] = heading;
  m.regs.a = index;
  return m;
}

function sweep(candidate) {
  let swept = 0;
  let caught = 0;
  for (const era of ERAS) {
    for (let heading = 0; heading < HEADINGS; heading++) {
      for (const index of INDICES) {
        if (unitDiff(candidate, craftEntry(era, heading, index))) caught++;
        swept++;
      }
    }
  }
  return { swept, caught };
}

function replayCorpus(candidate) {
  let dispatches = 0;
  let caught = 0;
  const eras = new Set();
  const m = turningMachine(new Map([[TARGET, (mm) => {
    dispatches++;
    eras.add(mm.mem8[ERA_INDEX] & 0x0f);
    if (unitDiff(candidate, mm)) caught++;
    return oracle(mm);
  }]]));
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `the session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "the session ran short");
  return { dispatches, caught, eras };
}

// ── broken twins ──────────────────────────────────────────────────────────────────────────
// A steering builder with knobs, so each twin is one wrong decision and nothing else.

const stepShort = (delta, step) => (delta >= 128 ? step : -step);

function steering({ rate, chooseStep, snap = true, scroll = true }) {
  return (m) => {
    const { regs, mem8 } = m;
    regs.hl = WANTED_HEADING_TABLE;
    const wanted = fetchTableByte(m);
    const heading = mem8[PLAYER_HEADING];
    if (heading !== wanted) {
      const delta = u8(heading - wanted);
      const step = rate(mem8[ERA_INDEX] & 0x0f);
      if (snap && u8(delta + 1) < 3) mem8[PLAYER_HEADING] = wanted;
      else mem8[PLAYER_HEADING] = u8(heading + chooseStep(delta, step));
    }
    if (scroll) return scrollWorldAtTheEraPace(m);
  };
}

const fastRate = (low) => (low >= 3 ? 4 : 3);

/** BUG: does nothing — neither steers nor scrolls. */
function brokenNoOp() {}
/** BUG: scrolls but never steers, so the heading is one notch stale. */
const brokenSkipSteer = (m) => scrollWorldAtTheEraPace(m);
/** BUG: steers but never scrolls the world to match. */
const brokenSkipScroll = steering({ rate: fastRate, chooseStep: stepShort, scroll: false });
/** BUG: turns the long way round the compass. */
const brokenReverseTurn = steering({ rate: fastRate, chooseStep: (d, s) => -stepShort(d, s) });
/** BUG: ignores the era's fast digit and always turns at the slow rate. */
const brokenAlwaysSlow = steering({ rate: () => 3, chooseStep: stepShort });
/** BUG: steps past the target instead of snapping onto it. */
const brokenNeverSnap = steering({ rate: fastRate, chooseStep: stepShort, snap: false });

const TWINS = [
  ["no-op", brokenNoOp],
  ["skip-steer", brokenSkipSteer],
  ["skip-scroll", brokenSkipScroll],
  ["reverse-turn", brokenReverseTurn],
  ["always-slow", brokenAlwaysSlow],
  ["never-snap", brokenNeverSnap],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("CONTRACT: loc_1f01 == oracle at the real dispatch, outside the pushed slot", { skip }, () => {
  const e = entryState();
  assert.equal(unitDiff(loc_1f01, e), null, "the rewrite diverged at the captured dispatch");
  assert.equal(loc_1f01(e.clone()), undefined, "the live-out is memory-only; it returns nothing");
  console.log(`  CONTRACT: entry sp ${hex4(e.regs.sp)}, heading ${e.mem8[PLAYER_HEADING]}, ` +
    `era ${e.mem8[ERA_INDEX] & 0x0f} — RAM identical`);
});

test("PUSHED SLOT: the whole divergence is the 2 dead stack bytes, and it is real", { skip }, () => {
  const e = entryState();
  const bare = ramDiffs(loc_1f01, e);
  const slot = pushedSlot(e);
  assert.ok(bare.length > 0, "vacuous: the oracle's tail push left no trace, so the mask is idle");
  for (const d of bare) {
    assert.ok(slot.has(d.addr), `a byte outside the pushed slot diverged at ${hex4(d.addr)}`);
  }
  // ★ the mask sits above every cell this routine writes, so it cannot hide a real change.
  for (const cell of [PLAYER_HEADING, WORLD_SCROLL_X, WORLD_SCROLL_Y]) {
    assert.ok(!slot.has(cell), `${hex4(cell)} fell inside the mask`);
  }
  console.log(`  PUSHED SLOT: ${bare.length} bytes differ, all within ${[...slot].map(hex4).join(",")}`);
});

test("CORPUS: every real dispatch of the turning session replays identically", { skip }, () => {
  const r = replayCorpus(loc_1f01);
  assert.ok(r.dispatches > 0, "vacuous: the tape never reached the routine");
  assert.equal(r.caught, 0, `the rewrite diverged on ${r.caught} of ${r.dispatches} real dispatches`);
  console.log(`  CORPUS: ${r.dispatches} dispatches identical; eras seen ${[...r.eras].join(",")}`);
});

test("SWEEP: every era, heading and index is identical — the arms no tape drives", { skip }, () => {
  const r = sweep(loc_1f01);
  assert.equal(r.caught, 0, `the rewrite diverged on ${r.caught} of ${r.swept} crafted entries`);
  console.log(`  SWEEP: ${r.swept} crafted entries identical across ${ERAS.length} eras`);
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const crafted = sweep(twin);
    const corpus = replayCorpus(twin);
    assert.ok(crafted.caught + corpus.caught > 0, `every gate PASSED the ${label} twin`);
    console.log(`  TEETH/${label}: caught on ${crafted.caught}/${crafted.swept} crafted, ` +
      `${corpus.caught}/${corpus.dispatches} real`);
  });
}
