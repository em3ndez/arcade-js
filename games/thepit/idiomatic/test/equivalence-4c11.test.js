// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for clearSpriteAndAttributeRam / loc_4c11 (ROM 0x4c11) — zeroes
 * the low half of the display's 0x9800 block (128 bytes at 0x9800-0x987F: the
 * attribute/column-scroll RAM, the eight sprite slots, and the spare bytes above).
 *
 * The routine takes no inputs and reads no memory: it always writes the SAME 128
 * zeroed bytes. So its declared live-out is memory-only — the cleared block — plus
 * the return to the caller; the counter/pointer the oracle leaves behind are dead
 * (each caller's next act is another setup call, which reloads them before use). The
 * gate therefore compares RAM + pc + SP and drops the value registers, exactly as the
 * memory-only signature declares.
 *
 * A no-input clear has a subtlety with teeth: at the real board-setup dispatch the
 * block is ALREADY all-zero, so an incomplete clear is unobservable there. The teeth
 * come from a DIRTIED entry — the block pre-filled with distinct garbage on both sides
 * — where a clear that misses a byte leaves garbage the oracle would have zeroed.
 *
 *   0. IDENTITY — run the unit gate with both arms = the ORACLE; EQUAL proves the
 *      harness wiring (construct-with-override -> host run -> capture -> clone -> diff)
 *      works on The Pit at all.
 *   1. EQUAL (real dispatch, full contract) — hook 0x4c11 in a real attract run, and
 *      for each capture run the oracle on one clone and the idiomatic routine on
 *      another, confirming identical RAM + pc + SP. Proves the routine touches ONLY the
 *      128 bytes (no stray write) on the real surrounding state — the memory-only
 *      signature is honest.
 *   2. EQUAL (dirtied entry) — pre-fill the block with distinct garbage on the captured
 *      entry, then confirm oracle and idiomatic agree over RAM + pc + SP AND that the
 *      block really is zeroed. This is what proves it CLEARS, not merely re-reads zeros.
 *   3. TEETH — a short-count twin (leaves the block's last byte) MUST be caught on the
 *      dirtied entry (and is correctly invisible on the already-zero real entry,
 *      confirming the dirtied entry is the check that carries teeth).
 *
 * Both the idiomatic routine and the oracle model the return internally, so
 * contractDiffs runs each and compares — no external ret is added.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4c11.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4c11 as oracle } from "../../translated/loc_4c11.js";
import { clearSpriteAndAttributeRam } from "../clearSpriteAndAttributeRam.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x4c11;
const BLOCK_BASE = 0x9800, BLOCK_LEN = 128; // attribute/scroll + sprite + spare
const MAX_FRAMES = 600; // the entry family dispatches 0x4c11 several times by here
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/**
 * Hook 0x4c11 in a real attract run and clone the machine at up to K real dispatches.
 * The wrapper snapshots the entry state, then runs the oracle so the host game proceeds
 * undisturbed. The multi-door entry family reaches it during the attract demo's setup.
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

/** Fill the target block with distinct non-zero garbage (in place). */
function dirty(m) {
  for (let i = 0; i < BLOCK_LEN; i++) m.mem.write8(BLOCK_BASE + i, i + 1); // 1..128, all nonzero
  return m;
}

/** True when every byte of the target block reads zero. */
function blockZero(m) {
  for (let i = 0; i < BLOCK_LEN; i++) if (m.mem.read8(BLOCK_BASE + i) !== 0) return false;
  return true;
}

/**
 * Compare a candidate against the oracle over the memory-equivalence contract for one
 * entry: RAM + pc + SP (value registers are the declared-dead live-out and excluded).
 * Both arms model their own return, so neither needs an external ret here.
 */
function contractDiffs(entry, fn) {
  const o = entry.clone();
  oracle(o);
  const c = entry.clone();
  fn(c);

  const diffs = [];
  const ram = firstRamDiff(o, c);
  if (ram) diffs.push(`RAM@${hx(ram.addr ?? ram.offset)} oracle=${ram.a} cand=${ram.b}`);
  if (o.pc !== c.pc) diffs.push(`pc oracle=${hx(o.pc)} cand=${hx(c.pc)}`);
  if (o.regs.sp !== c.regs.sp) diffs.push(`SP oracle=${hx(o.regs.sp)} cand=${hx(c.regs.sp)}`);
  return diffs;
}

/** Broken twin: short-count — leaves the block's LAST byte (0x987F) untouched. */
function brokenClear(m) {
  const { mem } = m;
  for (let i = 0; i < BLOCK_LEN - 1; i++) mem.write8(BLOCK_BASE + i, 0); // BUG: misses 0x987f
  return m.ret();
}

// -- 0. IDENTITY --------------------------------------------------------------

test("IDENTITY: the unit gate runs on The Pit and reports EQUAL when both arms are the oracle", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, oracle, { maxFrames: MAX_FRAMES });
  assert.equal(
    res.equal,
    true,
    `gate reported a diff for identical arms: ram=${JSON.stringify(res.ram)} regs=${JSON.stringify(res.regs)}`,
  );
  console.log("  IDENTITY: captured 0x4c11, cloned, ran oracle vs oracle -> EQUAL");
});

// -- 1. EQUAL (real dispatch, full contract) ----------------------------------

test("EQUAL (real dispatch): idiomatic == oracle on the captured 0x4c11 entry (only the 128 bytes touched)", () => {
  const caps = captureDispatches(4, MAX_FRAMES);
  assert.ok(caps.length >= 1, "expected at least one real 0x4c11 dispatch during the attract demo");
  for (const cap of caps) {
    const diffs = contractDiffs(cap, clearSpriteAndAttributeRam); // fresh clones inside — cap untouched
    assert.equal(diffs.length, 0, diffs.join("; "));
  }
  console.log(`  EQUAL/real: ${caps.length} captured dispatch(es) identical over RAM+pc+SP`);
});

// -- 2. EQUAL (dirtied entry) -------------------------------------------------

test("EQUAL (dirtied entry): idiomatic clears the garbage-filled block exactly like the oracle", () => {
  const cap = captureDispatches(1, MAX_FRAMES)[0];
  assert.ok(cap, "expected a real 0x4c11 dispatch to seed the dirtied entry");

  const dirtied = dirty(cap.clone());
  const diffs = contractDiffs(dirtied, clearSpriteAndAttributeRam);
  assert.equal(diffs.length, 0, `dirtied entry diverged: ${diffs.join("; ")}`);

  // And confirm the clear actually happened (not a re-read of pre-existing zeros).
  const after = dirtied.clone();
  clearSpriteAndAttributeRam(after);
  assert.ok(blockZero(after), "idiomatic did not zero the block on the dirtied entry");
  console.log("  EQUAL/dirtied: garbage-filled attribute+sprite block zeroed identically to the oracle");
});

// -- 3. TEETH -----------------------------------------------------------------

test("TEETH: the short-count twin (misses the last byte 0x987F) is CAUGHT on the dirtied entry", () => {
  const cap = captureDispatches(1, MAX_FRAMES)[0];
  assert.ok(cap, "need a real capture to seed the teeth check");

  // On the CLEAN real entry the twin is invisible (the block is already zero) —
  // confirm that, so it is clear the dirtied entry is the check that carries teeth.
  const cleanDiffs = contractDiffs(cap, brokenClear);
  assert.equal(cleanDiffs.length, 0, "sanity: on the already-zero real entry the short-count twin is a no-op");

  // On the DIRTIED entry the missed last byte must surface as a RAM diff.
  const dirtied = dirty(cap.clone());
  const diffs = contractDiffs(dirtied, brokenClear);
  assert.ok(diffs.length > 0, "the short-count twin ESCAPED the dirtied-entry contract — the gate is worthless");
  console.log(`  TEETH: short-count twin caught on the dirtied entry (${diffs[0]})`);
});
