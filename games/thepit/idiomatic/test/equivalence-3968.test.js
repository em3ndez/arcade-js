// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for easeActorToRest (ROM 0x3968, The Pit) — the per-frame
 * coordinate stepper that, on every fourth cadence tick, eases an actor's
 * coordinate (0x810a) down by one while it is at or above 193 and mirrors the new
 * value plus 16 into the shadow twin (0x811b), then hands off to the shared record
 * builder stageActorSpriteRecords (the decompiled 0x3a4c).
 *
 * THE CONTRACT — OBSERVABLE RAM. easeActorToRest used to tail-JUMP to the 0x3a4c oracle
 * via m.call; the callee's `ret` popped this routine's own caller return address, so
 * the whole register file AND pc/SP reconverged after the handoff and the gate could
 * demand byte-and-register-exact equivalence. That stale call has been dissolved into
 * a DIRECT JS call to stageActorSpriteRecords(m). A JS call has no Z80 stack frame:
 * the direct callee stages the two sprite records but never rets, so it no longer
 * marches SP, sets pc, or leaves the oracle's residual value registers. Those three
 * therefore diverge from the oracle by construction and are EXCLUDED here — they are
 * dead ABI (declared memory-only live-out; nothing downstream reads them before
 * overwriting them) and Z80-return modelling the idiomatic layer deliberately drops.
 *
 * What the routine actually affects is RAM: the two coordinate writes (0x810a,
 * 0x811b) and the two sprite records the tail builder stages from them (0x8238,
 * 0x823c). The handoff touches no stack (0x3a4c only reads its ret address, never
 * pushes), so no dead stack-scratch window exists to exclude either — the full RAM
 * dump is compared byte-for-byte, which is strictly stronger than a windowed subset.
 * (See equivalence-4c5f.test.js for the sibling dissolve where the oracle's register
 * saves DID leave a [SP-4, SP) scratch window that had to be masked.)
 *
 * FOUR checks:
 *   1. WIRING — capture the first natural attract dispatch, run oracle vs idiomatic
 *      on independent clones, and demand identical RAM (pc/SP/registers excluded per
 *      the contract above). Proves the gate runs end to end on The Pit through the
 *      direct stageActorSpriteRecords handoff.
 *   2. EQUAL (captured real dispatches) — a spread of real attract entry states
 *      (the coordinate walks down from ~240), each run both ways and diffed on the
 *      full RAM dump. Covers the step-down and idle arms as they actually occur.
 *   3. EXHAUSTIVE — over all 65,536 (timer, coordinate) combinations, set both bytes
 *      identically on both sides and confirm the two writes (0x810a, 0x811b) match
 *      the oracle. Covers the below-limit arm and the not-a-fourth-tick arm across
 *      the whole input domain, not just the states attract reaches.
 *   4. TEETH — three broken twins (wrong threshold, wrong twin offset, dropped
 *      fourth-tick gate), each built on the SAME direct handoff, MUST each be caught
 *      on the RAM dump.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3968.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3968 as oracle } from "../../translated/loc_3968.js";
import { easeActorToRest } from "../easeActorToRest.js";
import { stageActorSpriteRecords } from "../stageActorSpriteRecords.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

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

/**
 * The observable contract: the full RAM dump must be identical. pc, SP and the value
 * registers are EXCLUDED — dissolving the Z80 tail-ret means the direct callee no
 * longer marches SP, sets pc, or leaves the oracle's dead residual registers. Returns
 * a diff message, or null when the RAM is byte-for-byte identical.
 */
function observableDiff(a, b) {
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return `RAM@${hx(ram.addr ?? 0)} oracle=${ram.a} other=${ram.b}`;
  return null;
}

// -- 1. WIRING: first natural dispatch, observable RAM equivalence --------------

test("WIRING: easeActorToRest == oracle on the first natural attract dispatch (observable RAM)", () => {
  // The attract demo that drives this mover starts late (first dispatch ~frame 976),
  // so the capture needs a longer run to reach it.
  const [entry] = captureEntries(1200, 1, 1);
  assert.ok(entry, `expected 0x${TARGET.toString(16)} to dispatch during attract`);

  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  easeActorToRest(b);
  const diff = observableDiff(a, b);
  assert.equal(diff, null, diff && `gate reported a RAM diff on the first dispatch: ${diff}`);
  console.log("  WIRING: captured 0x3968, ran oracle vs idiomatic through the direct stageActorSpriteRecords handoff -> RAM EQUAL");
});

// -- 2. EQUAL on a spread of real captured attract dispatches -------------------

test("EQUAL: easeActorToRest == oracle on real attract dispatches (full RAM dump)", () => {
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
    easeActorToRest(b);
    const diff = observableDiff(a, b);
    assert.equal(diff, null, diff && `mismatch on a real attract dispatch (timer=${hx(timer)} coord=${coord}): ${diff}`);
  }

  // Both arms attract actually reaches must have been exercised, or the check is hollow.
  assert.ok(stepDown > 0, "expected the step-down arm to occur in attract");
  assert.ok(idle > 0, "expected the not-a-fourth-tick arm to occur in attract");
  console.log(
    `  EQUAL: ${entries.length} real dispatches identical (full RAM) — ` +
      `step-down=${stepDown} idle=${idle} below-limit=${belowLimit}`,
  );
});

// -- 3. EXHAUSTIVE over the whole (timer, coordinate) input domain --------------

test("EXHAUSTIVE: over all 65,536 (timer, coordinate) combos the two writes match the oracle", () => {
  const [entry] = captureEntries(1200, 1, 1);
  assert.ok(entry, "need a base attract state to sweep from");
  const oracleM = entry.clone();
  const idioM = entry.clone();
  // The oracle is re-run in place across the sweep and its tail-ret marches SP, so
  // pin a fixed scratch stack anchor each iteration; the idiomatic side no longer
  // touches SP, but pinning both keeps the two runs starting from identical state.
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
      easeActorToRest(idioM);

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
//
// Each twin is built on the SAME direct stageActorSpriteRecords handoff as the real
// routine, so the only difference the gate sees is the injected coordinate bug.

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
  return stageActorSpriteRecords(m);
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
  return stageActorSpriteRecords(m);
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
  return stageActorSpriteRecords(m);
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
    const diff = observableDiff(a, b);
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
    const diff = observableDiff(a, b);
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
    const diff = observableDiff(a, b);
    assert.notEqual(diff, null, "the gate FAILED to catch the dropped fourth-tick gate — it is worthless");
    console.log(`  TEETH C (dropped fourth-tick gate): caught (${diff})`);
  }
});
