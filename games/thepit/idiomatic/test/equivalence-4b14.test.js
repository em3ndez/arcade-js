// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for enableNmi (ROM 0x4b14, The Pit) — the routine that
 * switches the per-frame vblank interrupt ON by setting the NMI-mask bit of the LS259
 * control latch (reached through the 0xb000 I/O port).
 *
 * WHY THE OBSERVABLE STATE ISN'T PLAIN RAM. This routine's only effect is a write to the
 * LS259 control latch — a hardware control line that lives in io.latch, NOT in the
 * work/colour/video/sprite RAM the state dump covers. So the RAM dump is trivially
 * identical for the oracle and any twin, and it is the LATCH that carries the routine's
 * genuine live-out. The gate therefore compares BOTH the RAM dump (to prove no other
 * memory is disturbed) AND the control latch (the real effect); the teeth are caught at
 * the latch.
 *
 * CRAFTED ENTRY + MASK SWEEP. 0x4b14 is never dispatched in a plain attract run — its
 * callers (boot / round setup and the main loop) are not reached, and the per-frame NMI
 * handler re-arms the mask with its own direct write, never through this routine. So,
 * like loc_021c, the gate clones a real attract state captured at a routine that IS
 * reached (loc_3dae, within the first ~100 frames) and runs 0x4b14 from it; the routine
 * has no register live-ins, so any real machine state is a faithful entry. Because
 * "enable" is idempotent, an already-enabled entry would hide both a skipped write and
 * the enable itself, so the gate forces the mask to a known value on both clones before
 * running: cleared (the enable is visible, 0 -> 1), set (idempotent), and as-captured.
 * Forcing the mask is a surgical, identical-both-sides nudge to a real state.
 *
 * CHECKS:
 *   0. HARNESS — a real 0x4b14 dispatch is captured; the oracle run is deterministic
 *      (oracle vs oracle -> identical RAM + latch).
 *   1. EQUAL (as-captured) — enableNmi == oracle over RAM + the latch; the mask ends set.
 *   2. EQUAL (mask forced clear) — from a disabled entry both flip the mask 0 -> 1,
 *      identical; proves the enable actually sets the bit.
 *   3. EQUAL (mask forced set) — from an enabled entry both leave it set, identical
 *      (idempotent).
 *   4. TEETH (disable twin) — a twin that CLEARS the mask instead of setting it is caught
 *      at the latch.
 *   5. TEETH (no-op twin) — a twin that leaves the mask untouched (from a disabled entry)
 *      is caught at the latch.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4b14.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4b14 as oracle } from "../../translated/loc_4b14.js";
import { enableNmi as idiomatic } from "../enableNmi.js";
import { loc_3dae as reachableOracle } from "../../translated/loc_3dae.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) =>
      nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const SEED_AT = 0x3dae; // a leaf reached in attract (~frame 81) — a real state to run 0x4b14 from
const CAPTURE_FRAMES = 240;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture one real attract machine state. 0x4b14 is never dispatched in attract, so hook
 * a routine that IS (loc_3dae) and clone the machine the first time it fires — realistic
 * full RAM, the oracle registry, a live stack, and the NMI mask in its real attract
 * value. Since 0x4b14 reads no register live-ins, this is a faithful entry for it.
 */
function captureSeed(maxFrames) {
  let entry = null;
  const overrides = new Map([
    [SEED_AT, (mm) => {
      if (entry === null) entry = mm.clone();
      return reachableOracle(mm);
    }],
  ]);
  const host = makeMachine(overrides);
  host.runFrames(maxFrames);
  return entry;
}

const ENTRY = ROM_PRESENT ? captureSeed(CAPTURE_FRAMES) : null;

/**
 * The observable-state diff for this routine: the RAM dump (work/colour/video/sprite)
 * AND the control latch, which is where the NMI mask actually lives. Returns the first
 * difference ({kind:"ram"|"latch", ...}) or null when both are identical.
 */
function observableDiff(o, c) {
  const ram = firstStateDiff(o.dumpState(), c.dumpState(), (off) => o.stateOffsetToAddr(off));
  if (ram) return { kind: "ram", ...ram };
  if (o.io.latch !== c.io.latch) return { kind: "latch", a: o.io.latch, b: c.io.latch };
  return null;
}

/**
 * Run the oracle and a candidate on two independent clones of the real captured entry,
 * optionally forcing the NMI-mask bit to a known value on both sides first. Returns the
 * two machines and their observable-state diff.
 */
function runPair(candidate, { mask } = {}) {
  const o = ENTRY.clone();
  const c = ENTRY.clone();
  if (mask !== undefined) {
    o.io.writeControlLatch(0, mask); // bit 0 = the NMI mask, forced identically on both sides
    c.io.writeControlLatch(0, mask);
  }
  oracle(o);
  candidate(c);
  return { o, c, diff: observableDiff(o, c) };
}

// -- 0. HARNESS (reachability + determinism) ---------------------------------

test("HARNESS: a real attract state is captured and the oracle run is deterministic", () => {
  assert.ok(ENTRY, "expected loc_3dae to be dispatched during attract to seed a real entry");
  const a = ENTRY.clone();
  oracle(a);
  const b = ENTRY.clone();
  oracle(b);
  const d = observableDiff(a, b);
  assert.equal(d, null, d && `oracle run not deterministic: ${JSON.stringify(d)}`);
  console.log(
    `  HARNESS: captured a real attract state (latch=${hx(ENTRY.io.latch)}, ` +
      `nmiMask=${ENTRY.io.nmiMask}); oracle run of 0x4b14 deterministic`,
  );
});

// -- 1. EQUAL on the real captured entry, as-is ------------------------------

test("EQUAL (as-captured): enableNmi == oracle over RAM + the control latch", () => {
  const { c, diff } = runPair(idiomatic);
  assert.equal(diff, null, diff && `diverged: ${JSON.stringify(diff)}`);
  assert.equal(c.io.nmiMask, true, "the NMI mask must end enabled");
  console.log("  EQUAL/as-captured: identical over RAM + latch; NMI mask enabled");
});

// -- 2. EQUAL from a disabled entry — the enable is visible (0 -> 1) ----------

test("EQUAL (mask forced clear): the enable flips the mask 0 -> 1, identical to the oracle", () => {
  const { o, c, diff } = runPair(idiomatic, { mask: 0 });
  assert.equal(diff, null, diff && `diverged: ${JSON.stringify(diff)}`);
  assert.equal(o.io.nmiMask, true, "oracle enabled the mask from clear");
  assert.equal(c.io.nmiMask, true, "enableNmi enabled the mask from clear");
  console.log("  EQUAL/clear: both flipped the NMI mask 0 -> 1, identical");
});

// -- 3. EQUAL from an enabled entry — idempotent -----------------------------

test("EQUAL (mask forced set): enabling an already-enabled mask is a no-op, identical", () => {
  const { c, diff } = runPair(idiomatic, { mask: 1 });
  assert.equal(diff, null, diff && `diverged: ${JSON.stringify(diff)}`);
  assert.equal(c.io.nmiMask, true, "the mask stays enabled");
  console.log("  EQUAL/set: idempotent when already enabled, identical");
});

// -- 4. TEETH: a twin that DISABLES instead of enabling ----------------------

/** Broken twin: clears the NMI mask (disables the interrupt) instead of setting it. */
function twinDisable(m) {
  m.mem8[0xb000] = 0; // BUG: 0 clears bit 0 — the interrupt stays off
}

test("TEETH (disable twin): clearing the mask instead of setting it is CAUGHT at the latch", () => {
  const { diff } = runPair(twinDisable, { mask: 0 });
  assert.notEqual(diff, null, "the gate FAILED to catch a mask-clearing twin — it is worthless");
  assert.equal(diff.kind, "latch", `expected a latch diff, got ${JSON.stringify(diff)}`);
  assert.equal(diff.a & 1, 1, "oracle left the NMI mask set");
  assert.equal(diff.b & 1, 0, "the twin left the NMI mask clear");
  console.log(`  TEETH/disable: caught at the latch (oracle=${hx(diff.a)} twin=${hx(diff.b)})`);
});

// -- 5. TEETH: a twin that never touches the mask ----------------------------

/** Broken twin: forgets to enable the interrupt entirely (leaves the mask untouched). */
function twinNoop() {
  // BUG: does nothing — the mask keeps whatever value it entered with.
}

test("TEETH (no-op twin): leaving the mask untouched (from a disabled entry) is CAUGHT at the latch", () => {
  const { diff } = runPair(twinNoop, { mask: 0 });
  assert.notEqual(diff, null, "the gate FAILED to catch a no-op twin — it is worthless");
  assert.equal(diff.kind, "latch", `expected a latch diff, got ${JSON.stringify(diff)}`);
  assert.equal(diff.a & 1, 1, "oracle left the NMI mask set");
  assert.equal(diff.b & 1, 0, "the no-op twin left the NMI mask clear");
  console.log(`  TEETH/no-op: caught at the latch (oracle=${hx(diff.a)} twin=${hx(diff.b)})`);
});
