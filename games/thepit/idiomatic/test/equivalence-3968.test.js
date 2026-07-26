// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_3968 (ROM 0x3968, The Pit) — the per-frame
 * coordinate stepper that, on every fourth cadence tick, eases an actor's
 * coordinate (0x810a) down by one while it is at or above 193 and mirrors the new
 * value plus 16 into the shadow twin (0x811b), then tail-hands to the shared
 * record builder at 0x3a4c.
 *
 * The tail handoff is the key to the contract. loc_3968 ends by running 0x3a4c
 * (still the frozen oracle) on both sides; 0x3a4c overwrites every working register
 * before it reads one and rebuilds its records purely from the two coordinate bytes
 * loc_3968 wrote. So once those two writes match, the full machine — RAM AND the
 * whole register file — reconverges after the handoff. That is why the natural gate
 * below can demand byte-and-register-exact equivalence rather than a declared subset.
 *
 * FOUR checks:
 *   1. WIRING (unitEquivalence) — capture the first natural attract dispatch, run
 *      oracle vs idiomatic on independent clones, and demand identical RAM +
 *      full register file + pc. Proves the gate runs end to end on The Pit and that
 *      the tail handoff reconverges everything.
 *   2. EQUAL (captured real dispatches) — a spread of real attract entry states
 *      (the coordinate walks down from ~240), each run both ways and diffed on the
 *      full state dump + full register file. Covers the step-down and idle arms as
 *      they actually occur in play.
 *   3. EXHAUSTIVE — over all 65,536 (timer, coordinate) combinations, set both bytes
 *      identically on both sides and confirm the two writes (0x810a, 0x811b) match
 *      the oracle. Covers the below-limit arm and the not-a-fourth-tick arm across
 *      the whole input domain, not just the states attract reaches.
 *   4. TEETH — three broken twins (wrong threshold, wrong twin offset, dropped
 *      fourth-tick gate) MUST each be caught.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3968.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3968 as oracle } from "../../translated/loc_3968.js";
import { loc_3968 } from "../loc_3968.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x3968;
const ACTOR_TIMER = 0x8112; // cadence timer — the fourth-tick gate
const ACTOR_X = 0x810a;     // the coordinate stepped down
const TWIN_X = 0x811b;      // the shadow twin (coordinate + 16)
const LIMIT = 193;          // steps down only while at or above this
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture real attract entry states at the target dispatch: run the game with a
 * snapshot-on-entry hook and keep a strided spread of the entry clones (the
 * coordinate walks down over the run, so a spread spans the arms).
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

// -- 1. WIRING: the shared unit gate on the first natural dispatch --------------

test("WIRING: unitEquivalence reports EQUAL on the first natural attract dispatch", () => {
  // The attract demo that drives this mover starts late (first dispatch ~frame 976),
  // so the unit harness needs a longer run than its 240-frame default to reach it.
  const res = unitEquivalence(makeMachine, TARGET, oracle, loc_3968, { maxFrames: 1200 });
  assert.equal(
    res.equal, true,
    `gate reported a diff: ram=${JSON.stringify(res.ram)} regs=${JSON.stringify(res.regs)} pc=${JSON.stringify(res.pc)}`,
  );
  assert.equal(res.ram, null, "RAM must be identical");
  assert.equal(res.regs, null, "the full register file must reconverge after the tail handoff");
  assert.equal(res.pc, null, "pc must be identical");
  console.log("  WIRING: captured 0x3968, ran oracle vs idiomatic through the 0x3a4c handoff -> EQUAL");
});

// -- 2. EQUAL on a spread of real captured attract dispatches -------------------

test("EQUAL: loc_3968 == oracle on real attract dispatches (full RAM + registers)", () => {
  const entries = captureEntries(3000, 3, 240);
  assert.ok(entries.length >= 20, `expected many captured dispatches, got ${entries.length}`);

  let stepDown = 0, idle = 0, belowLimit = 0;
  for (const cap of entries) {
    const timer = cap.mem.read8(ACTOR_TIMER);
    const coord = cap.mem.read8(ACTOR_X);
    if (timer % 4 !== 0) idle++;
    else if (coord >= LIMIT) stepDown++;
    else belowLimit++;

    const a = cap.clone();
    const b = cap.clone();
    oracle(a);
    loc_3968(b);
    const diff = stateAndRegDiff(a, b);
    assert.equal(diff, null, diff && `mismatch on a real attract dispatch (timer=${hx(timer)} coord=${coord}): ${diff}`);
  }

  // Both arms attract actually reaches must have been exercised, or the check is hollow.
  assert.ok(stepDown > 0, "expected the step-down arm to occur in attract");
  assert.ok(idle > 0, "expected the not-a-fourth-tick arm to occur in attract");
  console.log(
    `  EQUAL: ${entries.length} real dispatches identical (RAM+regs) — ` +
      `step-down=${stepDown} idle=${idle} below-limit=${belowLimit}`,
  );
});

// -- 3. EXHAUSTIVE over the whole (timer, coordinate) input domain --------------

test("EXHAUSTIVE: over all 65,536 (timer, coordinate) combos the two writes match the oracle", () => {
  const [entry] = captureEntries(1200, 1, 1);
  assert.ok(entry, "need a base attract state to sweep from");
  const oracleM = entry.clone();
  const idioM = entry.clone();
  // A fixed scratch stack anchor so the tail handoff's return only ever pops a known
  // cell as the routine is re-run in place (its net return would march SP otherwise).
  const SP_ANCHOR = 0x8780;

  let checked = 0, sawStepDown = false, sawBelow = false, sawIdle = false;
  for (let timer = 0; timer < 256; timer++) {
    for (let coord = 0; coord < 256; coord++) {
      for (const mm of [oracleM, idioM]) {
        mm.mem.write8(ACTOR_TIMER, timer);
        mm.mem.write8(ACTOR_X, coord);
        mm.regs.sp = SP_ANCHOR;
      }
      oracle(oracleM);
      loc_3968(idioM);

      for (const addr of [ACTOR_X, TWIN_X]) {
        const o = oracleM.mem.read8(addr);
        const b = idioM.mem.read8(addr);
        if (o !== b) {
          assert.fail(`timer=${hx(timer)} coord=${coord}: ${hx(addr)} differs — oracle=${o} idiomatic=${b}`);
        }
      }
      if (timer % 4 === 0 && coord >= LIMIT) sawStepDown = true;
      else if (timer % 4 === 0) sawBelow = true;
      else sawIdle = true;
      checked++;
    }
  }

  assert.equal(checked, 65536, "must have swept the full (timer, coordinate) domain");
  assert.ok(sawStepDown && sawBelow && sawIdle, "all three arms must have been swept");
  console.log(`  EXHAUSTIVE: all ${checked} (timer, coordinate) combos agree on both writes`);
});

// -- 4. TEETH: broken twins the gate MUST catch --------------------------------

/** Broken twin A: wrong threshold — steps down at 192 too. */
function brokenThreshold(m) {
  const { mem } = m;
  if (mem.read8(ACTOR_TIMER) % 4 === 0) {
    const coord = mem.read8(ACTOR_X);
    if (coord >= 192) { // BUG: should be 193
      const stepped = coord - 1;
      mem.write8(ACTOR_X, stepped);
      mem.write8(TWIN_X, stepped + 16);
    }
  }
  return m.call(0x3a4c);
}

/** Broken twin B: wrong twin offset — trails 15 above instead of 16. */
function brokenOffset(m) {
  const { mem } = m;
  if (mem.read8(ACTOR_TIMER) % 4 === 0) {
    const coord = mem.read8(ACTOR_X);
    if (coord >= 193) {
      const stepped = coord - 1;
      mem.write8(ACTOR_X, stepped);
      mem.write8(TWIN_X, stepped + 15); // BUG: should be +16
    }
  }
  return m.call(0x3a4c);
}

/** Broken twin C: drops the fourth-tick gate — steps down every tick. */
function brokenNoGate(m) {
  const { mem } = m;
  const coord = mem.read8(ACTOR_X); // BUG: no `timer % 4 === 0` guard
  if (coord >= 193) {
    const stepped = coord - 1;
    mem.write8(ACTOR_X, stepped);
    mem.write8(TWIN_X, stepped + 16);
  }
  return m.call(0x3a4c);
}

test("TEETH: three broken twins are all CAUGHT", () => {
  const [entry] = captureEntries(1200, 1, 1);
  assert.ok(entry, "need a base attract state for teeth");

  // Twin A: only bites when coord == 192 on a fourth tick.
  {
    const cap = entry.clone();
    cap.mem.write8(ACTOR_TIMER, 4); // 4 % 4 == 0
    cap.mem.write8(ACTOR_X, 192);
    const a = cap.clone(); const b = cap.clone();
    oracle(a); brokenThreshold(b);
    const diff = stateAndRegDiff(a, b);
    assert.notEqual(diff, null, "the gate FAILED to catch the wrong threshold — it is worthless");
    console.log(`  TEETH A (wrong threshold): caught (${diff})`);
  }

  // Twin B: bites on any step-down (coord >= 193 on a fourth tick).
  {
    const cap = entry.clone();
    cap.mem.write8(ACTOR_TIMER, 4);
    cap.mem.write8(ACTOR_X, 200);
    const a = cap.clone(); const b = cap.clone();
    oracle(a); brokenOffset(b);
    const diff = stateAndRegDiff(a, b);
    assert.notEqual(diff, null, "the gate FAILED to catch the wrong twin offset — it is worthless");
    console.log(`  TEETH B (wrong twin offset): caught (${diff})`);
  }

  // Twin C: bites on a NON-fourth tick with coord >= 193 (oracle idles, twin steps).
  {
    const cap = entry.clone();
    cap.mem.write8(ACTOR_TIMER, 5); // 5 % 4 != 0 -> oracle does nothing
    cap.mem.write8(ACTOR_X, 200);
    const a = cap.clone(); const b = cap.clone();
    oracle(a); brokenNoGate(b);
    const diff = stateAndRegDiff(a, b);
    assert.notEqual(diff, null, "the gate FAILED to catch the dropped fourth-tick gate — it is worthless");
    console.log(`  TEETH C (dropped fourth-tick gate): caught (${diff})`);
  }
});
