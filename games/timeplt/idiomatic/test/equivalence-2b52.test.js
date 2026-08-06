// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b52 — memory-equivalent to the frozen oracle at ROM 0x2B52.
 *
 * GATE: crafted-entry over a captured dispatch — and the first thing this file records is
 *   that the SHARED entry budget does not reach the routine at all. Driven by the coin ->
 *   start tape, 0x2B52 is never entered inside ENTRY_FRAMES (1400): the NOT-REACHED arm
 *   calls unitEquivalence exactly as the contract specifies and asserts the throw, so the
 *   hole is a green assertion rather than a missing test. Measured, the first dispatch is
 *   frame 3948, under the second stage, so every other arm here runs the SAME tape to a
 *   file-local REACH_FRAMES = 4000. That budget is a deliberate deviation from the shared
 *   constant, stated here so a reader does not mistake it for the harness contract.
 *
 * LIVE-OUT is memory, read off the CALLERS. All five reach 0x2B52 as a tail transfer, so
 *   its `ret` lands in loc_28A1, which calls the seven slot stubs one after another and
 *   consumes neither A nor the flags; loc_28A1's own caller runs straight on into the next
 *   call of the frame service. A, F and SP are dead, so the cells are the entire effect.
 *
 * The captured first dispatch is a genuine write — two cells, not zero — but it is ONE arm
 *   of two: slot 0xA850 arrives with its delay already at 1, so the strict comparison sees
 *   only the RELEASE path. Three twins that get the ordinary tick wrong sail through it,
 *   and the TEETH arms assert exactly which comparison catches each. That is what the
 *   crafted arms are for, and the assertions below pin it rather than assume it.
 *
 *   1. NOT-REACHED — the contract call at ENTRY_FRAMES throws; the message is asserted.
 *   2. SESSION     — a whole run at REACH_FRAMES completes (stoppedBy null, every frame),
 *                    the routine really dispatches, and every entry is a table slot held
 *                    in the same state code.
 *   3. EQUAL       — strict unit-capture at the real dispatch: RAM byte-identical.
 *   4. FIRST-ARM   — the captured entry is pinned as the release arm, so the reason the
 *                    crafted arms exist stays visible if the capture ever moves.
 *   5. EXCLUDED    — F, SP and pc diverge by design; the moved set is pinned.
 *   6. CRAFTED     — every slot the table carries, crossed with release / tick / wrap.
 *   7. PRIORS      — the delay cell swept 0..255, and the state byte swept 0..255.
 *   8. TEETH       — six twins, each with its catch set PREDICTED and asserted exactly.
 *
 * HOLE: one captured machine. Only the record's own bytes and the base pointer are varied;
 * the rest of RAM is whatever frame 3948 left. The routine reads nothing else, so the two
 * sweeps plus the slot cross-product are its whole input space at that machine.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-2b52.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_2b52 } from "../loc_2b52.js";
import { loc_2b52 as oracle } from "../../translated/loc_2b52.js";
import { firstStateDiff, unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x2b52;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const REACH_FRAMES = 4000;
const SLOT_BYTES = 16;
const RELEASE_DELAY = 14;
const HELD = 254;
/** The seven object records the frame service walks, sixteen bytes apart. */
const SLOTS = [0xa850, 0xa860, 0xa870, 0xa880, 0xa890, 0xa8a0, 0xa8b0];
/** A delay that releases this entry, one mid-count, and one that wraps under zero. */
const DELAYS = [1, 5, 0];
const CASES = SLOTS.flatMap((slot) => DELAYS.map((delay) => [slot, delay]));

let entry = null;

/** The strict gate, with the pristine entry harvested off the candidate arm's clone. */
function strict(candidate) {
  return unitEquivalence(
    makeMachine,
    TARGET,
    oracle,
    (m) => {
      if (entry === null) entry = m.clone();
      return candidate(m);
    },
    { maxFrames: REACH_FRAMES },
  );
}

function entryState() {
  if (entry === null) strict(loc_2b52);
  return entry;
}

const marker = (off) => ((off * 37 + 11) & 0xff) | 1;

/** Load one machine with a held object in `slot`, its other bytes distinct non-zero. */
function paint(mm, slot, state, delay) {
  for (let i = 0; i < SLOT_BYTES; i++) mm.mem8[slot + i] = marker(i);
  mm.mem8[slot] = state;
  mm.mem8[slot + RELEASE_DELAY] = delay;
  mm.regs.ix = slot;
}

/** Oracle vs candidate on two identically painted clones of the captured entry. */
function craftedDiff(candidate, slot, delay, state = HELD) {
  const a = entryState().clone();
  const b = entryState().clone();
  paint(a, slot, state, delay);
  paint(b, slot, state, delay);
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

// ── broken twins, each with the catch set it is PREDICTED to produce ─────────────────────
// A gate that cannot fail is worthless, and a gate whose reach is guessed at is worse. Each
// twin below states which (slot, delay) cases must catch it; the arms assert the predicted
// set exactly, so a twin that starts slipping through somewhere new fails the test.

const tick = (m, slot) => {
  const remaining = (m.mem8[slot + RELEASE_DELAY] - 1) & 0xff;
  m.mem8[slot + RELEASE_DELAY] = remaining;
  return remaining;
};

/** BUG: does nothing. The twin that proves the comparison sees a real dispatch. */
function brokenNoOp() {}

/** BUG: ignores its index register and services one fixed record. */
function brokenFixedSlot(m) {
  if (tick(m, SLOTS[0]) !== 0) return;
  m.mem8[SLOTS[0]] = m.mem8[SLOTS[0]] + 1;
  m.mem8[SLOTS[0] + RELEASE_DELAY] = 128;
}

/** BUG: releases but leaves the delay cell at zero instead of reloading it. */
function brokenNoReload(m, slot = m.regs.ix) {
  if (tick(m, slot) !== 0) return;
  m.mem8[slot] = m.mem8[slot] + 1;
}

/** BUG: releases on every entry rather than only on the one the count runs out. */
function brokenAlwaysReleases(m, slot = m.regs.ix) {
  tick(m, slot);
  m.mem8[slot] = m.mem8[slot] + 1;
  m.mem8[slot + RELEASE_DELAY] = 128;
}

/** BUG: stores a fixed code on release instead of stepping the one that is there. */
function brokenFixedCode(m, slot = m.regs.ix) {
  if (tick(m, slot) !== 0) return;
  m.mem8[slot] = 255;
  m.mem8[slot + RELEASE_DELAY] = 128;
}

/** BUG: counts the byte after the delay cell down. */
function brokenNextCell(m, slot = m.regs.ix) {
  const cell = slot + RELEASE_DELAY + 1;
  const remaining = (m.mem8[cell] - 1) & 0xff;
  m.mem8[cell] = remaining;
  if (remaining !== 0) return;
  m.mem8[slot] = m.mem8[slot] + 1;
  m.mem8[cell] = 128;
}

const TWINS = [
  ["no-op", brokenNoOp, () => true, true],
  ["next-cell", brokenNextCell, () => true, true],
  ["no-reload", brokenNoReload, (slot, delay) => delay === 1, true],
  ["fixed-slot", brokenFixedSlot, (slot) => slot !== SLOTS[0], false],
  ["always-releases", brokenAlwaysReleases, (slot, delay) => delay !== 1, false],
  ["fixed-code", brokenFixedCode, () => false, false],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("NOT-REACHED: the shared entry budget never dispatches the routine", { skip }, () => {
  assert.throws(
    () => unitEquivalence(makeMachine, TARGET, oracle, loc_2b52, { maxFrames: ENTRY_FRAMES }),
    /never entered/,
    `0x2b52 IS reachable within ${ENTRY_FRAMES} frames now — this file's whole reason for ` +
      "running a longer tape has gone, so re-derive it against the shared budget",
  );
  console.log(`  NOT-REACHED: unreached in ${ENTRY_FRAMES} frames; this file runs ${REACH_FRAMES}`);
});

test("SESSION: the run completes and the routine really dispatches", { skip }, () => {
  const seen = [];
  const m = makeMachine(new Map([[TARGET, (mm) => {
    seen.push({ frame: mm.frames.length, slot: mm.regs.ix, state: mm.mem8[mm.regs.ix] });
    return oracle(mm);
  }]]));
  m.runFrames(REACH_FRAMES);

  assert.equal(m.stoppedBy, null, `the session stopped early: ${m.stoppedBy}`);
  assert.equal(m.frames.length, REACH_FRAMES, "a frame did not reach the vblank spin");
  assert.ok(seen.length > 0, `0x2b52 never dispatched within ${REACH_FRAMES} frames`);
  for (const h of seen) {
    assert.ok(SLOTS.includes(h.slot), `entry base ${hex4(h.slot)} is not a table slot`);
    assert.equal(h.state, HELD, `entry at ${hex4(h.slot)} was not in the held state`);
  }
  const bases = [...new Set(seen.map((h) => h.slot))];
  console.log(
    `  SESSION: ${seen.length} dispatches from frame ${seen[0].frame}, ` +
      `${bases.length} distinct slots, all held`,
  );
});

test("EQUAL at the real dispatch: loc_2b52 == oracle on RAM", { skip }, () => {
  const r = strict(loc_2b52);
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  console.log(`  EQUAL: RAM identical at the captured dispatch, slot ${hex4(entry.regs.ix)}`);
});

test("FIRST-ARM: the captured entry is the release arm, not the tick arm", { skip }, () => {
  const e = entryState();
  assert.ok(SLOTS.includes(e.regs.ix), `entry base ${hex4(e.regs.ix)} is not a table slot`);
  assert.equal(e.mem8[e.regs.ix], HELD, "the captured slot is not in the held state");
  assert.equal(
    e.mem8[e.regs.ix + RELEASE_DELAY],
    1,
    "the captured delay is no longer 1, so the strict arm now exercises a different path " +
      "than this file claims — re-derive which twins it catches before trusting the counts",
  );
  console.log(`  FIRST-ARM: slot ${hex4(e.regs.ix)} held with one tick left — it releases`);
});

test("EXCLUDED, deliberately: F, SP and pc move and nothing else does", { skip }, () => {
  const a = entryState().clone();
  const b = entryState().clone();
  paint(a, SLOTS[2], HELD, 5);
  paint(b, SLOTS[2], HELD, 5);
  for (const mm of [a, b]) mm.regs.a = 0x5a;
  oracle(a);
  loc_2b52(b);

  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(moved, ["f", "sp"], "the excluded set changed shape");
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  assert.equal(firstStateDiff(a.dumpState(), b.dumpState()), null, "RAM must still agree");
  console.log(`  EXCLUDED: ${moved.join(", ")} and pc — dead at every caller`);
});

test("CRAFTED: identical on every slot, releasing, ticking and wrapping", { skip }, () => {
  for (const [slot, delay] of CASES) {
    const d = craftedDiff(loc_2b52, slot, delay);
    assert.equal(d, null, `slot ${hex4(slot)} delay ${delay}: ${show(d)}`);

    const after = entryState().clone();
    paint(after, slot, HELD, delay);
    oracle(after);
    const released = delay === 1;
    assert.equal(after.mem8[slot], released ? HELD + 1 : HELD, "the state code went wrong");
    assert.equal(after.mem8[slot + RELEASE_DELAY], released ? 128 : (delay - 1) & 0xff, "delay");
    assert.equal(after.mem8[slot + 1], marker(1), "a neighbouring cell must survive");
  }
  console.log(`  CRAFTED: ${CASES.length} slot/delay cases identical, each really stepped`);
});

test("PRIORS: every delay 0..255 counts down the same way", { skip }, () => {
  for (let delay = 0; delay < 256; delay++) {
    const d = craftedDiff(loc_2b52, SLOTS[5], delay);
    assert.equal(d, null, `delay=${delay}: ${show(d)}`);
  }
  const wrapped = entryState().clone();
  paint(wrapped, SLOTS[5], HELD, 0);
  loc_2b52(wrapped);
  assert.equal(wrapped.mem8[SLOTS[5] + RELEASE_DELAY], 255, "0 must wrap to 255, not release");
  assert.equal(wrapped.mem8[SLOTS[5]], HELD, "a wrap must not touch the state code");
  console.log("  PRIORS: 256 delays identical, including the wrap under zero");
});

test("PRIORS: every state code 0..255 steps on the same way at release", { skip }, () => {
  for (let state = 0; state < 256; state++) {
    const d = craftedDiff(loc_2b52, SLOTS[3], 1, state);
    assert.equal(d, null, `state=${state}: ${show(d)}`);
  }
  const rolled = entryState().clone();
  paint(rolled, SLOTS[3], 255, 1);
  loc_2b52(rolled);
  assert.equal(rolled.mem8[SLOTS[3]], 0, "255 must round to 0, not widen to 256");
  console.log("  PRIORS: 256 state codes identical, including the 255 -> 0 wrap");
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin, predicted, strictCatches] of TWINS) {
  test(`TEETH: the ${label} twin is caught EXACTLY where predicted`, { skip }, () => {
    const missed = [];
    const surprised = [];
    for (const [slot, delay] of CASES) {
      const caught = craftedDiff(twin, slot, delay) !== null;
      if (predicted(slot, delay) && !caught) missed.push(`${hex4(slot)}/${delay}`);
      if (!predicted(slot, delay) && caught) surprised.push(`${hex4(slot)}/${delay}`);
    }
    assert.deepEqual(missed, [], `the ${label} twin slipped through cases it must catch`);
    assert.deepEqual(surprised, [], `the ${label} twin was caught where it should not be`);
    const n = CASES.filter(([s, d]) => predicted(s, d)).length;
    console.log(`  TEETH/${label}: caught on ${n} of ${CASES.length} crafted cases`);
  });

  test(`TEETH: the strict single dispatch ${strictCatches ? "catches" : "MISSES"} ${label}`, { skip }, () => {
    const r = strict(twin);
    assert.equal(
      r.ram !== null,
      strictCatches,
      strictCatches
        ? `the strict gate PASSED the ${label} twin — it has lost its teeth`
        : `the strict gate now CATCHES the ${label} twin — good news, but this file ` +
            "documents the opposite and must be rewritten",
    );
    console.log(`  TEETH/strict/${label}: ${r.ram ? `caught — ${show(r.ram)}` : "missed, as stated"}`);
  });
}

test("TEETH: the sweeps catch the two twins the crafted cases cannot", { skip }, () => {
  let states = 0;
  for (let state = 0; state < 256; state++) {
    if (craftedDiff(brokenFixedCode, SLOTS[3], 1, state)) states++;
  }
  assert.equal(states, 255, "the state sweep must catch the fixed-code twin everywhere but held");
  assert.equal(craftedDiff(brokenFixedCode, SLOTS[3], 1, HELD), null, "held is the one it fits");

  let delays = 0;
  for (let delay = 0; delay < 256; delay++) {
    if (craftedDiff(brokenAlwaysReleases, SLOTS[5], delay)) delays++;
  }
  assert.equal(delays, 255, "the delay sweep must catch the always-releases twin but for one");
  console.log(`  TEETH/sweeps: fixed-code on ${states} states, always-releases on ${delays} delays`);
});
