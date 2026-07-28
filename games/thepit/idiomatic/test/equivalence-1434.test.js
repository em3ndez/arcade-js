// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for advanceObjectFrame (ROM 0x1434) — the per-frame object dispatcher that
 * picks which update to run for the tracked object: the at-rest router when the object's
 * mode byte (0x8075) is clear, otherwise one of two walk steppers chosen by the move
 * command's direction bits and the mode byte's sign.
 *
 * OBSERVABLE-EQUIVALENCE CONTRACT. The routine writes no RAM of its own — every effect is
 * produced by the delegated handler. The idiomatic version calls the already-decompiled
 * handlers (routeIdleObjectByMoveCommand, advanceObjectWalkFrame, walkActor) DIRECTLY instead of tail-jumping
 * through the Z80 registry; the oracle reaches them by tail-jump. A tail-jump only READS
 * the return address off the stack, so no stack-scratch byte ever differs and RAM is diffed
 * in full with no exclusion window. pc, SP and the dead value registers are excluded (the
 * caller tail-jumps here and reads none of them back).
 *
 * REACHABILITY. Attract dispatches only the mode-clear arm (286 times over 2500 frames, all
 * with command 0x04 and mode 0). The two walk-stepper arms and the mode-sign arm never
 * occur, so they are gated on real captured entries with the mode byte and the incoming
 * command register poked to force each — the handlers read only work RAM, so a real state
 * with those two inputs adjusted is a faithful entry for the unreached arms.
 *
 * Checks:
 *   0. HARNESS — capture real 0x1434 entries in attract and confirm the oracle run is
 *      deterministic (oracle vs oracle -> identical whole state).
 *   1. EQUAL (real entries) — advanceObjectFrame == oracle over the full RAM dump on every captured
 *      mode-clear entry.
 *   2. EQUAL (crafted arms) — with the mode and command poked to force each of the four
 *      unreached arms, advanceObjectFrame == oracle over full RAM.
 *   3. TEETH (mis-dispatch) — a twin that sends the mode-clear (at-rest) case to a walk
 *      stepper instead of the router MUST be caught by the RAM diff on a real entry.
 *   4. TEETH (corrupt output) — a twin that does the real work then flips the mode byte
 *      MUST be caught at 0x8075.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-1434.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1434 as oracle } from "../../translated/loc_1434.js";
import { advanceObjectFrame as idiomatic } from "../advanceObjectFrame.js";
import { advanceObjectWalkFrame } from "../advanceObjectWalkFrame.js";
import { walkActor } from "../walkActor.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x1434;
const OBJECT_MODE = 0x8075; // the mode byte the dispatcher keys on
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is async, so
// build the factory once.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Hook 0x1434 in a real attract run and clone the machine at each of its first `limit`
 * dispatches — genuine entries (the move command in the accumulator, a valid stack with a
 * return address, real work RAM). The wrapper snapshots then runs the oracle so attract
 * proceeds undisturbed.
 */
function captureEntries(maxFrames, limit) {
  const caps = [];
  const overrides = new Map([[TARGET, (mm) => {
    if (caps.length < limit) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = makeMachine(overrides);
  host.runFrames(maxFrames);
  return caps;
}

/**
 * Run oracle and candidate on independent clones of `entry`; return the first differing
 * state byte (null when identical). RAM is diffed in full — a tail-jump writes nothing to
 * the stack, so there is no stack-scratch window to exclude.
 */
function ramDiff(entry, fn) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  oracle(a);
  fn(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/** Fresh entry clone with the incoming command register and the mode byte poked to force an arm. */
function withArmInputs(base, command, mode) {
  const e = base.clone();
  e.regs.a = command;
  e.mem.write8(OBJECT_MODE, mode);
  return e;
}

// -- 0. HARNESS: reachability + determinism -----------------------------------

test("HARNESS: real 0x1434 entries are captured and the oracle run is deterministic", () => {
  const caps = captureEntries(2500, 40);
  assert.ok(caps.length >= 1, "expected 0x1434 to be dispatched during attract");

  const entry = caps[0];
  const a = entry.clone();
  oracle(a);
  const b = entry.clone();
  oracle(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, d && `oracle run not deterministic: diff at ${hx(d.addr ?? 0)}`);
  console.log(
    `  HARNESS: captured ${caps.length} real 0x1434 entries ` +
      `(SP=${hx(entry.regs.sp)}, command=${hx(entry.regs.a)}, mode=${hx(entry.mem.read8(OBJECT_MODE))}); oracle deterministic`,
  );
});

// -- 1. EQUAL over real captured attract entries ------------------------------

test("EQUAL (real entries): advanceObjectFrame leaves the same RAM as the oracle over every captured entry", () => {
  const caps = captureEntries(2500, 40);
  assert.ok(caps.length >= 1, "expected at least one captured entry");
  for (const cap of caps) {
    const d = ramDiff(cap, idiomatic);
    assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`);
  }
  console.log(`  EQUAL/real: ${caps.length} real attract entries — full RAM identical to the oracle`);
});

// -- 2. EQUAL across the four crafted (unreached) arms ------------------------

test("EQUAL (crafted arms): each forced dispatch arm matches the oracle over full RAM", () => {
  const [base] = captureEntries(2500, 1);
  assert.ok(base, "need a captured entry to craft the unreached arms from");

  // (command, mode, label) forcing each arm the dispatcher can take:
  //   mode 0                          -> at-rest router (also the natural arm)
  //   mode!=0, command bit0 set        -> reference-measured walk stepper
  //   mode!=0, bit0 clear, bit1 set    -> momentum walk stepper
  //   mode!=0, bits0/1 clear, sign set -> reference-measured walk stepper (mode negative)
  //   mode!=0, bits0/1 clear, sign clr -> momentum walk stepper (mode positive)
  const arms = [
    [0x04, 0x00, "at-rest router"],
    [0x01, 0x01, "walk stepper (command bit0)"],
    [0x02, 0x01, "walk stepper (command bit1)"],
    [0x04, 0x80, "walk stepper (mode sign set)"],
    [0x04, 0x01, "walk stepper (mode sign clear)"],
  ];

  for (const [command, mode, label] of arms) {
    const entry = withArmInputs(base, command, mode);
    const d = ramDiff(entry, idiomatic);
    assert.equal(
      d,
      null,
      d && `${label} (command=${hx(command)}, mode=${hx(mode)}): RAM diff at ${hx(d.addr ?? 0)} oracle=${d.a} idiomatic=${d.b}`,
    );
  }
  console.log(`  EQUAL/crafted: all ${arms.length} dispatch arms — full RAM identical to the oracle`);
});

// -- 3. TEETH: a mis-dispatched at-rest case is caught ------------------------

/** Broken twin: routes the mode-clear (at-rest) case to a walk stepper instead of the router. */
function twinMisdispatch(m) {
  const { regs, mem8 } = m;
  const moveCommand = regs.a;
  const mode = mem8[OBJECT_MODE];
  if (mode === 0) return advanceObjectWalkFrame(m); // BUG: should route to the at-rest handler
  if (moveCommand & 0x01) return advanceObjectWalkFrame(m);
  if (moveCommand & 0x02) return walkActor(m);
  if (mode & 0x80) return advanceObjectWalkFrame(m);
  return walkActor(m);
}

test("TEETH (mis-dispatch): sending the at-rest case to a walk stepper is CAUGHT", () => {
  const caps = captureEntries(2500, 40);
  assert.ok(caps.length >= 1, "need a captured mode-clear entry");
  const entry = caps[0];
  assert.equal(entry.mem.read8(OBJECT_MODE), 0, "expected the captured entry to be the mode-clear arm");

  const d = ramDiff(entry, twinMisdispatch);
  assert.notEqual(d, null, "the gate FAILED to catch a mis-dispatched twin — it proves nothing");
  assert.equal(ramDiff(entry, idiomatic), null, "idiomatic must pass the entry the twin fails");
  console.log(`  TEETH/mis-dispatch: caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

// -- 4. TEETH: a corrupted output byte is caught ------------------------------

/** Broken twin: the real routine, then one wrong store to the mode byte. */
function twinCorruptMode(m) {
  idiomatic(m);
  m.mem8[OBJECT_MODE] = m.mem8[OBJECT_MODE] ^ 0xff; // BUG: corrupts the mode byte
}

test("TEETH (corrupt output): a wrong store to the mode byte is CAUGHT at 0x8075", () => {
  const [entry] = captureEntries(2500, 1);
  assert.ok(entry, "need a captured entry to seed the teeth check");

  const d = ramDiff(entry, twinCorruptMode);
  assert.notEqual(d, null, "the gate FAILED to catch a corrupted mode byte — it proves nothing");
  assert.equal(d.addr, OBJECT_MODE, `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(OBJECT_MODE)})`);
  assert.equal(ramDiff(entry, idiomatic), null, "idiomatic must pass the entry the twin fails");
  console.log(`  TEETH/corrupt: wrong mode store caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});
