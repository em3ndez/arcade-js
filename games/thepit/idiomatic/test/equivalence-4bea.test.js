// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_4bea (ROM 0x4bea) — blanks the score block (6 bytes at
 * 0x8031) and the sound-command queue (10 bytes at SOUND_HEAD = 0x801e) to zero.
 *
 * The routine takes no inputs and reads no memory: it always writes the SAME 16 zeroed
 * bytes. So its declared live-out is memory-only — the two cleared blocks — and the
 * counter/pointer the oracle leaves behind are dead (each caller's next act is another
 * call, which reads none of them). The gate therefore compares RAM + pc + SP and drops
 * the value registers, exactly as the memory-only signature declares.
 *
 * A no-input clear has a subtlety with teeth: at the real boot dispatch both blocks are
 * ALREADY zero, so an incomplete clear is unobservable there. The teeth come from a
 * DIRTIED entry — both blocks pre-filled with distinct garbage on both sides — where a
 * clear that misses a byte leaves garbage the oracle would have zeroed.
 *
 *   0. IDENTITY — run the unit gate with both arms = the oracle; EQUAL proves the
 *      harness wiring (construct-with-override -> host run -> capture -> clone -> diff)
 *      works on The Pit at all.
 *   1. EQUAL (real dispatch, full contract) — hook 0x4bea in a real boot run, and for
 *      the capture run the oracle on one clone and loc_4bea on another, confirming
 *      identical RAM + pc + SP. Proves loc_4bea touches ONLY the 16 bytes (no stray
 *      write) on the real surrounding state — the memory-only signature is honest.
 *   2. EQUAL (dirtied entry) — pre-fill both blocks with garbage on the captured entry,
 *      then confirm oracle and loc_4bea agree over RAM + pc + SP AND that both blocks
 *      really are zeroed. This is what proves it CLEARS, not merely re-reads zeros.
 *   3. TEETH — a short-count twin (leaves the last byte of each block) MUST be caught on
 *      the dirtied entry (and is correctly invisible on the clean boot entry, confirming
 *      the dirtied entry is the check with teeth).
 *
 * The idiomatic routine models the return as a plain JS return (no stack modelling), so
 * the contract check performs one m.ret() on the candidate clone AFTER the call to line
 * pc + SP up with the oracle (which rets internally).
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4bea.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4bea as oracle } from "../../translated/loc_4bea.js";
import { loc_4bea } from "../loc_4bea.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x4bea;
const SCORE_BASE = 0x8031, SCORE_LEN = 6; // the score block
const SOUND_BASE = 0x801e, SOUND_LEN = 10; // sound queue: ring head + eight slots
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/**
 * Hook 0x4bea in a real boot run and clone the machine at up to K real dispatches.
 * The wrapper snapshots the entry state, then runs the oracle so the host game proceeds
 * undisturbed. Cold-boot init (loc_01a4) dispatches it in the first frame.
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

/** Fill both target blocks with distinct non-zero garbage (in place). */
function dirty(m) {
  for (let i = 0; i < SCORE_LEN; i++) m.mem.write8(SCORE_BASE + i, 0x30 + i); // 0x30..0x35
  for (let i = 0; i < SOUND_LEN; i++) m.mem.write8(SOUND_BASE + i, 0xa0 + i); // 0xa0..0xa9
  return m;
}

/** True when every byte of both target blocks reads zero. */
function bothBlocksZero(m) {
  for (let i = 0; i < SCORE_LEN; i++) if (m.mem.read8(SCORE_BASE + i) !== 0) return false;
  for (let i = 0; i < SOUND_LEN; i++) if (m.mem.read8(SOUND_BASE + i) !== 0) return false;
  return true;
}

/**
 * Compare a candidate against the oracle over the memory-equivalence contract for one
 * entry: RAM + pc + SP (value registers are the declared-dead live-out and excluded).
 * The oracle rets internally; the candidate's return is modelled with one m.ret().
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
  return diffs;
}

/** Broken twin: short-count — leaves the LAST byte of each block untouched. */
function brokenLoc4bea(m) {
  const { mem } = m;
  for (let i = 0; i < SCORE_LEN - 1; i++) mem.write8(SCORE_BASE + i, 0); // BUG: misses 0x8036
  for (let i = 0; i < SOUND_LEN - 1; i++) mem.write8(SOUND_BASE + i, 0); // BUG: misses 0x8027
}

// -- 0. IDENTITY --------------------------------------------------------------

test("IDENTITY: the unit gate runs on The Pit and reports EQUAL when both arms are the oracle", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, oracle);
  assert.equal(
    res.equal,
    true,
    `gate reported a diff for identical arms: ram=${JSON.stringify(res.ram)} regs=${JSON.stringify(res.regs)}`,
  );
  console.log("  IDENTITY: captured 0x4bea, cloned, ran oracle vs oracle -> EQUAL");
});

// -- 1. EQUAL (real dispatch, full contract) ----------------------------------

test("EQUAL (real dispatch): loc_4bea == oracle on the captured 0x4bea entry (only the 16 bytes touched)", () => {
  const caps = captureDispatches(4, 400);
  assert.ok(caps.length >= 1, "expected at least one real 0x4bea dispatch during boot");
  for (const cap of caps) {
    const diffs = contractDiffs(cap, loc_4bea); // fresh clones inside — cap untouched
    assert.equal(diffs.length, 0, diffs.join("; "));
  }
  console.log(`  EQUAL/real: ${caps.length} captured dispatch(es) identical over RAM+pc+SP`);
});

// -- 2. EQUAL (dirtied entry) -------------------------------------------------

test("EQUAL (dirtied entry): loc_4bea clears both garbage-filled blocks exactly like the oracle", () => {
  const cap = captureDispatches(1, 400)[0];
  assert.ok(cap, "expected a real 0x4bea dispatch to seed the dirtied entry");

  const dirtied = dirty(cap.clone());
  const diffs = contractDiffs(dirtied, loc_4bea);
  assert.equal(diffs.length, 0, `dirtied entry diverged: ${diffs.join("; ")}`);

  // And confirm the clear actually happened (not a re-read of pre-existing zeros).
  const after = dirtied.clone();
  loc_4bea(after);
  assert.ok(bothBlocksZero(after), "loc_4bea did not zero both blocks on the dirtied entry");
  console.log("  EQUAL/dirtied: garbage-filled score + sound blocks zeroed identically to the oracle");
});

// -- 3. TEETH -----------------------------------------------------------------

test("TEETH: the short-count twin (misses each block's last byte) is CAUGHT on the dirtied entry", () => {
  const cap = captureDispatches(1, 400)[0];
  assert.ok(cap, "need a real capture to seed the teeth check");

  // On the CLEAN boot entry the twin is invisible (both blocks are already zero) —
  // confirm that, so it is clear the dirtied entry is the check that carries teeth.
  const cleanDiffs = contractDiffs(cap, brokenLoc4bea);
  assert.equal(cleanDiffs.length, 0, "sanity: on the already-zero boot entry the short-count twin is a no-op");

  // On the DIRTIED entry the missed last byte must surface as a RAM diff.
  const dirtied = dirty(cap.clone());
  const diffs = contractDiffs(dirtied, brokenLoc4bea);
  assert.ok(diffs.length > 0, "the short-count twin ESCAPED the dirtied-entry contract — the gate is worthless");
  console.log(`  TEETH: short-count twin caught on the dirtied entry (${diffs[0]})`);
});
