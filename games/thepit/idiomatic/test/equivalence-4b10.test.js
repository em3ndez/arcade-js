// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence gate for disableFrameInterrupt (ROM 0x4b10) — switches the per-frame
 * (vblank) interrupt off by clearing the interrupt-mask control line (control-latch
 * bit 0).
 *
 * This routine's whole effect lands in the HARDWARE control latch, NOT in work RAM:
 * it writes 0 to 0xb000, which clears latch bit 0 (the vblank-interrupt gate the CPU
 * reads as io.nmiMask). That bit is not part of the state dump the pixel gate diffs,
 * so a RAM-only comparison sees NOTHING here — it would pass an implementation that
 * did the exact opposite. The contract therefore compares work RAM (to prove nothing
 * STRAY is touched) AND the interrupt-mask control line itself (the real effect). pc,
 * SP, and the value registers are excluded: the idiomatic layer models its return as
 * a plain JS return and does not preserve the Z80 pc/register trace, and the caller
 * (loc_01a4) reloads the accumulator on its very next instruction, so what the pair
 * leaves in registers is dead.
 *
 * 0x4b10 is dispatched exactly once, at cold boot (loc_01a4 calls it first thing, with
 * the latch already 0), so the harness reaches it a couple of frames into a boot run.
 *
 *   0. IDENTITY — run the unit gate with both arms = the oracle; EQUAL proves the
 *      harness wiring (construct-with-override -> host run -> capture -> clone ->
 *      diff) reaches 0x4b10 at all.
 *   1. EQUAL (real dispatch) — hook 0x4b10 in a real boot run; run the oracle on one
 *      clone and disableFrameInterrupt on another, confirming identical work RAM AND
 *      identical interrupt-mask line. Proves no stray write, on the real boot state.
 *   2. EQUAL (interrupt-enabled entry) — pre-arm the interrupt line on the captured
 *      entry (both sides), then confirm oracle and disableFrameInterrupt agree over the
 *      contract AND that the line really ends OFF. This is what proves it DISABLES, not
 *      merely re-reads an already-off line.
 *   3. TEETH — a twin that ARMS the line instead (the mirror routine 0x4b14's effect)
 *      MUST be caught by the control-line compare. It is invisible to a RAM-only diff
 *      (asserted), so this is exactly the case that justifies putting the control latch
 *      in the contract.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4b10.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4b10 as oracle } from "../../translated/loc_4b10.js";
import { disableFrameInterrupt } from "../disableFrameInterrupt.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x4b10;
const NMI_MASK = 0x01; // control-latch bit 0 — the per-frame (vblank) interrupt line
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/**
 * Hook 0x4b10 in a real boot run and clone the machine at its dispatch. The wrapper
 * snapshots the entry state, then runs the oracle so the host game proceeds. Cold boot
 * (loc_01a4) calls it once, a couple of frames in.
 */
function captureDispatches(K, maxFrames) {
  const caps = [];
  const snapshot = new Map([[TARGET, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(maxFrames);
  return caps;
}

/** First differing work-RAM byte between two machines (or null). */
function firstRamDiff(a, b) {
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/** Pre-arm the per-frame interrupt line (interrupt ON) on an entry, in place. */
function interruptOn(m) {
  m.io.writeControlLatch(0, 1);
  return m;
}

/** True when the per-frame interrupt line reads off. */
function interruptIsOff(m) {
  return (m.io.latch & NMI_MASK) === 0;
}

/**
 * Compare a candidate against the oracle over the contract for one entry: work RAM +
 * the interrupt-mask control line. pc, SP, and the value registers are excluded — the
 * idiomatic routine models its return as a plain JS return and leaves the registers as
 * dead scratch. Returns { diffs, ram } (diffs empty == EQUAL).
 */
function contractDiffs(entry, fn) {
  const o = entry.clone();
  oracle(o);
  const c = entry.clone();
  fn(c);

  const diffs = [];
  const ram = firstRamDiff(o, c);
  if (ram) diffs.push(`RAM@${hx(ram.addr ?? ram.offset)} oracle=${ram.a} cand=${ram.b}`);
  if ((o.io.latch & NMI_MASK) !== (c.io.latch & NMI_MASK)) {
    diffs.push(`nmi-latch oracle=${o.io.latch & NMI_MASK} cand=${c.io.latch & NMI_MASK}`);
  }
  return { diffs, ram };
}

/** Broken twin: ARMS the line (enables the interrupt) instead of clearing it — the
 *  OPPOSITE of what disableFrameInterrupt must do (a plausible copy of the mirror
 *  routine 0x4b14). */
function brokenArmsTheLine(m) {
  m.mem8[0xb000] = 1; // BUG: 1 ARMS the interrupt line; disable needs 0
}

// -- 0. IDENTITY --------------------------------------------------------------

test("IDENTITY: the unit gate runs on The Pit and reports EQUAL when both arms are the oracle", () => {
  // 0x4b10 is dispatched a couple of frames into boot; a small window reaches it.
  const res = unitEquivalence(makeMachine, TARGET, oracle, oracle, { maxFrames: 5 });
  assert.equal(
    res.equal,
    true,
    `gate reported a diff for identical arms: ram=${JSON.stringify(res.ram)} regs=${JSON.stringify(res.regs)}`,
  );
  console.log("  IDENTITY: captured 0x4b10, cloned, ran oracle vs oracle -> EQUAL");
});

// -- 1. EQUAL (real dispatch, contract) ---------------------------------------

test("EQUAL (real dispatch): disableFrameInterrupt == oracle on the captured 0x4b10 entry (RAM + latch)", () => {
  const caps = captureDispatches(4, 10);
  assert.ok(caps.length >= 1, "expected the cold-boot 0x4b10 dispatch");
  for (const cap of caps) {
    const { diffs } = contractDiffs(cap, disableFrameInterrupt); // fresh clones inside — cap untouched
    assert.equal(diffs.length, 0, diffs.join("; "));
  }
  console.log(`  EQUAL/real: ${caps.length} captured dispatch(es) identical over work RAM + interrupt-mask line`);
});

// -- 2. EQUAL (interrupt-enabled entry) ---------------------------------------

test("EQUAL (interrupt-enabled entry): disableFrameInterrupt turns the pre-armed line off exactly like the oracle", () => {
  const cap = captureDispatches(1, 10)[0];
  assert.ok(cap, "expected a real 0x4b10 dispatch to seed the interrupt-enabled entry");

  const armed = interruptOn(cap.clone());
  assert.ok(!interruptIsOff(armed), "sanity: the crafted entry has the interrupt ARMED before the routine runs");

  const { diffs } = contractDiffs(armed, disableFrameInterrupt);
  assert.equal(diffs.length, 0, `interrupt-enabled entry diverged: ${diffs.join("; ")}`);

  // And confirm the disable actually happened (not a re-read of an already-off line).
  const after = armed.clone();
  disableFrameInterrupt(after);
  assert.ok(interruptIsOff(after), "disableFrameInterrupt did not drive the interrupt line off on the armed entry");
  console.log("  EQUAL/enabled: pre-armed interrupt line driven off identically to the oracle");
});

// -- 3. TEETH -----------------------------------------------------------------

test("TEETH: the arms-the-line twin is CAUGHT via the control latch (and is RAM-invisible)", () => {
  const cap = captureDispatches(1, 10)[0];
  assert.ok(cap, "need a real capture to seed the teeth check");

  // Seed from an armed entry so the two outcomes (oracle off vs twin on) are unambiguous.
  const armed = interruptOn(cap.clone());

  // A RAM-only diff CANNOT see this bug (the effect is in the control latch, not the
  // state dump) — confirm that, so it is clear the latch is what carries the teeth.
  const o = armed.clone(); oracle(o);
  const b = armed.clone(); brokenArmsTheLine(b);
  assert.equal(firstRamDiff(o, b), null, "sanity: the twin leaves work RAM identical — the latch is the only witness");

  // The full contract (latch included) must catch it.
  const { diffs } = contractDiffs(armed, brokenArmsTheLine);
  assert.ok(diffs.length > 0, "the arms-the-line twin ESCAPED the contract — the gate is worthless");
  assert.ok(
    diffs.some((d) => d.startsWith("nmi-latch")),
    `expected the interrupt-mask line to be the witness, got: ${diffs.join("; ")}`,
  );
  console.log(`  TEETH: arms-the-line twin caught via the control latch (${diffs[0]})`);
});
