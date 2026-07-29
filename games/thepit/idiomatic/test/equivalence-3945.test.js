// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for paceActorCadence (ROM 0x3945, The Pit) — the cadence front
 * end that counts the period-8 timer (0x8112) down one tick, reloads it to 8 on the
 * tick it runs out (a decrement of 1 down to 0), then runs the phase body easeActorToRest.
 *
 * THE CONTRACT — OBSERVABLE RAM (was full-state). paceActorCadence tail-delegates to the
 * phase body easeActorToRest, which USED to tail-jump into the shared record builder at
 * 0x3a4c via m.call; that callee's `ret` popped this whole tail chain's caller
 * return address, so the full register file AND pc/SP reconverged after the handoff
 * and the gate could demand byte-and-register-exact equivalence. That stale call in
 * easeActorToRest has since been DISSOLVED into a DIRECT JS call to stageActorSpriteRecords
 * (equivalence-3968.test.js — PASSING under a RAM-only contract). A direct JS call
 * has no Z80 stack frame: the callee stages the two sprite records but never rets, so
 * it no longer marches SP, sets pc, or leaves the oracle's residual value registers.
 * paceActorCadence imports and calls that dissolved easeActorToRest directly, so those same three —
 * pc, SP and the value register(s) — now diverge from the oracle by construction and
 * are EXCLUDED here.
 *
 * WHY THAT EXCLUSION IS BENIGN, NOT A FUDGE.
 *   1. RAM is byte-identical. The failing full-state diff reported ram=null (the whole
 *      RAM dump matched) with ONLY register `a` (oracle 31 vs idiomatic 240) and
 *      pc/SP differing — pure ABI residue, no observable effect moved.
 *   2. paceActorCadence never touches register `a`: it only reads/writes the timer byte
 *      (0x8112) in RAM and then delegates. So its register live-out is IDENTICAL to
 *      easeActorToRest's, whose already-accepted RAM-only contract declared exactly these
 *      registers dead ("memory-only live-out; nothing downstream reads them before
 *      overwriting them"). The diverged `a` is 0x3a4c's residual, which the idiomatic
 *      stageActorSpriteRecords deliberately does not reproduce ("takes nothing and
 *      returns nothing").
 *   3. The whole reach is a TAIL-JUMP ladder:
 *        loc_312d/updateEnemy2 -> 0x3748 -> advanceOrRebuildTwinActor -> paceActorCadence -> easeActorToRest -> 0x3a4c
 *      Every link is a tail-jump (verified in the translated arms: advanceOrRebuildTwinActor's
 *      `jp nc,0x3945`, paceActorCadence's `jr 0x3968`, easeActorToRest's tail into 0x3a4c). No link
 *      reads the callee's register `a` — each simply transfers control and consumes
 *      nothing — so 0x3a4c's ret unwinds straight to the per-frame movement
 *      dispatcher's caller. That caller reloads the register file next frame and never
 *      reads this pass's residual `a`. The register is genuinely dead; were any caller
 *      to read it this relax would be wrong and the divergence a real bug — it is not.
 *
 * What the routine actually affects is RAM: the timer write here (0x8112) plus the two
 * coordinate writes (0x810a, 0x811b) and the two sprite records the tail builder stages
 * (0x8238, 0x823c). The handoff touches no stack (paceActorCadence->easeActorToRest are `jr` tail-jumps
 * with no push; 0x3a4c only reads its ret address), so no dead stack-scratch window
 * exists to exclude either — the full RAM dump is compared byte-for-byte, strictly
 * stronger than a windowed subset.
 *
 * FOUR checks:
 *   1. WIRING — capture the first natural attract dispatch, run oracle vs idiomatic on
 *      independent clones, and demand identical RAM (pc/SP/registers excluded per the
 *      contract above). Proves the gate runs end to end through the dissolved easeActorToRest
 *      handoff.
 *   2. EQUAL (captured real dispatches) — a spread of real attract entry states, each
 *      run both ways and diffed on the full RAM dump. Covers the count-down and reload
 *      arms as they actually occur in play.
 *   3. EXHAUSTIVE — over all 256 timer-byte values, set the byte identically on both
 *      sides from a real base state and confirm the full RAM dump agrees with the
 *      oracle. Covers the reload tick (counter == 1), the 8-bit wrap edge
 *      (counter == 0 -> 255, never reloads), and every ordinary count-down tick.
 *   4. TEETH — three broken twins (wrong reload value, no tick, no reload) MUST each be
 *      caught on the RAM dump. Each is built on the SAME direct easeActorToRest handoff, so the
 *      only difference the gate sees is the injected timer bug.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3945.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3945 as oracle } from "../../translated/loc_3945.js";
import { paceActorCadence } from "../paceActorCadence.js";
import { easeActorToRest } from "../easeActorToRest.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x3945;
const ENEMY3_TIMER = 0x8112; // the period-8 cadence timer this routine advances
const ENEMY3_X = 0x810a;     // coordinate the phase body may step (downstream effect)
const ENEMY3_TWIN_X = 0x811b;      // the shadow twin the phase body mirrors
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

/**
 * The observable contract: the full RAM dump must be identical. pc, SP and the value
 * registers are EXCLUDED — dissolving easeActorToRest's Z80 tail-ret means the direct callee
 * no longer marches SP, sets pc, or leaves the oracle's dead residual registers (see
 * the header justification: those registers are dead ABI, reloaded next frame and
 * never read by any caller of this tail chain). Returns a diff message, or null when
 * the RAM is byte-for-byte identical.
 */
function observableDiff(a, b) {
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return `RAM@${hx(ram.addr ?? 0)} oracle=${ram.a} other=${ram.b}`;
  return null;
}

// The decremented-with-8-bit-wrap value, for classifying which arm an entry hits.
const decWrap = (c) => (c === 0 ? 255 : c - 1);

// -- 1. WIRING: first natural dispatch, observable RAM equivalence --------------

test("WIRING: paceActorCadence == oracle on the first natural attract dispatch (observable RAM)", () => {
  // The attract demo that drives this mover starts late (first dispatch ~frame 976),
  // so the capture needs a longer run to reach it.
  const [entry] = captureEntries(1200, 1, 1);
  assert.ok(entry, `expected 0x${TARGET.toString(16)} to dispatch during attract`);

  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  paceActorCadence(b);
  const diff = observableDiff(a, b);
  assert.equal(diff, null, diff && `gate reported a RAM diff on the first dispatch: ${diff}`);
  console.log("  WIRING: captured 0x3945, ran oracle vs idiomatic through the dissolved easeActorToRest handoff -> RAM EQUAL");
});

// -- 2. EQUAL on a spread of real captured attract dispatches -------------------

test("EQUAL: paceActorCadence == oracle on real attract dispatches (full RAM dump)", () => {
  const entries = captureEntries(3000, 3, 240);
  assert.ok(entries.length >= 20, `expected many captured dispatches, got ${entries.length}`);

  let reload = 0, countDown = 0;
  for (const cap of entries) {
    const counter = cap.mem.read8(ENEMY3_TIMER);
    if (decWrap(counter) === 0) reload++;
    else countDown++;

    const a = cap.clone();
    const b = cap.clone();
    oracle(a);
    paceActorCadence(b);
    const diff = observableDiff(a, b);
    assert.equal(diff, null, diff && `mismatch on a real attract dispatch (timer=${counter}): ${diff}`);
  }

  // The count-down arm is hit almost every frame; the reload arm only on the run-out
  // tick. Both should have appeared, or the check is hollow.
  assert.ok(countDown > 0, "expected the count-down arm to occur in attract");
  console.log(
    `  EQUAL: ${entries.length} real dispatches identical (full RAM) — ` +
      `count-down=${countDown} reload=${reload}`,
  );
});

// -- 3. EXHAUSTIVE over the whole timer-byte input domain -----------------------

test("EXHAUSTIVE: over all 256 timer values the full RAM dump agrees with the oracle", () => {
  const [base] = captureEntries(1200, 1, 1);
  assert.ok(base, "need a base attract state to sweep from");

  let checked = 0, sawReload = false, sawWrap = false, sawCountDown = false;
  for (let counter = 0; counter < 256; counter++) {
    const a = base.clone();
    const b = base.clone();
    a.mem.write8(ENEMY3_TIMER, counter);
    b.mem.write8(ENEMY3_TIMER, counter);
    oracle(a);
    paceActorCadence(b);
    const diff = observableDiff(a, b);
    assert.equal(diff, null, diff && `timer=${counter}: ${diff}`);

    if (counter === 1) sawReload = true;          // decrement 1 -> 0 -> reload to 8
    else if (counter === 0) sawWrap = true;       // decrement 0 -> 255, never reloads
    else sawCountDown = true;
    checked++;
  }

  assert.equal(checked, 256, "must have swept the full timer-byte domain");
  assert.ok(sawReload && sawWrap && sawCountDown, "reload, wrap, and count-down arms must all be swept");
  console.log(`  EXHAUSTIVE: all ${checked} timer values agree on the full RAM dump`);
});

// -- 4. TEETH: broken twins the gate MUST catch --------------------------------
//
// Each twin is built on the SAME direct easeActorToRest handoff as the real routine, so the
// only difference the gate sees is the injected timer bug (which the phase body then
// turns into an observable coordinate/timer RAM difference).

/** Broken twin A: wrong reload value — reloads to 9 instead of 8. */
function brokenReloadValue(m) {
  const { mem } = m;
  const counter = mem.read8(ENEMY3_TIMER);
  const ticked = counter === 0 ? 255 : counter - 1;
  mem.write8(ENEMY3_TIMER, ticked === 0 ? 9 : ticked); // BUG: should reload to 8
  return easeActorToRest(m);
}

/** Broken twin B: never advances the timer — passes the count through unchanged. */
function brokenNoTick(m) {
  return easeActorToRest(m); // BUG: dropped the decrement entirely
}

/** Broken twin C: never reloads — stores 0 on the run-out tick instead of 8. */
function brokenNoReload(m) {
  const { mem } = m;
  const counter = mem.read8(ENEMY3_TIMER);
  const ticked = counter === 0 ? 255 : counter - 1;
  mem.write8(ENEMY3_TIMER, ticked); // BUG: run-out should reload to 8, not stay 0
  return easeActorToRest(m);
}

test("TEETH: three broken twins are all CAUGHT", () => {
  const [base] = captureEntries(1200, 1, 1);
  assert.ok(base, "need a base attract state for teeth");

  // Twin A: bites on the reload tick (counter == 1). Put the coordinate high so the
  // wrong timer (9, not 8) also changes whether the phase body steps it — that turns
  // the timer bug into an observable coordinate difference the RAM dump catches.
  {
    const cap = base.clone();
    cap.mem.write8(ENEMY3_TIMER, 1);
    cap.mem.write8(ENEMY3_X, 200);
    const a = cap.clone(); const b = cap.clone();
    oracle(a); brokenReloadValue(b);
    const diff = observableDiff(a, b);
    assert.notEqual(diff, null, "the gate FAILED to catch the wrong reload value — it is worthless");
    console.log(`  TEETH A (wrong reload value 9): caught (${diff})`);
  }

  // Twin B: bites on any ordinary tick — oracle stores counter-1, twin leaves counter.
  {
    const cap = base.clone();
    cap.mem.write8(ENEMY3_TIMER, 5);
    const a = cap.clone(); const b = cap.clone();
    oracle(a); brokenNoTick(b);
    const diff = observableDiff(a, b);
    assert.notEqual(diff, null, "the gate FAILED to catch the dropped decrement — it is worthless");
    console.log(`  TEETH B (no tick): caught (${diff})`);
  }

  // Twin C: bites on the reload tick — oracle stores 8, twin stores 0.
  {
    const cap = base.clone();
    cap.mem.write8(ENEMY3_TIMER, 1);
    const a = cap.clone(); const b = cap.clone();
    oracle(a); brokenNoReload(b);
    const diff = observableDiff(a, b);
    assert.notEqual(diff, null, "the gate FAILED to catch the missing reload — it is worthless");
    console.log(`  TEETH C (no reload -> 0): caught (${diff})`);
  }
});
