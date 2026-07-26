// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_4c1c (ROM 0x4c1c) — the 64-byte work-RAM wipe of
 * 0x8200..0x823f.
 *
 * loc_4c1c takes no register inputs and its only live output is memory: the 64
 * zeroed bytes. So the gate is MEMORY-ONLY (firstStateDiff over the whole state
 * dump), not a full register/PC compare — the oracle's exit registers, flags, and
 * Z80 return path (SP/PC) are dead scratch the idiomatic JS return replaces (the
 * honest-signature / memory-equivalence contract). The DK exemplar equivalence-0008
 * gates a register-dropping leaf the same way.
 *
 * A wrinkle that shapes the whole gate: at every REAL dispatch the target block is
 * ALREADY all zero, so a captured-dispatch replay alone cannot tell a correct wipe
 * from a no-op — it only proves the routine makes no stray writes elsewhere. The
 * proof that the writes actually land (and cover exactly the 64 bytes) is a CRAFTED
 * dirty-block entry: paint the block and its margins with a non-zero sentinel on
 * both sides, run, and require the block — and only the block — to come back zero.
 * That same crafted state is what gives the teeth their bite.
 *
 * Four checks:
 *   0. HARNESS SANITY (unitEquivalence, identity) — capture 0x4c1c in a real boot/
 *      attract run and confirm the full-machine gate reports EQUAL when both arms are
 *      the oracle. Proves the capture/clone/replay harness reaches 0x4c1c at all.
 *   1. EQUAL, real dispatches (memory-only) — oracle vs idiomatic on clones of each
 *      captured entry leave identical memory (no stray writes on in-distribution states).
 *   2. EQUAL, crafted dirty block (memory-only) — with the block + margins dirtied,
 *      both zero exactly 0x8200..0x823f and touch nothing else.
 *   3. TEETH — a 63-byte off-by-one twin (stops one byte short) is CAUGHT by the
 *      crafted dirty block at 0x823f. On the already-zero real states it would slip
 *      through, which is exactly why the crafted entry is mandatory.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4c1c.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4c1c as oracle } from "../../translated/loc_4c1c.js";
import { loc_4c1c as idiomatic } from "../loc_4c1c.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x4c1c;
const BLOCK_LO = 0x8200;
const BLOCK_HI = 0x8240; // first byte the wipe does NOT touch
const SENTINEL = 0xa5; // any non-zero marker; a correct wipe replaces it inside the block
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture up to K real entry states of 0x4c1c during a boot/attract run. The
 * wrapper clones on entry, then runs the oracle so the host game proceeds normally.
 */
function captureEntries(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = makeMachine(snap);
  host.runFrames(maxFrames);
  return caps;
}

/** Diff two machines' whole state dumps; null when identical. */
function ramDiff(a, b) {
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/**
 * Paint a non-zero sentinel across the block plus an 8-byte margin on each side, so
 * a wipe that runs too short, too long, or off-base leaves a visible mark.
 */
function dirtyBlock(m) {
  for (let a = BLOCK_LO - 8; a < BLOCK_HI + 8; a++) m.mem.write8(a, SENTINEL);
}

// -- 0. HARNESS SANITY (unitEquivalence, identity) ---------------------------

test("HARNESS: the gate reaches 0x4c1c in a real run and reports EQUAL for identical arms", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, oracle);
  assert.equal(
    res.equal,
    true,
    `identity gate reported a diff: ram=${JSON.stringify(res.ram)} regs=${JSON.stringify(res.regs)}`,
  );
  console.log("  HARNESS: captured 0x4c1c, cloned, ran oracle vs oracle -> EQUAL");
});

// -- 1. EQUAL on real captured dispatches (memory-only) ----------------------

test("EQUAL (real dispatches): idiomatic leaves identical memory to the oracle, no stray writes", () => {
  const caps = captureEntries(8, 600);
  assert.ok(caps.length >= 1, "expected at least one real 0x4c1c dispatch during boot/attract");
  for (const cap of caps) {
    const a = cap.clone();
    const b = cap.clone();
    oracle(a);
    idiomatic(b);
    const d = ramDiff(a, b);
    assert.equal(d, null, d && `memory diff at ${hx(d.addr ?? 0)} (oracle=${d.a} idiomatic=${d.b})`);
  }
  console.log(`  EQUAL/real: ${caps.length} captured dispatches identical to the oracle`);
});

// -- 2. EQUAL on a crafted dirty block (memory-only) -------------------------

test("EQUAL (crafted dirty block): both zero exactly 0x8200..0x823f and nothing else", () => {
  const caps = captureEntries(1, 600);
  assert.ok(caps.length >= 1, "need a captured entry to craft from");
  const dirty = caps[0].clone();
  dirtyBlock(dirty);

  const a = dirty.clone();
  const b = dirty.clone();
  oracle(a);
  idiomatic(b);

  const d = ramDiff(a, b);
  assert.equal(d, null, d && `memory diff at ${hx(d.addr ?? 0)} (oracle=${d.a} idiomatic=${d.b})`);

  // Positive checks: the block really was zeroed (not a shared no-op), margins intact.
  for (let addr = BLOCK_LO; addr < BLOCK_HI; addr++) {
    assert.equal(b.mem.read8(addr), 0, `block byte ${hx(addr)} was not zeroed`);
  }
  assert.equal(b.mem.read8(BLOCK_LO - 1), SENTINEL, "the byte below the block was wrongly touched");
  assert.equal(b.mem.read8(BLOCK_HI), SENTINEL, "the byte above the block was wrongly touched");
  console.log("  EQUAL/crafted: dirtied block zeroed over 0x8200..0x823f, margins intact, matches oracle");
});

// -- 3. TEETH: an off-by-one twin is caught ----------------------------------

/** Broken twin: clears only 63 bytes (stops one short), leaving 0x823f dirty. */
function brokenLoc4c1c(m) {
  for (let addr = BLOCK_LO; addr < BLOCK_HI - 1; addr++) m.mem.write8(addr, 0);
}

test("TEETH: a 63-byte off-by-one twin is CAUGHT at 0x823f by the crafted dirty block", () => {
  const caps = captureEntries(1, 600);
  const dirty = caps[0].clone();
  dirtyBlock(dirty);

  const a = dirty.clone();
  const b = dirty.clone();
  oracle(a);
  brokenLoc4c1c(b);

  const d = ramDiff(a, b);
  assert.notEqual(d, null, "the gate FAILED to catch the off-by-one twin — it proves nothing");
  assert.equal(
    d.addr,
    BLOCK_HI - 1,
    `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(BLOCK_HI - 1)})`,
  );
  console.log(`  TEETH: off-by-one twin caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});
