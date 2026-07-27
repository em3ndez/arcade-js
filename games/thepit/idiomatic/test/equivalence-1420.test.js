// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for stepObjectFromControl (ROM 0x1420) — the per-frame object
 * dispatcher's last arm: it either defers the object's move (when a reaction animation owns
 * the frame) by staging the deferral record, or picks the move command (the demo's steering
 * while the attract demo runs, the debounced joystick in real play) and hands it to the
 * per-frame update dispatcher.
 *
 * OBSERVABLE-EQUIVALENCE CONTRACT. The routine writes no RAM of its own — every effect is
 * produced by a delegated handler (the deferral-record staging, or the per-frame update
 * dispatcher). The idiomatic version calls the already-decompiled handlers
 * (stageObjectSpriteRecord, loc_1434) DIRECTLY instead of tail-jumping through the Z80
 * registry; the oracle reaches them by tail-jump. A tail-jump only READS the return address
 * off the stack, so no stack-scratch byte ever differs and RAM is diffed in full with no
 * exclusion window. pc, SP and the dead value registers are excluded (the caller tail-jumps
 * here and reads none of them back).
 *
 * REACHABILITY. Attract dispatches BOTH live arms: the reaction-defer arm (reaction byte
 * set) and the demo-steer arm (reaction clear, game mode 3+). Only the joystick arm never
 * occurs — it needs real play (game mode < 3) — so it is gated on a real captured entry with
 * the game-mode byte poked below 3; the dispatcher reads only work RAM, so a real state with
 * that one input adjusted is a faithful entry for the unreached arm.
 *
 * Checks:
 *   0. HARNESS — capture real 0x1420 entries in attract, confirm both live arms appear, and
 *      confirm the oracle run is deterministic (oracle vs oracle -> identical whole state).
 *   1. EQUAL (real entries) — stepObjectFromControl == oracle over the full RAM dump on every
 *      captured entry (both the defer arm and the demo-steer arm).
 *   2. EQUAL (crafted joystick arm) — with the game-mode byte poked below 3 on a reaction-
 *      clear entry, the routine feeds the joystick to the dispatcher, identical to the oracle.
 *   3. TEETH (wrong input source) — a twin that always feeds the joystick (ignoring game mode)
 *      MUST be caught on a demo-steer entry, where the demo command and the idle joystick differ.
 *   4. TEETH (dropped defer guard) — a twin that skips the reaction guard and dispatches the
 *      move even while a reaction owns the frame MUST be caught on a reaction-active entry.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-1420.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1420 as oracle } from "../../translated/loc_1420.js";
import { stepObjectFromControl as idiomatic } from "../stepObjectFromControl.js";
import { loc_1434 } from "../loc_1434.js";
import { stageObjectSpriteRecord } from "../stageObjectSpriteRecord.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { REACTION_STATE, GAME_MODE, DEMO_STEER_DIR, IN0_DEBOUNCED } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x1420;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is async, so
// build the factory once.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Hook 0x1420 in a real attract run and clone the machine at each of its first `limit`
 * dispatches that pass `keep` — genuine entries (real work RAM, a valid stack with a return
 * address). The wrapper snapshots then runs the oracle so attract proceeds undisturbed.
 */
function captureEntries(maxFrames, limit, keep = () => true) {
  const caps = [];
  const overrides = new Map([[TARGET, (mm) => {
    if (caps.length < limit && keep(mm)) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = makeMachine(overrides);
  host.runFrames(maxFrames);
  return caps;
}

const isDeferArm = (mm) => mm.mem.read8(REACTION_STATE) !== 0;
const isDemoArm = (mm) => mm.mem.read8(REACTION_STATE) === 0;

/**
 * Run oracle and candidate on independent clones of `entry`; return the first differing
 * state byte (null when identical). RAM is diffed in full — the delegated handlers only read
 * the return address off the stack, so there is no stack-scratch window to exclude.
 */
function ramDiff(entry, fn) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  oracle(a);
  fn(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

// -- 0. HARNESS: reachability + determinism -----------------------------------

test("HARNESS: real 0x1420 entries are captured, both live arms appear, and the oracle run is deterministic", () => {
  const caps = captureEntries(2500, 60);
  assert.ok(caps.length >= 1, "expected 0x1420 to be dispatched during attract");
  assert.ok(caps.some(isDeferArm), "expected the reaction-defer arm to occur in attract");
  assert.ok(caps.some(isDemoArm), "expected the demo-steer arm to occur in attract");

  const entry = caps[0];
  const a = entry.clone();
  oracle(a);
  const b = entry.clone();
  oracle(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, d && `oracle run not deterministic: diff at ${hx(d.addr ?? 0)}`);
  console.log(
    `  HARNESS: captured ${caps.length} real 0x1420 entries ` +
      `(${caps.filter(isDeferArm).length} defer, ${caps.filter(isDemoArm).length} demo-steer); oracle deterministic`,
  );
});

// -- 1. EQUAL over real captured attract entries ------------------------------

test("EQUAL (real entries): stepObjectFromControl leaves the same RAM as the oracle over every captured entry", () => {
  const caps = captureEntries(2500, 60);
  assert.ok(caps.length >= 1, "expected at least one captured entry");
  for (const cap of caps) {
    const d = ramDiff(cap, idiomatic);
    assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`);
  }
  console.log(`  EQUAL/real: ${caps.length} real attract entries — full RAM identical to the oracle`);
});

// -- 2. EQUAL on the crafted (unreached) joystick arm -------------------------

test("EQUAL (crafted joystick arm): with game mode < 3 the joystick is dispatched, matching the oracle", () => {
  const [base] = captureEntries(2500, 1, isDemoArm);
  assert.ok(base, "need a reaction-clear entry to craft the joystick arm from");

  const entry = base.clone();
  entry.mem.write8(GAME_MODE, 0); // force real-play input selection (game mode < 3)
  const d = ramDiff(entry, idiomatic);
  assert.equal(d, null, d && `joystick arm: RAM diff at ${hx(d.addr ?? 0)} oracle=${d.a} idiomatic=${d.b}`);
  console.log("  EQUAL/crafted: game mode < 3 dispatches the joystick — full RAM identical to the oracle");
});

// -- 3. TEETH: a wrong input source is caught ---------------------------------

/** Broken twin: always feeds the joystick, ignoring game mode (wrong source in the demo). */
function twinWrongSource(m) {
  const { mem8, regs } = m;
  if (mem8[REACTION_STATE] !== 0) return stageObjectSpriteRecord(m);
  regs.a = mem8[IN0_DEBOUNCED]; // BUG: should be the demo steering when the demo is running
  return loc_1434(m);
}

test("TEETH (wrong input source): feeding the joystick in the demo is CAUGHT", () => {
  const [entry] = captureEntries(2500, 1, isDemoArm);
  assert.ok(entry, "need a demo-steer entry to seed the teeth check");
  assert.equal(entry.mem.read8(REACTION_STATE), 0, "expected a reaction-clear (demo-steer) entry");
  assert.ok(entry.mem.read8(GAME_MODE) >= 3, "expected the demo to be running (game mode >= 3)");
  assert.notEqual(
    entry.mem.read8(DEMO_STEER_DIR),
    entry.mem.read8(IN0_DEBOUNCED),
    "teeth need the demo command and the joystick to differ at this entry",
  );

  const d = ramDiff(entry, twinWrongSource);
  assert.notEqual(d, null, "the gate FAILED to catch the wrong-input-source twin — it proves nothing");
  assert.equal(ramDiff(entry, idiomatic), null, "idiomatic must pass the entry the twin fails");
  console.log(`  TEETH/wrong-source: caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

// -- 4. TEETH: dropping the reaction defer guard is caught --------------------

/** Broken twin: skips the reaction guard and dispatches the move even while a reaction owns the frame. */
function twinNoGuard(m) {
  const { mem8, regs } = m;
  const runningDemo = mem8[GAME_MODE] >= 3;
  regs.a = runningDemo ? mem8[DEMO_STEER_DIR] : mem8[IN0_DEBOUNCED];
  return loc_1434(m); // BUG: no reaction-defer guard, so it never stages the deferral record
}

test("TEETH (dropped defer guard): dispatching the move while a reaction owns the frame is CAUGHT", () => {
  const [entry] = captureEntries(2500, 1, isDeferArm);
  assert.ok(entry, "need a reaction-active entry to seed the teeth check");
  assert.notEqual(entry.mem.read8(REACTION_STATE), 0, "expected a reaction-active (defer) entry");

  const d = ramDiff(entry, twinNoGuard);
  assert.notEqual(d, null, "the gate FAILED to catch the dropped-guard twin — it proves nothing");
  assert.equal(ramDiff(entry, idiomatic), null, "idiomatic must pass the entry the twin fails");
  console.log(`  TEETH/dropped-guard: caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});
