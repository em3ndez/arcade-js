// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for setChamberCreatureFrame (ROM 0x2fd9, The Pit) — commit the chosen
 * background-animation flip tile into 0x80dc, then hand off to the shared
 * animation-update tail at 0x2fe3.
 *
 * TWO WRINKLES this routine forces, both handled with a crafted entry:
 *
 *   1. setChamberCreatureFrame is NEVER dispatched during attract — its whole background-flip
 *      subsystem stays idle there (the sibling loc_2f71 runs ~1000x but never takes
 *      the arm that reaches this commit tail). So there is no natural capture. A
 *      real machine state is captured at the sibling loc_2f71 instead, and the
 *      target is invoked on clones of it — a real state with a surgical nudge (the
 *      swept tile byte), exactly the crafted-entry escape hatch for unreached arms.
 *
 *   2. The tail 0x2fe3 is itself still untranslated (not in the registry), so
 *      calling it would throw. Both the oracle and the idiomatic routine delegate
 *      to it identically, so it is replaced by ONE stub installed on both sides at
 *      once: the stub gives the tail an observable memory effect (bumps a mark byte)
 *      and a fixed exit, so "the hand-off happened" is visible to the diff. Because
 *      the stub is the same function on both sides, it can never manufacture or hide
 *      a difference between them — only setChamberCreatureFrame's own behaviour can.
 *
 * The routine's one genuine input is the tile byte the caller left in the machine
 * register file; its one memory effect is the store at 0x80dc. So EQUAL is proven
 * the strong way — an EXHAUSTIVE sweep over all 256 possible tile bytes — plus a
 * forced real dispatch driven through the shared unitEquivalence harness.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-2fd9.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2fd9 as oracle } from "../../translated/loc_2fd9.js";
import { setChamberCreatureFrame as idiomatic } from "../setChamberCreatureFrame.js";
import { loc_2f71 } from "../../translated/loc_2f71.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) =>
      nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x2fd9; // setChamberCreatureFrame
const TAIL = 0x2fe3; // the shared animation-update tail (still untranslated)
const SIB = 0x2f71; // the reachable sibling we capture a real attract state at
const TILE_CELL = 0x80dc; // the background-animation tile cell setChamberCreatureFrame writes
const TAIL_MARK = 0x80de; // stub's stand-in for the tail's real memory effect
const TAIL_EXIT = 0x3029; // stub's stand-in for where the tail leaves the machine
const CAPTURE_FRAMES = 900; // the sibling first runs ~frame 695, so run well past it
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// The stub that stands in for the untranslated tail 0x2fe3. Installed IDENTICALLY
// on both sides, so it can only ever move both in lockstep. It bumps a mark byte
// (giving the delegation a visible memory effect) and sets a fixed exit address.
let tailStubCalls = 0;
function tailStub(mm) {
  tailStubCalls++;
  mm.mem.write8(TAIL_MARK, (mm.mem.read8(TAIL_MARK) + 1) & 0xff);
  mm.pc = TAIL_EXIT;
  return undefined;
}

/**
 * Capture one real attract machine state at the sibling loc_2f71's entry, carrying
 * the tail stub in its registry so setChamberCreatureFrame can be run on clones of it. The sibling
 * hook clones the pristine entry, then runs the real sibling so attract continues.
 */
function captureSiblingState() {
  let entry = null;
  const overrides = new Map([
    [TAIL, tailStub],
    [SIB, (mm) => {
      if (entry === null) entry = mm.clone();
      return loc_2f71(mm);
    }],
  ]);
  const host = makeMachine(overrides);
  host.runFrames(CAPTURE_FRAMES);
  return entry;
}

const ENTRY = ROM_PRESENT ? captureSiblingState() : null;

/**
 * Run the oracle and a candidate on two independent clones of the crafted entry
 * (real sibling state, tile byte poked to `tile`) and diff memory + registers + pc.
 */
function runPair(candidate, tile) {
  const a = ENTRY.clone();
  const b = ENTRY.clone();
  a.regs.a = tile;
  b.regs.a = tile;

  tailStubCalls = 0;
  oracle(a);
  const oracleDelegations = tailStubCalls;

  tailStubCalls = 0;
  candidate(b);
  const candidateDelegations = tailStubCalls;

  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pc: a.pc === b.pc ? null : { a: a.pc, b: b.pc },
    tileLanded: a.mem.read8(TILE_CELL),
    oracleDelegations,
    candidateDelegations,
  };
}

// -- 1. EQUAL: exhaustive over every possible tile byte -----------------------

test("EQUAL (exhaustive): idiomatic == oracle for all 256 tile bytes", () => {
  assert.ok(ENTRY, "captured a real attract state at the sibling loc_2f71");
  for (let tile = 0; tile < 256; tile++) {
    const r = runPair(idiomatic, tile);
    assert.equal(
      r.ram,
      null,
      r.ram &&
        `tile=${hx(tile)}: RAM diverged at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} idiomatic=${r.ram.b})`,
    );
    assert.equal(r.regs, null, r.regs && `tile=${hx(tile)}: register ${r.regs?.reg} diverged`);
    assert.equal(r.pc, null, r.pc && `tile=${hx(tile)}: pc diverged (oracle=${hx(r.pc?.a)} idiomatic=${hx(r.pc?.b)})`);
    assert.equal(r.tileLanded, tile, `tile=${hx(tile)}: the committed byte must land at ${hx(TILE_CELL)}`);
    assert.equal(r.candidateDelegations, 1, `tile=${hx(tile)}: idiomatic must delegate to the tail exactly once`);
    assert.equal(r.oracleDelegations, 1, `tile=${hx(tile)}: oracle delegates to the tail exactly once`);
  }
  console.log("  EQUAL/exhaustive: all 256 tile bytes identical to the oracle (memory + regs + pc)");
});

// -- 2. TEETH: broken twins the gate MUST catch -------------------------------

/** Broken twin A: commits the WRONG tile byte (bit-inverted). */
function brokenTile(m) {
  m.mem.write8(TILE_CELL, m.regs.a ^ 0xff); // BUG: corrupts the committed tile
  return m.call(TAIL);
}

/** Broken twin B: drops the tail hand-off entirely (returns early). */
function brokenNoTail(m) {
  m.mem.write8(TILE_CELL, m.regs.a); // stores the right tile...
  // BUG: ...but never delegates to the shared animation-update tail.
}

test("TEETH: a wrong committed tile is CAUGHT at the tile cell", () => {
  const r = runPair(brokenTile, 0x38);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a wrong committed tile — it is worthless");
  assert.equal(r.ram.addr, TILE_CELL, `teeth caught the wrong address ${hx(r.ram.addr ?? 0)} (expected ${hx(TILE_CELL)})`);
  console.log(`  TEETH: wrong tile caught at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

test("TEETH: dropping the tail hand-off is CAUGHT", () => {
  const r = runPair(brokenNoTail, 0x38);
  assert.equal(r.candidateDelegations, 0, "the broken twin must not have delegated (that is the bug)");
  assert.notEqual(r.ram, null, "the missing tail effect must surface as a memory difference");
  assert.equal(r.ram.addr, TAIL_MARK, `teeth caught ${hx(r.ram.addr ?? 0)} (expected the tail mark ${hx(TAIL_MARK)})`);
  assert.notEqual(r.pc, null, "and the exit pc must diverge (the tail set it, the twin did not)");
  console.log(`  TEETH: dropped hand-off caught at ${hx(r.ram.addr)} + pc (oracle=${hx(r.pc.a)} broken=${hx(r.pc.b)})`);
});

// -- 3. EQUAL + TEETH through the shared unitEquivalence harness ---------------
// setChamberCreatureFrame is unreached in attract, so a makeMachine wrapper forces a real dispatch:
// run the real sibling, then invoke the target so the harness's snapshot hook fires
// on a genuine attract-derived state. The tail stub is layered in the same wrapper.

function makeForced(overrides) {
  const merged = new Map(overrides ? [...overrides] : []);
  merged.set(TAIL, tailStub);
  merged.set(SIB, (mm) => {
    const r = loc_2f71(mm); // real sibling, natural attract behaviour
    mm.call(TARGET); // then force-enter the target so the snapshot hook captures it
    return r;
  });
  return makeMachine(merged);
}

test("EQUAL (harness): a forced real 0x2fd9 dispatch is EQUAL through unitEquivalence", () => {
  const res = unitEquivalence(makeForced, TARGET, oracle, idiomatic, { maxFrames: CAPTURE_FRAMES });
  assert.equal(res.equal, true, `harness reported a diff: ram=${JSON.stringify(res.ram)} regs=${JSON.stringify(res.regs)}`);
  assert.equal(res.ram, null, "harness RAM must be identical");
  assert.equal(res.pc, null, "harness pc must be identical (both delegate through the same tail stub)");
  console.log("  EQUAL/harness: unitEquivalence captured a real 0x2fd9 entry -> EQUAL");
});

test("TEETH (harness): the wrong-tile twin is CAUGHT by unitEquivalence", () => {
  const res = unitEquivalence(makeForced, TARGET, oracle, brokenTile, { maxFrames: CAPTURE_FRAMES });
  assert.equal(res.equal, false, "unitEquivalence FAILED to catch the wrong-tile twin — it is worthless");
  assert.notEqual(res.ram, null, "the diff must be a RAM difference");
  assert.equal(res.ram.addr, TILE_CELL, `harness caught ${hx(res.ram.addr ?? 0)} (expected ${hx(TILE_CELL)})`);
  console.log(`  TEETH/harness: wrong tile caught at ${hx(res.ram.addr)} (oracle=${res.ram.a} broken=${res.ram.b})`);
});
