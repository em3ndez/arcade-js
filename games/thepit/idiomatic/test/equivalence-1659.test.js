// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence gate for advanceObjectWalkFrame (ROM 0x1659) — the tile-under-object classifier's
 * open-ground animation step: it re-expresses the object's column (0x8068) as an
 * offset from the reference point (0x806c), reads an 8-step walk phase off that
 * offset, sets the motion marker (0x8075) and the alternating sprite frame
 * (PLAYER_FACING), then calls the record builder stageObjectSpriteRecord directly.
 *
 * OBSERVABLE-EQUIVALENCE CONTRACT. The idiomatic routine calls the already-decompiled
 * stageObjectSpriteRecord directly instead of routing through the Z80 registry. That drops the stack
 * frame the oracle path carried: the oracle reaches loc_1b5b as a tail-jump whose ret
 * pops the caller return address (SP += 2) and whose body clobbers A/F/B/HL, while the
 * direct call touches none of them. Those residuals are all DEAD — nothing downstream
 * reads them — so the gate compares OBSERVABLE state only: the full RAM dump plus the
 * one genuine register live-out, the walk phase left in E. It excludes the dead value
 * registers and SP (measured oracle-vs-idiomatic: a/f/h/l/sp differ, E and all RAM
 * match). RAM is compared in full with no exclusion window: a tail-jump writes nothing
 * to the stack (the ret only READS the return address), so no stack-scratch bytes ever
 * differ — this is tighter than the sound-stub dissolve, which had a real CALL push to
 * exclude.
 *
 * CRAFTED ENTRY. Attract never digs a moving object onto open ground, so 0x1659 is NOT
 * dispatched naturally (measured: 0 dispatches in 1200 frames). The routine reads only
 * work RAM, so any real attract clone with its two inputs poked is a valid entry, and
 * the object logic depends only on (column - reference) mod 256, which the sweep covers
 * over all 256 offsets.
 *
 * FIVE checks:
 *   1. EQUAL (real captured attract states) — clone the running attract machine at a
 *      spread of frames (genuine in-play RAM) and confirm RAM AND the E live-out match
 *      the oracle. Proves it on real machine states, not just poked ones.
 *   2. EQUAL (offset sweep) — poke column/reference across all 256 offsets (every walk
 *      phase, the rest-point and moving branches, and the byte-wrap edge), identically
 *      on both arms; RAM and E must match. This is the airtight evidence.
 *   3. NON-VACUOUS — pre-set the outputs (column, marker, sprite) and E to sentinels,
 *      then confirm every one is overwritten and both arms agree — a no-op twin cannot
 *      pass by the entry already holding the answer.
 *   4. TEETH (memory) — a twin that swaps the two sprite frames MUST be caught at
 *      PLAYER_FACING.
 *   5. TEETH (register) — a twin that drops the phase live-out (leaves E as it found it)
 *      MUST be caught by the E diff. Proves the register half of the gate still bites
 *      after it narrowed from the whole file to the one live-out.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-1659.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1659 as oracle } from "../../translated/loc_1659.js";
import { advanceObjectWalkFrame as idiomatic } from "../advanceObjectWalkFrame.js";
import { stageObjectSpriteRecord } from "../stageObjectSpriteRecord.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { PLAYER_Y, PLAYER_FACING } from "../names.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x1659;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

const REFERENCE = 0x806c; // moving reference point
const MOTION_FLAG = 0x8075; // 0 at rest, high-bit marker while moving

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Real attract machine states: run the game and clone it at a spread of frames. Each
 * clone is a genuine in-play machine (real RAM), independent of the source run, with its
 * frame machinery neutralised (safe to run the oracle's steps/ret + tail-call on).
 */
function captureStates(count, stride, startFrame) {
  const m = makeMachine();
  m.runFrames(startFrame);
  const caps = [];
  for (let i = 0; i < count; i++) {
    m.runFrames(stride);
    caps.push(m.clone());
  }
  return caps;
}

/**
 * The routine's ONLY register live-out is the walk phase in E. Compare exactly that,
 * not the whole file: the dissolved direct call to stageObjectSpriteRecord legitimately leaves the
 * dead value registers (A/F/B/HL) and SP where the oracle's stack frame would have
 * moved them. Returns null when E matches, else a {reg:"e", a, b} diff.
 */
function eDiff(a, b) {
  return a.regs.e === b.regs.e ? null : { reg: "e", a: a.regs.e, b: b.regs.e };
}

/**
 * Run oracle and candidate on independent clones of `entry`; return the first differing
 * state byte and the E live-out diff (either null when identical). RAM is diffed in full
 * (no stack window to exclude — the oracle's tail-jump writes nothing to the stack).
 */
function runDiff(entry, fn) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  oracle(a);
  fn(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  const regs = eDiff(a, b);
  return { ram, regs };
}

/** Poke the two inputs identically, returning a fresh entry clone. */
function withInputs(base, x, ref) {
  const e = base.clone();
  e.mem.write8(PLAYER_Y, x);
  e.mem.write8(REFERENCE, ref);
  return e;
}

// -- 1. EQUAL over real captured attract states -------------------------------

test("EQUAL: advanceObjectWalkFrame leaves the same state + registers as the oracle over real attract states", () => {
  const caps = captureStates(10, 90, 120);
  assert.ok(caps.length >= 1, "expected at least one captured attract state");
  for (const cap of caps) {
    const { ram, regs } = runDiff(cap, idiomatic);
    assert.equal(ram, null, ram && `RAM diff at ${hx(ram.addr ?? 0)}: oracle=${ram.a} idiomatic=${ram.b}`);
    assert.equal(regs, null, regs && `E diff: oracle=${regs.a} idiomatic=${regs.b}`);
  }
  console.log(`  EQUAL: ${caps.length} real attract states — RAM + E live-out identical to the oracle`);
});

// -- 2. EQUAL over the full offset sweep (all 256 offsets) --------------------

test("EQUAL (sweep): every walk phase, both branches and the wrap edge match the oracle", () => {
  const [base] = captureStates(1, 1, 200);

  let n = 0;
  for (const ref of [0, 7, 100, 255]) {
    for (let x = 0; x < 256; x++) {
      // offset = (x - ref) mod 256 ranges over all 256 values -> every phase 0..7,
      // the rest-point (marker 0) vs moving (marker 0xff) branch, both sprite frames,
      // and the underflow wrap when x < ref.
      const { ram, regs } = runDiff(withInputs(base, x, ref), idiomatic);
      assert.equal(ram, null, ram && `x=${x} ref=${ref}: RAM diff at ${hx(ram.addr ?? 0)} oracle=${ram.a} idiomatic=${ram.b}`);
      assert.equal(regs, null, regs && `x=${x} ref=${ref}: E diff oracle=${regs.a} idiomatic=${regs.b}`);
      n++;
    }
  }
  console.log(`  EQUAL/sweep: ${n} (column,reference) combinations — RAM + E live-out identical (all 256 offsets)`);
});

// -- 3. NON-VACUOUS: outputs + phase register are actually written ------------

test("NON-VACUOUS: with outputs + E pre-set to sentinels, every one is overwritten and arms agree", () => {
  const [seed] = captureStates(1, 1, 220);
  // offset = 41 - 3 = 38 -> phase 1: marker 0xff, sprite 0xb2, E 1 — all distinct from the sentinels.
  const entry = withInputs(seed, 41, 3);
  const OUT_SENTINEL = 0x55;
  const E_SENTINEL = 0x99;
  entry.mem.write8(MOTION_FLAG, OUT_SENTINEL); // 0x8075 — distinct from the inputs at 0x8068/0x806c
  entry.mem.write8(PLAYER_FACING, OUT_SENTINEL); // 0x8069 — likewise distinct
  entry.regs.e = E_SENTINEL;

  const a = entry.clone(); // oracle
  const b = entry.clone(); // idiomatic
  oracle(a);
  idiomatic(b);

  assert.notEqual(b.mem.read8(MOTION_FLAG), OUT_SENTINEL, "idiomatic left the motion marker unwritten");
  assert.notEqual(b.mem.read8(PLAYER_FACING), OUT_SENTINEL, "idiomatic left the sprite code unwritten");
  assert.notEqual(b.regs.e, E_SENTINEL, "idiomatic left the phase register (E) unwritten");

  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  const regs = eDiff(a, b);
  assert.equal(ram, null, ram && `RAM diff at ${hx(ram.addr ?? 0)}: oracle=${ram.a} idiomatic=${ram.b}`);
  assert.equal(regs, null, regs && `E diff: oracle=${regs.a} idiomatic=${regs.b}`);
  console.log("  NON-VACUOUS: marker, sprite code and phase register all overwritten from their sentinels; arms agree");
});

// -- 4. TEETH (memory): a sprite-frame swap MUST be caught --------------------

/** Broken twin: swaps the two walk frames (odd where it should be even, and vice-versa). */
function twinSpriteSwap(m) {
  const { regs, mem } = m;
  const offset = (mem.read8(PLAYER_Y) - mem.read8(REFERENCE)) & 0xff;
  mem.write8(PLAYER_Y, offset);
  const phase = (offset + 3) % 8;
  mem.write8(MOTION_FLAG, phase === 0 ? 0 : 0xff);
  mem.write8(PLAYER_FACING, phase & 2 ? 0xb2 : 0xb3); // BUG: frames swapped
  regs.e = phase;
  return stageObjectSpriteRecord(m);
}

test("TEETH (memory): a swapped-sprite twin is CAUGHT at PLAYER_FACING", () => {
  const [seed] = captureStates(1, 1, 240);
  const entry = withInputs(seed, 41, 3); // phase 1 -> the two frames differ

  const { ram } = runDiff(entry, twinSpriteSwap);
  assert.notEqual(ram, null, "the gate FAILED to catch a swapped-sprite twin — it proves nothing");
  assert.equal(ram.addr, PLAYER_FACING, `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected ${hx(PLAYER_FACING)})`);

  const clean = runDiff(entry, idiomatic);
  assert.equal(clean.ram, null, "idiomatic must pass the entry the twin fails (state)");
  assert.equal(clean.regs, null, "idiomatic must pass the entry the twin fails (registers)");
  console.log(`  TEETH/memory: swapped-sprite twin caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

// -- 5. TEETH (register): dropping the phase live-out MUST be caught ----------

/** Broken twin: does the right memory work but forgets to leave the phase in E. */
function twinDropPhaseReg(m) {
  const before = m.regs.e;
  idiomatic(m);
  m.regs.e = before; // BUG: drop the phase register the record builder's caller reads
}

test("TEETH (register): a twin that drops the phase live-out (E) is CAUGHT", () => {
  const [seed] = captureStates(1, 1, 260);
  const entry = withInputs(seed, 41, 3); // phase 1
  entry.regs.e = 0x99; // != any phase, so restoring it always diverges

  const { ram, regs } = runDiff(entry, twinDropPhaseReg);
  assert.equal(ram, null, "the register bug must NOT show up as a state diff");
  assert.notEqual(regs, null, "the gate FAILED to catch a dropped phase register — the register half is toothless");
  assert.equal(regs.reg, "e", `teeth caught the wrong register ${regs && regs.reg} (expected e)`);

  const clean = runDiff(entry, idiomatic);
  assert.equal(clean.regs, null, "idiomatic must reproduce the phase register on the same entry");
  console.log(`  TEETH/register: dropped phase register caught at E (oracle=${regs.a} broken=${regs.b})`);
});
