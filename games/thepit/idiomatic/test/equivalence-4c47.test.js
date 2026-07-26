// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for disableSound (ROM 0x4c47) — pulls the sound-enable control
 * line (control-latch bit 3) low, silencing the audio.
 *
 * This routine's whole effect lands in the HARDWARE control latch, NOT in work RAM:
 * it writes 0 to 0xb003, which clears latch bit 3. That byte is not part of the
 * state dump the pixel gate diffs, so a RAM-only comparison sees NOTHING here — it
 * would pass an implementation that did the exact opposite. The contract therefore
 * compares RAM + pc + SP (to prove nothing STRAY is touched) AND the control latch
 * itself (the real effect). The value registers the oracle leaves behind are the
 * declared-dead live-out and are dropped (both boot callers' next act is another
 * call, so nothing reads them).
 *
 *   0. IDENTITY — run the unit gate with both arms = the oracle; EQUAL proves the
 *      harness wiring (construct-with-override -> host run -> capture -> clone ->
 *      diff) works on The Pit and reaches 0x4c47 at all.
 *   1. EQUAL (real dispatch) — hook 0x4c47 in a real boot run; for each capture run
 *      the oracle on one clone and disableSound on another, confirming identical
 *      RAM + pc + SP AND identical control latch. Proves no stray write and that the
 *      sound line ends where the oracle leaves it, on the real surrounding state.
 *   2. EQUAL (sound-on entry) — pre-set the sound-enable line on the captured entry
 *      (both sides), then confirm oracle and disableSound agree over the full
 *      contract AND that the line really ends LOW. This is what proves it MUTES,
 *      not merely re-reads an already-muted line.
 *   3. TEETH — a twin that drives the line HIGH instead (the enable value — a
 *      plausible copy of the twin routine 0x4c4d) MUST be caught on the sound-on
 *      entry. It is invisible to a RAM-only diff (asserted), so this is exactly the
 *      case that justifies putting the control latch in the contract.
 *
 * The idiomatic routine models its return as a plain JS return (no stack modelling),
 * so the contract check performs one m.ret() on the candidate clone AFTER the call to
 * line pc + SP up with the oracle (which rets internally).
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4c47.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4c47 as oracle } from "../../translated/loc_4c47.js";
import { disableSound } from "../disableSound.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x4c47;
const SOUND_ENABLE_MASK = 0x08; // control-latch bit 3 — the sound-enable line
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/**
 * Hook 0x4c47 in a real boot run and clone the machine at up to K real dispatches.
 * The wrapper snapshots the entry state, then runs the oracle so the host game
 * proceeds undisturbed. Round setup (loc_01f9) and the reset epilogue (loc_03be)
 * both call it during boot.
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

/** Pre-set the sound-enable line high (sound ON) on an entry, in place. */
function soundOn(m) {
  m.io.writeControlLatch(3, 1);
  return m;
}

/** True when the sound-enable line reads low (muted). */
function soundIsMuted(m) {
  return (m.io.latch & SOUND_ENABLE_MASK) === 0;
}

/**
 * Compare a candidate against the oracle over the full contract for one entry:
 * RAM + pc + SP + the sound-enable control latch. Value registers are the declared
 * -dead live-out and excluded. The oracle rets internally; the candidate's return is
 * modelled with one m.ret().
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
  if ((o.io.latch & SOUND_ENABLE_MASK) !== (c.io.latch & SOUND_ENABLE_MASK)) {
    diffs.push(`sound-latch oracle=${o.io.latch & SOUND_ENABLE_MASK} cand=${c.io.latch & SOUND_ENABLE_MASK}`);
  }
  return diffs;
}

/** Broken twin: drives the line HIGH (enables sound) instead of low — the OPPOSITE
 *  of what disableSound must do (a plausible copy of the enable twin 0x4c4d). */
function brokenDisableSound(m) {
  m.mem.write8(0xb003, 1); // BUG: 1 SETS the sound-enable line; disable needs 0
}

// -- 0. IDENTITY --------------------------------------------------------------

test("IDENTITY: the unit gate runs on The Pit and reports EQUAL when both arms are the oracle", () => {
  // 0x4c47 is first entered at boot round-setup around frame 531, past the default
  // 240-frame window, so give the harness room to reach it.
  const res = unitEquivalence(makeMachine, TARGET, oracle, oracle, { maxFrames: 700 });
  assert.equal(
    res.equal,
    true,
    `gate reported a diff for identical arms: ram=${JSON.stringify(res.ram)} regs=${JSON.stringify(res.regs)}`,
  );
  console.log("  IDENTITY: captured 0x4c47, cloned, ran oracle vs oracle -> EQUAL");
});

// -- 1. EQUAL (real dispatch, full contract) ----------------------------------

test("EQUAL (real dispatch): disableSound == oracle on the captured 0x4c47 entry (RAM+pc+SP+latch)", () => {
  const caps = captureDispatches(4, 800);
  assert.ok(caps.length >= 1, "expected at least one real 0x4c47 dispatch during boot");
  for (const cap of caps) {
    const diffs = contractDiffs(cap, disableSound); // fresh clones inside — cap untouched
    assert.equal(diffs.length, 0, diffs.join("; "));
  }
  console.log(`  EQUAL/real: ${caps.length} captured dispatch(es) identical over RAM+pc+SP+latch`);
});

// -- 2. EQUAL (sound-on entry) ------------------------------------------------

test("EQUAL (sound-on entry): disableSound mutes the pre-enabled line exactly like the oracle", () => {
  const cap = captureDispatches(1, 800)[0];
  assert.ok(cap, "expected a real 0x4c47 dispatch to seed the sound-on entry");

  const enabled = soundOn(cap.clone());
  assert.ok(!soundIsMuted(enabled), "sanity: the crafted entry has sound ENABLED before the routine runs");

  const diffs = contractDiffs(enabled, disableSound);
  assert.equal(diffs.length, 0, `sound-on entry diverged: ${diffs.join("; ")}`);

  // And confirm the mute actually happened (not a re-read of an already-low line).
  const after = enabled.clone();
  disableSound(after);
  assert.ok(soundIsMuted(after), "disableSound did not pull the sound-enable line low on the sound-on entry");
  console.log("  EQUAL/sound-on: pre-enabled sound line pulled low identically to the oracle");
});

// -- 3. TEETH -----------------------------------------------------------------

test("TEETH: the drives-high twin is CAUGHT on the sound-on entry (and is RAM-invisible)", () => {
  const cap = captureDispatches(1, 800)[0];
  assert.ok(cap, "need a real capture to seed the teeth check");

  const enabled = soundOn(cap.clone());

  // A RAM-only diff CANNOT see this bug (the effect is in the control latch, not the
  // state dump) — confirm that, so it is clear the latch is what carries the teeth.
  const o = enabled.clone(); oracle(o);
  const b = enabled.clone(); brokenDisableSound(b); b.ret();
  assert.equal(firstRamDiff(o, b), null, "sanity: the twin leaves RAM identical — the latch is the only witness");

  // The full contract (latch included) must catch it.
  const diffs = contractDiffs(enabled, brokenDisableSound);
  assert.ok(diffs.length > 0, "the drives-high twin ESCAPED the contract — the gate is worthless");
  assert.ok(
    diffs.some((d) => d.startsWith("sound-latch")),
    `expected the sound-latch to be the witness, got: ${diffs.join("; ")}`,
  );
  console.log(`  TEETH: drives-high twin caught via the control latch (${diffs[0]})`);
});
