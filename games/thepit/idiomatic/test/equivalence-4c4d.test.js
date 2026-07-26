// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for enableSound / loc_4c4d (ROM 0x4c4d) — switch the master
 * sound-enable control line on (unmute the audio).
 *
 * This routine writes NO work RAM: its whole effect is one control line — the
 * sound-enable bit of the addressable control latch — driven high. That line is
 * NOT part of the RAM state dump (it lives in the I/O device, which clone() carries
 * separately), so the contract here EXTENDS the usual RAM + pc + SP check with the
 * control-latch byte. Without that extension the gate would be blind to the one
 * thing the routine does, and its teeth would have nothing to bite. Value registers
 * are the declared-dead live-out and excluded: the loaded value the mirror pair
 * leaves behind is never read (every caller's next act is another call).
 *
 *   0. IDENTITY — run the unit gate with both arms = the oracle; EQUAL proves the
 *      harness wiring (construct-with-override -> host run -> capture -> clone ->
 *      diff) works on The Pit at all.
 *   1. EQUAL (real dispatch) — hook 0x4c4d in a real boot run and, for each capture,
 *      run the oracle on one clone and enableSound on another, confirming identical
 *      RAM + pc + SP + control latch. Proves enableSound touches ONLY the
 *      sound-enable line (no stray write) on the real surrounding state.
 *   2. EQUAL (forced-off entry) — clear the sound-enable line on the captured entry,
 *      then confirm oracle and enableSound agree on the contract AND both leave the
 *      line HIGH. This is what proves it RAISES the line, not merely re-reads a
 *      line that was already high.
 *   3. TEETH — a mute twin (drives the line low, the mirror routine 0x4c47's effect)
 *      MUST be caught by the control-line compare on the real dispatch.
 *
 * The idiomatic routine models its return as a plain JS return (no stack modelling),
 * so the contract check performs one m.ret() on the candidate clone AFTER the call
 * to line pc + SP up with the oracle (which rets internally).
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4c4d.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4c4d as oracle } from "../../translated/loc_4c4d.js";
import { enableSound } from "../enableSound.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x4c4d;
const SOUND_ENABLE = 1 << 3; // control-latch bit 3 = the master sound-enable line
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/**
 * Hook 0x4c4d in a real boot run and clone the machine at up to K real dispatches.
 * The wrapper snapshots the entry state, then runs the oracle so the host game
 * proceeds undisturbed. Cold-boot init (loc_01a4) dispatches it in the first frame.
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

/** First differing RAM byte between two machines (or null). */
function firstRamDiff(a, b) {
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/** Force the sound-enable line LOW on a machine (in place). */
function forceSoundOff(m) {
  m.io.writeControlLatch(3, 0);
  return m;
}

/**
 * Compare a candidate against the oracle over the memory-equivalence contract for
 * one entry: RAM + pc + SP + the control-latch byte (which carries the sound-enable
 * line and is NOT in the RAM dump). Value registers are the declared-dead live-out
 * and excluded. The oracle rets internally; the candidate's return is modelled with
 * one m.ret().
 */
function contractDiffs(entry, fn) {
  const o = entry.clone();
  oracle(o);
  const c = entry.clone();
  fn(c);
  c.ret();

  const diffs = [];
  const ram = firstRamDiff(o, c);
  if (ram) diffs.push(`RAM@${hx(ram.addr ?? ram.offset)} oracle=${ram.a} cand=${ram.b}`);
  if (o.pc !== c.pc) diffs.push(`pc oracle=${hx(o.pc)} cand=${hx(c.pc)}`);
  if (o.regs.sp !== c.regs.sp) diffs.push(`SP oracle=${hx(o.regs.sp)} cand=${hx(c.regs.sp)}`);
  if (o.io.latch !== c.io.latch) diffs.push(`latch oracle=${hx(o.io.latch)} cand=${hx(c.io.latch)}`);
  return diffs;
}

/** Broken twin: mute — drives the sound-enable line LOW (the mirror routine 0x4c47). */
function brokenEnableSound(m) {
  m.mem.write8(0xb003, 0); // BUG: should write 1 to RAISE the line, not 0 to mute
}

// -- 0. IDENTITY --------------------------------------------------------------

test("IDENTITY: the unit gate runs on The Pit and reports EQUAL when both arms are the oracle", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, oracle);
  assert.equal(
    res.equal,
    true,
    `gate reported a diff for identical arms: ram=${JSON.stringify(res.ram)} regs=${JSON.stringify(res.regs)}`,
  );
  console.log("  IDENTITY: captured 0x4c4d, cloned, ran oracle vs oracle -> EQUAL");
});

// -- 1. EQUAL (real dispatch) -------------------------------------------------

test("EQUAL (real dispatch): enableSound == oracle on the captured 0x4c4d entry (only the sound line touched)", () => {
  const caps = captureDispatches(8, 400);
  assert.ok(caps.length >= 1, "expected at least one real 0x4c4d dispatch during boot");
  for (const cap of caps) {
    const diffs = contractDiffs(cap, enableSound); // fresh clones inside — cap untouched
    assert.equal(diffs.length, 0, diffs.join("; "));
  }
  console.log(`  EQUAL/real: ${caps.length} captured dispatch(es) identical over RAM+pc+SP+latch`);
});

// -- 2. EQUAL (forced-off entry) ----------------------------------------------

test("EQUAL (forced-off entry): enableSound raises the muted line exactly like the oracle", () => {
  const cap = captureDispatches(1, 400)[0];
  assert.ok(cap, "expected a real 0x4c4d dispatch to seed the forced-off entry");

  const off = forceSoundOff(cap.clone());
  assert.equal(off.io.latch & SOUND_ENABLE, 0, "sanity: the entry starts with the sound line low");

  const diffs = contractDiffs(off, enableSound);
  assert.equal(diffs.length, 0, `forced-off entry diverged: ${diffs.join("; ")}`);

  // And confirm the line was actually RAISED (not a re-read of an already-high line).
  const after = off.clone();
  enableSound(after);
  assert.equal(after.io.latch & SOUND_ENABLE, SOUND_ENABLE, "enableSound did not raise the sound-enable line");
  console.log("  EQUAL/forced-off: muted line raised identically to the oracle");
});

// -- 3. TEETH -----------------------------------------------------------------

test("TEETH: the mute twin (drives the line low) is CAUGHT by the control-line compare", () => {
  const caps = captureDispatches(4, 400);
  assert.ok(caps.length >= 1, "need a real capture to seed the teeth check");

  let caught = false;
  let firstDiff = "";
  for (const cap of caps) {
    const diffs = contractDiffs(cap, brokenEnableSound);
    if (diffs.length > 0) { caught = true; firstDiff = diffs[0]; break; }
  }
  assert.ok(caught, "the mute twin ESCAPED the contract — the gate is worthless");
  assert.match(firstDiff, /^latch /, "the mute twin must be caught by the control-line (latch) compare");
  console.log(`  TEETH: mute twin caught (${firstDiff})`);
});
