// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence gate for fillColorRam (ROM 0x4c37) — the screen-wide colour-RAM fill.
 *
 * The routine reads one byte (BOARD_MODE, 0x8057) and writes it into all 1024
 * colour-RAM cells (0x8800..0x8bff). Its contract is MEMORY-ONLY: the leftover
 * loop counter/pointer and fill byte are dead ABI — the tail successor (0x4c1c)
 * overwrites them and reads none of them. So the gate compares whole-machine RAM
 * (colour RAM is part of dumpState), NOT the leftover register file.
 *
 * FIVE checks:
 *   1. EQUAL (unit capture) — hook 0x4c37 in a real boot/attract run and, on the
 *      captured entry, run the oracle vs fillColorRam on two clones. Require the
 *      DECLARED LIVE-OUT identical: RAM matches (the register residue is dead ABI,
 *      backstopped by the whole-machine pixel gate).
 *   2. EQUAL (all real dispatches) — repeat the RAM comparison on EVERY real
 *      captured dispatch, and confirm at least one carried a non-zero fill byte so
 *      the fill actually changed colour RAM (attract dispatches it with 192).
 *   3. EQUAL (crafted fill-byte sweep) — over a captured entry, force the fill byte
 *      to each of several values AND pre-stain colour RAM to a contrasting sentinel
 *      so EVERY one of the 1024 cells must flip. Proves full coverage and that the
 *      value written is exactly the fill byte, across the byte domain.
 *   4. TEETH (wrong value) — a twin that writes the fill byte inverted MUST be
 *      caught (visible even against zeroed colour RAM at the first dispatch).
 *   5. TEETH (missed coverage) — a twin that fills only the first three pages
 *      (skips the last 256 cells) MUST be caught by the crafted contrasting-stain
 *      sweep; the bug is invisible unless the untouched cells differ from the fill.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4c37.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4c37 as oracle } from "../../translated/loc_4c37.js";
import { fillColorRam } from "../fillColorRam.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x4c37;
const BOARD_MODE = 0x8057;
const COLOR_BASE = 0x8800;
const COLOR_CELLS = 1024;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Hook 0x4c37 in a real boot/attract run and clone the machine at up to K real
 * dispatches. The wrapper snapshots the pristine entry state, then runs the oracle
 * so the host game proceeds undisturbed.
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

/**
 * Diff whole-machine RAM after running `fn` on a clone of `entry` against the
 * oracle on another clone. Optionally poke the fill byte and pre-stain colour RAM
 * on BOTH clones identically first (a crafted entry). Returns the first RAM diff
 * or null. RAM is the declared live-out; the leftover register file is dead ABI.
 */
function diffAgainstOracle(entry, fn, { fillByte, stain } = {}) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  for (const c of [a, b]) {
    if (fillByte !== undefined) c.mem.write8(BOARD_MODE, fillByte);
    if (stain !== undefined) {
      for (let i = 0; i < COLOR_CELLS; i++) c.mem.write8(COLOR_BASE + i, stain);
    }
  }
  oracle(a);
  fn(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

// -- 1. EQUAL (unit capture) -------------------------------------------------

test("EQUAL (unit): fillColorRam leaves the same RAM as the oracle on a real dispatch", () => {
  // unitEquivalence captures the real first entry, clones, and runs both arms.
  // Its `equal` also compares the leftover register file, which here is DEAD ABI
  // (the fill byte / loop pointer nobody downstream reads) — so the memory-only
  // contract gates on res.ram, the declared live-out, not the register residue.
  const res = unitEquivalence(makeMachine, TARGET, oracle, fillColorRam);
  assert.equal(
    res.ram,
    null,
    res.ram && `colour RAM diverged at ${hx(res.ram.addr ?? 0)} (oracle=${res.ram.a} idiomatic=${res.ram.b})`,
  );
  console.log("  EQUAL/unit: captured real 0x4c37 entry — colour RAM identical to the oracle (regs are dead ABI)");
});

// -- 2. EQUAL (all real dispatches, with a non-zero fill) --------------------

test("EQUAL (real): every captured dispatch matches; at least one has a non-zero fill", () => {
  const caps = captureDispatches(8, 240);
  assert.ok(caps.length >= 1, "expected at least one real 0x4c37 dispatch during attract");

  let sawNonZeroFill = false;
  for (const entry of caps) {
    if (entry.mem.read8(BOARD_MODE) !== 0) sawNonZeroFill = true;
    const d = diffAgainstOracle(entry, fillColorRam);
    assert.equal(
      d,
      null,
      d && `real dispatch (fill=${entry.mem.read8(BOARD_MODE)}) diverged at ${hx(d.addr ?? 0)} (oracle=${d.a} idiomatic=${d.b})`,
    );
  }
  assert.ok(sawNonZeroFill, "no captured dispatch had a non-zero fill byte — the RAM match was vacuous");
  console.log(`  EQUAL/real: ${caps.length} real dispatches match; a non-zero fill was exercised`);
});

// -- 3. EQUAL (crafted fill-byte sweep, full coverage) -----------------------

test("EQUAL (crafted): every fill byte flips all 1024 cells identically to the oracle", () => {
  const [entry] = captureDispatches(1, 240);
  assert.ok(entry, "expected a real 0x4c37 dispatch during attract");

  // Stain colour RAM to a value NONE of the fill bytes equal, so every cell must
  // change; then require fillColorRam and the oracle to land byte-identical.
  const stain = 0xa5;
  for (const fillByte of [0, 1, 0x2a, 0xc0, 0x7f, 0xff]) {
    const d = diffAgainstOracle(entry, fillColorRam, { fillByte, stain });
    assert.equal(
      d,
      null,
      d && `fill byte ${hx(fillByte)}: diverged at ${hx(d.addr ?? 0)} (oracle=${d.a} idiomatic=${d.b})`,
    );
  }
  console.log("  EQUAL/crafted: fill bytes {0,1,0x2a,0xc0,0x7f,0xff} over a stained field — all 1024 cells match");
});

// -- 4. TEETH (wrong value) --------------------------------------------------

/** Broken twin: fills the right region but with the fill byte INVERTED. */
function invertedFill(m) {
  const { mem } = m;
  const fill = mem.read8(BOARD_MODE) ^ 0xff; // BUG: wrong colour written
  for (let i = 0; i < COLOR_CELLS; i++) mem.write8(COLOR_BASE + i, fill);
}

test("TEETH (wrong value): an inverted fill byte is CAUGHT", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, invertedFill);
  assert.notEqual(res.ram, null, "the gate FAILED to catch a wrong fill value in RAM — it is worthless");
  console.log(`  TEETH/value: inverted fill caught at ${hx(res.ram.addr)} (oracle=${res.ram.a} broken=${res.ram.b})`);
});

// -- 5. TEETH (missed coverage) ----------------------------------------------

/** Broken twin: fills only the first three pages (768 cells) — skips the last 256. */
function shortFill(m) {
  const { mem } = m;
  const fill = mem.read8(BOARD_MODE);
  for (let i = 0; i < 768; i++) mem.write8(COLOR_BASE + i, fill); // BUG: last page unwritten
}

test("TEETH (coverage): a twin that skips the last page is CAUGHT by the stained sweep", () => {
  const [entry] = captureDispatches(1, 240);
  // Against a stained field with a non-zero fill, the skipped last page stays
  // stained while the oracle repaints it — a visible divergence.
  const d = diffAgainstOracle(entry, shortFill, { fillByte: 0x2a, stain: 0xa5 });
  assert.notEqual(d, null, "the sweep FAILED to catch an unfilled last page — teeth are worthless");
  assert.ok(d.addr >= COLOR_BASE + 768, `expected the miss in the last page, got ${hx(d.addr ?? 0)}`);
  console.log(`  TEETH/coverage: unfilled last page caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});
