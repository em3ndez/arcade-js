// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_0347 (ROM 0x0347) — the per-player video-RAM column selector.
 *
 * sub_0347 is a PURE LEAF whose entire observable behaviour is a function of ONE byte,
 * the player selector: it returns the player-1 column base (0x7740) when the selector is
 * 0 and the player-2 column base (0x74e0) for any nonzero selector. It writes NO work
 * RAM and calls nothing; the selected address is its whole contract (the oracle leaves it
 * in a register, the direct-call form returns it). Everything else the oracle touches —
 * the stack pop of its return, its residual accumulator/flags — is the return-plumbing
 * the direct-call model replaces, and none of it reaches RAM. That makes the strongest
 * possible gate available:
 *
 *   1. EQUAL (exhaustive) — loc_0347 == oracle over all 256 selector values, compared on
 *      BOTH halves of the contract: the returned address AND "the oracle wrote no work
 *      RAM" (firstStateDiff of the oracle's post-state against the untouched entry, over
 *      the whole dump). 256 values is the complete input space, so this is a proof, not a
 *      sample.
 *
 *   2. TEETH — deliberately-broken twins the same sweep MUST catch:
 *        (a) inverted-select (columns swapped) — writes no RAM, so it is invisible to the
 *            RAM half and only the RETURN check catches it (at the zero selector). Proves
 *            the return check has teeth.
 *        (b) ignore-selector (always the player-1 column) — caught by the RETURN check at
 *            the first nonzero selector. Proves the sweep exercises the nonzero arm.
 *        (c) a stray work-RAM write fed through the SAME diff the sweep uses to assert the
 *            oracle writes nothing — proves that memory half is not vacuous.
 *
 *   3. REALISM (captured dispatches) — hook 0x0347 in a real attract run (the every-16th-
 *      frame indicator redraw at 0x0315 dispatches it), clone the machine at each true
 *      dispatch, and confirm loc_0347 reproduces the oracle's selected address + no-RAM-
 *      write on every real state. Attract is player 1 (selector 0), so a CRAFTED player-2
 *      arm (force a nonzero selector on the same real state) covers the other column.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-0347.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0347 as oracle } from "../../translated/loc_0347.js";
import { selectPlayerIndicatorColumnBase as loc_0347 } from "../selectPlayerIndicatorColumnBase.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0347;
// The oracle's final return pops the stack; point SP at work RAM so that pop reads valid
// bytes (never I/O) on the synthetic entries below. The oracle writes no RAM through the
// stack, so this choice never affects the compared state — it only keeps it well-defined.
const SAFE_SP = 0x6bf8;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");
const hx16 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

/** A synthetic entry: a clone of `base` with the selector set and a safe, defined stack.
 *  clone() already neutralises the frame machinery (nextNmi/nextBoundary = Infinity);
 *  re-asserted here for clarity so the oracle cannot fire an NMI while running alone. */
function makeEntry(base, selector) {
  const e = base.clone();
  e.regs.a = selector;
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle on a FRESH clone of `entry` and read the two halves of the contract:
 * the selected address it leaves behind, and whether it wrote any work RAM (the diff of
 * its post-state against the untouched entry). A fresh clone because the oracle steps the
 * machine; the untouched clone is the "before" the RAM diff measures against.
 *
 * @returns {{addr: number, ram: object|null}}
 */
function runOracle(entry) {
  const before = entry.clone();
  const after = entry.clone();
  oracle(after);
  const ram = firstStateDiff(before.dumpState(), after.dumpState(), (off) => before.stateOffsetToAddr(off));
  return { addr: after.regs.hl, ram };
}

/**
 * Sweep a candidate (a pure function of the selector) against the oracle over all 256
 * selector values. Compares the returned address AND asserts the oracle wrote no work
 * RAM. Returns the first mismatch (or null) and the count compared.
 */
function sweep(base, candidate) {
  let count = 0;
  for (let v = 0; v < 256; v++) {
    const { addr, ram } = runOracle(makeEntry(base, v));
    const cand = candidate(v);
    count++;
    if (ram || cand !== addr) {
      return { mismatch: { v, ram, addr, cand }, count };
    }
  }
  return { mismatch: null, count };
}

const describeMismatch = (mm) =>
  mm &&
  `at selector=${hx(mm.v)}: ` +
    (mm.ram
      ? `oracle wrote work RAM at 0x${(mm.ram.addr ?? 0).toString(16)} (${mm.ram.a}->${mm.ram.b})`
      : `return oracle=${hx16(mm.addr)} cand=${hx16(mm.cand)}`);

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): loc_0347 == oracle over all 256 selector values", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = sweep(base, loc_0347);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  assert.equal(count, 256, "must have compared all 256 selector values");
  console.log(`  EQUAL/exhaustive: ${count} selector values — returned address identical to the oracle, no RAM writes`);
});

// -- 2. TEETH -----------------------------------------------------------------

/** BUG: swaps the two column bases. Writes no RAM, so only the RETURN check can see it —
 *  and it diverges immediately at the zero selector (oracle 0x7740, twin 0x74e0). */
function brokenInvertedSelect(selector) {
  return selector === 0 ? 0x74e0 : 0x7740;
}

/** BUG: ignores the selector and always returns the player-1 column. Correct at selector
 *  0, wrong at every nonzero selector — caught by the RETURN check on the nonzero arm. */
function brokenIgnoreSelector(_selector) {
  return 0x7740;
}

test("TEETH (exhaustive): the inverted-select twin is CAUGHT (return check has teeth)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = sweep(base, brokenInvertedSelect);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch swapped column bases — the return check is worthless");
  assert.equal(mismatch.ram, null, "this twin writes no RAM; it must be caught by the RETURN check, not RAM");
  console.log(`  TEETH/return-swap: caught after ${count} values — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the ignore-selector twin is CAUGHT (nonzero arm is exercised)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = sweep(base, brokenIgnoreSelector);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a selector-ignoring twin — the nonzero arm is unexercised");
  assert.equal(mismatch.ram, null, "this twin writes no RAM; it must be caught by the RETURN check");
  assert.notEqual(mismatch.v, 0, "the ignore-selector twin is only wrong on a nonzero selector");
  console.log(`  TEETH/return-const: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH: the work-RAM diff has teeth (a stray write is caught)", () => {
  // The routine writes no RAM, so the memory half of the contract is "oracle and
  // candidate both write nothing." This proves the diff the sweep relies on would in
  // fact catch a work-RAM divergence if either side had one.
  const base = new Machine(ROM).clone();
  const before = base.clone();
  const after = base.clone();
  after.mem.write8(0x6009, (after.mem.read8(0x6009) ^ 0xff) & 0xff);
  const ram = firstStateDiff(before.dumpState(), after.dumpState(), (off) => before.stateOffsetToAddr(off));
  assert.notEqual(ram, null, "the work-RAM diff missed a stray byte — the memory half is worthless");
  console.log(`  TEETH/memory: caught a stray work-RAM write at 0x${(ram.addr ?? 0).toString(16)}`);
});

// -- 3. REALISM (captured dispatches) -----------------------------------------

/**
 * Hook 0x0347 in a real attract run and clone the machine at up to K real dispatches.
 * The every-16th-frame indicator redraw at 0x0315 dispatches it; the wrapper clones the
 * entry state, then runs the oracle so the host game proceeds undisturbed.
 */
function captureDispatches(K, maxFrames) {
  const caps = [];
  const snapshot = new Map([[TARGET, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snapshot });
  host.runFrames(maxFrames);
  return caps;
}

test("REALISM: real captured 0x0347 dispatches — loc_0347 matches oracle (+ crafted player-2 arm)", () => {
  const caps = captureDispatches(128, 1500);
  assert.ok(caps.length >= 1, "expected at least one real 0x0347 dispatch during attract");

  let craftedNonZero = false;
  for (const cap of caps) {
    // Real arm: whatever selector the running game presented (attract is player 1 -> 0).
    const real = cap.clone();
    real.nextNmi = Infinity;
    real.nextBoundary = Infinity;
    const selector = real.regs.a;
    const { addr, ram } = runOracle(real);
    assert.equal(ram, null, ram && `oracle wrote work RAM on a real dispatch at 0x${(ram.addr ?? 0).toString(16)}`);
    assert.equal(
      loc_0347(selector),
      addr,
      `return diverges on real dispatch (selector=${hx(selector)}): oracle=${hx16(addr)} cand=${hx16(loc_0347(selector))}`,
    );

    // Crafted arm: force a nonzero selector on the same real state to cover the
    // player-2 column, which an attract (player-1) run never reaches.
    const craft = cap.clone();
    craft.regs.a = 1;
    craft.nextNmi = Infinity;
    craft.nextBoundary = Infinity;
    const c = runOracle(craft);
    assert.equal(c.ram, null, c.ram && `oracle wrote work RAM on the crafted player-2 arm`);
    assert.equal(loc_0347(1), c.addr, `crafted player-2 arm diverges: oracle=${hx16(c.addr)} cand=${hx16(loc_0347(1))}`);
    craftedNonZero = true;
  }
  assert.ok(craftedNonZero, "the crafted player-2 arm never ran");
  console.log(`  REALISM: ${caps.length} real 0x0347 dispatches (+ crafted player-2 arm) — return == oracle, no RAM writes`);
});
