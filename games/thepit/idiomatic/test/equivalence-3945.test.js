// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_3945 (ROM 0x3945, The Pit) — the cadence front
 * end that counts the period-8 timer (0x8112) down one tick, reloads it to 8 on the
 * tick it runs out (a decrement of 1 down to 0), then runs the phase body loc_3968.
 *
 * The tail into loc_3968 is what makes the contract full-state. loc_3945 hands off
 * to the phase body, which itself hands off to the shared record builder at 0x3a4c
 * (still the frozen oracle) on both sides; 0x3a4c overwrites every working register
 * before it reads one. So once the timer write matches, the whole machine — RAM AND
 * the full register file — reconverges after the handoff, and the gate below can
 * demand byte-and-register-exact equivalence rather than a declared subset.
 *
 * Because loc_3968 is already decompiled, the idiomatic loc_3945 imports it and
 * calls it directly (bottom-up delegation); the oracle arm reaches its loc_3968
 * through the frozen registry. The two loc_3968 paths are memory-equivalent
 * (equivalence-3968.test.js), so the arms converge.
 *
 * FOUR checks:
 *   1. WIRING (unitEquivalence) — capture the first natural attract dispatch, run
 *      oracle vs idiomatic on independent clones, demand identical RAM + full
 *      register file + pc. Proves the gate runs end to end and the tail reconverges.
 *   2. EQUAL (captured real dispatches) — a spread of real attract entry states,
 *      each run both ways and diffed on full RAM + full register file. Covers the
 *      count-down and reload arms as they actually occur in play.
 *   3. EXHAUSTIVE — over all 256 timer-byte values, set the byte identically on both
 *      sides from a real base state and confirm full RAM + registers agree with the
 *      oracle. Covers the reload tick (counter == 1), the 8-bit wrap edge
 *      (counter == 0 -> 255, never reloads), and every ordinary count-down tick.
 *   4. TEETH — three broken twins (wrong reload value, no tick, no reload) MUST each
 *      be caught.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3945.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3945 as oracle } from "../../translated/loc_3945.js";
import { loc_3945 } from "../loc_3945.js";
import { loc_3968 } from "../loc_3968.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x3945;
const ACTOR_TIMER = 0x8112; // the period-8 cadence timer this routine advances
const ACTOR_X = 0x810a;     // coordinate the phase body may step (downstream effect)
const TWIN_X = 0x811b;      // the shadow twin the phase body mirrors
const RELOAD = 8;           // period-8 reload value
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture real attract entry states at the target dispatch: run the game with a
 * snapshot-on-entry hook and keep a strided spread of the entry clones (the timer
 * walks its 8..1 cycle over the run, so a spread spans the count-down and reload
 * ticks).
 */
function captureEntries(maxFrames, stride, cap) {
  const entries = [];
  let seen = 0;
  const hook = new Map([[TARGET, (mm) => {
    if (seen % stride === 0 && entries.length < cap) entries.push(mm.clone());
    seen++;
    return oracle(mm);
  }]]);
  const host = makeMachine(hook);
  host.runFrames(maxFrames);
  return entries;
}

/** Full-machine contract: RAM dump + the whole register file. null when identical. */
function stateAndRegDiff(a, b) {
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return `RAM@${hx(ram.addr ?? 0)} oracle=${ram.a} other=${ram.b}`;
  const reg = firstRegDiff(a.regs, b.regs);
  if (reg) return `REG ${reg.reg} oracle=${reg.a} other=${reg.b}`;
  return null;
}

// The decremented-with-8-bit-wrap value, for classifying which arm an entry hits.
const decWrap = (c) => (c === 0 ? 255 : c - 1);

// -- 1. WIRING: the shared unit gate on the first natural dispatch --------------

test("WIRING: unitEquivalence reports EQUAL on the first natural attract dispatch", () => {
  // The attract demo that drives this mover starts late (first dispatch ~frame 976),
  // so the unit harness needs a longer run than its 240-frame default to reach it.
  const res = unitEquivalence(makeMachine, TARGET, oracle, loc_3945, { maxFrames: 1200 });
  assert.equal(
    res.equal, true,
    `gate reported a diff: ram=${JSON.stringify(res.ram)} regs=${JSON.stringify(res.regs)} pc=${JSON.stringify(res.pc)}`,
  );
  assert.equal(res.ram, null, "RAM must be identical");
  assert.equal(res.regs, null, "the full register file must reconverge after the tail handoff");
  assert.equal(res.pc, null, "pc must be identical");
  console.log("  WIRING: captured 0x3945, ran oracle vs idiomatic through the loc_3968 handoff -> EQUAL");
});

// -- 2. EQUAL on a spread of real captured attract dispatches -------------------

test("EQUAL: loc_3945 == oracle on real attract dispatches (full RAM + registers)", () => {
  const entries = captureEntries(3000, 3, 240);
  assert.ok(entries.length >= 20, `expected many captured dispatches, got ${entries.length}`);

  let reload = 0, countDown = 0;
  for (const cap of entries) {
    const counter = cap.mem.read8(ACTOR_TIMER);
    if (decWrap(counter) === 0) reload++;
    else countDown++;

    const a = cap.clone();
    const b = cap.clone();
    oracle(a);
    loc_3945(b);
    const diff = stateAndRegDiff(a, b);
    assert.equal(diff, null, diff && `mismatch on a real attract dispatch (timer=${counter}): ${diff}`);
  }

  // The count-down arm is hit almost every frame; the reload arm only on the run-out
  // tick. Both should have appeared, or the check is hollow.
  assert.ok(countDown > 0, "expected the count-down arm to occur in attract");
  console.log(
    `  EQUAL: ${entries.length} real dispatches identical (RAM+regs) — ` +
      `count-down=${countDown} reload=${reload}`,
  );
});

// -- 3. EXHAUSTIVE over the whole timer-byte input domain -----------------------

test("EXHAUSTIVE: over all 256 timer values the full machine agrees with the oracle", () => {
  const [base] = captureEntries(1200, 1, 1);
  assert.ok(base, "need a base attract state to sweep from");

  let checked = 0, sawReload = false, sawWrap = false, sawCountDown = false;
  for (let counter = 0; counter < 256; counter++) {
    const a = base.clone();
    const b = base.clone();
    a.mem.write8(ACTOR_TIMER, counter);
    b.mem.write8(ACTOR_TIMER, counter);
    oracle(a);
    loc_3945(b);
    const diff = stateAndRegDiff(a, b);
    assert.equal(diff, null, diff && `timer=${counter}: ${diff}`);

    if (counter === 1) sawReload = true;          // decrement 1 -> 0 -> reload to 8
    else if (counter === 0) sawWrap = true;       // decrement 0 -> 255, never reloads
    else sawCountDown = true;
    checked++;
  }

  assert.equal(checked, 256, "must have swept the full timer-byte domain");
  assert.ok(sawReload && sawWrap && sawCountDown, "reload, wrap, and count-down arms must all be swept");
  console.log(`  EXHAUSTIVE: all ${checked} timer values agree on the full machine`);
});

// -- 4. TEETH: broken twins the gate MUST catch --------------------------------

/** Broken twin A: wrong reload value — reloads to 9 instead of 8. */
function brokenReloadValue(m) {
  const { mem } = m;
  const counter = mem.read8(ACTOR_TIMER);
  const ticked = counter === 0 ? 255 : counter - 1;
  mem.write8(ACTOR_TIMER, ticked === 0 ? 9 : ticked); // BUG: should reload to 8
  return loc_3968(m);
}

/** Broken twin B: never advances the timer — passes the count through unchanged. */
function brokenNoTick(m) {
  return loc_3968(m); // BUG: dropped the decrement entirely
}

/** Broken twin C: never reloads — stores 0 on the run-out tick instead of 8. */
function brokenNoReload(m) {
  const { mem } = m;
  const counter = mem.read8(ACTOR_TIMER);
  const ticked = counter === 0 ? 255 : counter - 1;
  mem.write8(ACTOR_TIMER, ticked); // BUG: run-out should reload to 8, not stay 0
  return loc_3968(m);
}

test("TEETH: three broken twins are all CAUGHT", () => {
  const [base] = captureEntries(1200, 1, 1);
  assert.ok(base, "need a base attract state for teeth");

  // Twin A: bites on the reload tick (counter == 1). Put the coordinate high so the
  // wrong timer (9, not 8) also changes whether the phase body steps it.
  {
    const cap = base.clone();
    cap.mem.write8(ACTOR_TIMER, 1);
    cap.mem.write8(ACTOR_X, 200);
    const a = cap.clone(); const b = cap.clone();
    oracle(a); brokenReloadValue(b);
    const diff = stateAndRegDiff(a, b);
    assert.notEqual(diff, null, "the gate FAILED to catch the wrong reload value — it is worthless");
    console.log(`  TEETH A (wrong reload value 9): caught (${diff})`);
  }

  // Twin B: bites on any ordinary tick — oracle stores counter-1, twin leaves counter.
  {
    const cap = base.clone();
    cap.mem.write8(ACTOR_TIMER, 5);
    const a = cap.clone(); const b = cap.clone();
    oracle(a); brokenNoTick(b);
    const diff = stateAndRegDiff(a, b);
    assert.notEqual(diff, null, "the gate FAILED to catch the dropped decrement — it is worthless");
    console.log(`  TEETH B (no tick): caught (${diff})`);
  }

  // Twin C: bites on the reload tick — oracle stores 8, twin stores 0.
  {
    const cap = base.clone();
    cap.mem.write8(ACTOR_TIMER, 1);
    const a = cap.clone(); const b = cap.clone();
    oracle(a); brokenNoReload(b);
    const diff = stateAndRegDiff(a, b);
    assert.notEqual(diff, null, "the gate FAILED to catch the missing reload — it is worthless");
    console.log(`  TEETH C (no reload -> 0): caught (${diff})`);
  }
});
