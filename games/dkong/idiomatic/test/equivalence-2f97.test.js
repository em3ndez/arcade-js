// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_2f97 (ROM 0x2F97) — one build arm of the hammer/object
 * sprite updater.
 *
 * loc_2f97 is reached from entry_2ed4 as a tail branch. It gates on the low bit of
 * MARIO_HAMMER_PENDING: clear -> return with no writes; set -> stamp two object-record
 * state bytes (+0x09 / +0x0A), build the object's sprite tile code (a fixed base tile
 * carrying Mario's facing bit) and attribute, save the current SND_BGM index into a
 * scratch cell, then TAIL into the shared record write loc_2f7c. The record dest and
 * object base pass through from the caller in registers.
 *
 * The oracle's early return and its tail (`jp 0x2f7c`, whose callee ret pops) only ever
 * POP the stack — neither path ever WRITES it — so the memory-equivalence contract is the
 * full RAM dump with NO exclusion. The idiomatic routine models no stack (a plain return
 * and a direct loc_2f7c call), which changes only pc/SP, not RAM, so RAM is compared
 * directly (mirroring the callee's own equivalence-2f7c gate).
 *
 *   1. REACHABILITY — 0x2F97 is dispatched during attract (entry_2ed4 tail-branches to it
 *      every serviced frame), covering BOTH arms and both facings.
 *
 *   2. EQUAL (captured) — hook 0x2F97 in a real attract run, clone at each dispatch, and
 *      confirm loc_2f97 reproduces the oracle's full RAM on every real state (both the
 *      bit-clear early return and the pending-hammer build).
 *
 *   3. EQUAL (crafted) — poke registers + cells identically on both sides to pin: the
 *      early return (bit0 clear, and bit0 clear with other bits set), the build for BOTH
 *      facings, BOTH object records, the SND_BGM save, and the 8-bit position wraps in the
 *      loc_2f7c tail. Each build case also asserts the oracle really wrote the nine
 *      expected bytes (non-vacuity); each early-return case asserts a seeded sentinel
 *      survived untouched.
 *
 *   4. TEETH — three broken twins the crafted comparison MUST catch:
 *        (a) wrong object state byte — stamps +0x09 to the wrong value; caught at +0x09.
 *        (b) dropped facing bit — stores the bare base tile; caught at the record code
 *            byte on a facing-right case.
 *        (c) inverted pending gate — builds when it should skip and skips when it should
 *            build; caught on a build case at the lowest cell the build writes.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2f97.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2f97 as oracle } from "../../translated/loc_2f97.js";
import { loc_2f97 } from "../loc_2f97.js";
import { loc_2f7c } from "../loc_2f7c.js";
import {
  MARIO_HAMMER_PENDING,
  MARIO_SPRITE_CODE,
  SND_BGM,
  MARIO_X,
  MARIO_Y,
  SPRITE_X,
  SPRITE_CODE,
  SPRITE_ATTR,
  SPRITE_Y,
  OBJ_X,
  OBJ_Y,
} from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2f97;
// The oracle's returns (early `ret nc`, and the callee's `ret` on the tail path) pop the
// stack; point SP at work RAM so those pops read valid bytes (never I/O). The oracle writes
// no RAM through the stack, so this choice never affects the compared memory.
const SAFE_SP = 0x6bf8;

const OBJ_FIELD_09 = 0x09; // object-record state byte the arm stamps to 0x06
const OBJ_FIELD_0A = 0x0a; // object-record state byte the arm stamps to 0x03
const OBJ_X_DISP = 0x0e;   // object-record field: horizontal displacement (read by loc_2f7c)
const OBJ_Y_DISP = 0x0f;   // object-record field: vertical displacement (read by loc_2f7c)
const SAVED_BGM = 0x6389;  // scratch cell the arm saves SND_BGM into
const SPRITE_TILE = 0x1e;  // base sprite tile code; Mario's facing bit is OR'd on top
const SENTINEL = 0x5a;     // seeded into every write target so a real write is visible

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const u8 = (v) => v & 0xff;
const tileFor = (spriteCode) => SPRITE_TILE | (spriteCode & 0x80);

/**
 * A synthetic entry: a clone of `base` with the register live-ins (record dest, object
 * base) and the input cells (pending, sprite code, BGM, Mario X/Y, the object's two
 * displacement fields) set, every write-target cell pre-seeded with a sentinel so real
 * writes are visible, and a safe stack. Frame machinery neutralised so the oracle's step
 * machinery cannot fire an NMI or push a frame in isolation.
 */
function makeEntry(base, spec) {
  const e = base.clone();
  e.regs.de = spec.de; // destination sprite record (passes through to loc_2f7c)
  e.regs.ix = spec.ix; // object record base
  e.mem.write8(MARIO_HAMMER_PENDING, spec.pending);
  e.mem.write8(MARIO_SPRITE_CODE, spec.spriteCode);
  e.mem.write8(SND_BGM, spec.bgm);
  e.mem.write8(MARIO_X, spec.marioX);
  e.mem.write8(MARIO_Y, spec.marioY);
  e.mem.write8((spec.ix + OBJ_X_DISP) & 0xffff, spec.offE);
  e.mem.write8((spec.ix + OBJ_Y_DISP) & 0xffff, spec.offF);
  // Seed every cell the build writes with a sentinel (identical both sides).
  for (const addr of [
    (spec.ix + OBJ_FIELD_09) & 0xffff,
    (spec.ix + OBJ_FIELD_0A) & 0xffff,
    SAVED_BGM,
    (spec.de + SPRITE_X) & 0xffff,
    (spec.de + SPRITE_CODE) & 0xffff,
    (spec.de + SPRITE_ATTR) & 0xffff,
    (spec.de + SPRITE_Y) & 0xffff,
    (spec.ix + OBJ_X) & 0xffff,
    (spec.ix + OBJ_Y) & 0xffff,
  ]) {
    e.mem.write8(addr, SENTINEL);
  }
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and `candidate` on two FRESH, byte-identical entries and diff the full
 * RAM dump. A fresh entry per side because the routine WRITES memory. Returns the first
 * differing RAM byte (or null).
 */
function runPair(base, spec, candidate) {
  const a = makeEntry(base, spec); // oracle
  const b = makeEntry(base, spec); // candidate
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

// A real, self-consistent machine: boot + a stretch of attract so work RAM holds realistic
// values around the crafted pokes.
function attractBase(frames = 300) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone();
}

// The crafted input space. `build` = the pending low bit is set (the tail-build path).
const CRAFTED = [
  // bit0 clear -> early return, no writes.
  { name: "pending clear (early return)", build: false, pending: 0x00, de: 0x6a18, ix: 0x6680, spriteCode: 0x83, bgm: 0x08, marioX: 0x40, marioY: 0x80, offE: 0x05, offF: 0x02 },
  // high bits set but bit0 clear -> still an early return (proves the gate is bit0 only).
  { name: "pending 0x02 (early return)", build: false, pending: 0x02, de: 0x6a1c, ix: 0x6690, spriteCode: 0x9e, bgm: 0x0f, marioX: 0x10, marioY: 0x20, offE: 0x00, offF: 0x00 },
  // bit0 set, facing right (sprite code bit7 set) -> tile 0x9e, object 1.
  { name: "build facing-right obj1", build: true, pending: 0x01, de: 0x6a18, ix: 0x6680, spriteCode: 0x8e, bgm: 0x08, marioX: 0x60, marioY: 0x90, offE: 0x08, offF: 0x10 },
  // bit0 set, facing left (sprite code bit7 clear) -> tile 0x1e, object 2, -disp wraps.
  { name: "build facing-left obj2", build: true, pending: 0x01, de: 0x6a1c, ix: 0x6690, spriteCode: 0x03, bgm: 0x02, marioX: 0x40, marioY: 0x50, offE: 0xf0, offF: 0xf0 },
  // low bit only matters (0x03 still builds), 8-bit position wraps, distinct BGM.
  { name: "build low-bit-only + wraps", build: true, pending: 0x03, de: 0x6a1c, ix: 0x6690, spriteCode: 0x80, bgm: 0x0f, marioX: 0xf0, marioY: 0xf8, offE: 0x30, offF: 0x20 },
];

// The nine bytes a build must produce for a spec (for the non-vacuity assertion).
function expectedBuild(spec) {
  const x = u8(spec.marioX + spec.offE);
  const y = u8(spec.marioY + spec.offF);
  return [
    { addr: (spec.ix + OBJ_FIELD_09) & 0xffff, val: 0x06 },
    { addr: (spec.ix + OBJ_FIELD_0A) & 0xffff, val: 0x03 },
    { addr: SAVED_BGM, val: spec.bgm },
    { addr: (spec.de + SPRITE_X) & 0xffff, val: x },
    { addr: (spec.de + SPRITE_CODE) & 0xffff, val: tileFor(spec.spriteCode) },
    { addr: (spec.de + SPRITE_ATTR) & 0xffff, val: 0x07 },
    { addr: (spec.de + SPRITE_Y) & 0xffff, val: y },
    { addr: (spec.ix + OBJ_X) & 0xffff, val: x },
    { addr: (spec.ix + OBJ_Y) & 0xffff, val: y },
  ];
}

// -- 1. REACHABILITY ----------------------------------------------------------

test("REACHABILITY: 0x2F97 is dispatched during attract (both arms)", () => {
  let total = 0, build = 0, early = 0;
  const snap = new Map([[TARGET, (mm) => {
    total++;
    if (mm.mem.read8(MARIO_HAMMER_PENDING) & 0x01) build++; else early++;
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(2500);
  assert.ok(total > 0, "0x2F97 should be dispatched — entry_2ed4 tail-branches to it");
  assert.ok(build > 0 && early > 0, "expected both the build and early-return arms in attract");
  console.log(`  REACHABILITY: ${total} natural 0x2F97 dispatches in 2500 frames (${build} build, ${early} early-return)`);
});

// -- 2. EQUAL (captured) ------------------------------------------------------

test("EQUAL (captured): loc_2f97 == oracle on every real dispatch", () => {
  // Bucket by arm so the build path (rarer, and it fires only later in the run) is
  // captured too — not just the early-return dispatches that dominate the first frames.
  const early = [], build = [];
  const snap = new Map([[TARGET, (mm) => {
    const bucket = (mm.mem.read8(MARIO_HAMMER_PENDING) & 0x01) ? build : early;
    if (bucket.length < 100) bucket.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(2500);
  const caps = [...early, ...build];
  assert.ok(caps.length >= 1, "expected at least one real 0x2F97 dispatch during attract");
  assert.ok(build.length >= 1, "expected at least one real BUILD dispatch (pending bit set) during attract");

  let sawBuild = 0, sawEarly = 0;
  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    if (a.mem.read8(MARIO_HAMMER_PENDING) & 0x01) sawBuild++; else sawEarly++;
    oracle(a);
    loc_2f97(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      ram,
      null,
      ram && `RAM diverges on real dispatch at ${hx(ram.addr)} (${ram.a}->${ram.b})`,
    );
  }
  console.log(`  EQUAL/captured: ${caps.length} real 0x2F97 dispatches — full RAM == oracle (${sawBuild} build, ${sawEarly} early-return)`);
});

// -- 3. EQUAL (crafted) -------------------------------------------------------

test("EQUAL (crafted): early-return and build arms (both facings, both objects, wraps) match", () => {
  const base = attractBase();
  for (const spec of CRAFTED) {
    const ram = runPair(base, spec, loc_2f97);
    assert.equal(ram, null, ram && `${spec.name}: RAM diverges at ${hx(ram.addr)} (${ram.a}->${ram.b})`);

    const o = makeEntry(base, spec);
    oracle(o);
    if (spec.build) {
      // Non-vacuity: the oracle genuinely wrote the nine expected bytes.
      for (const { addr, val } of expectedBuild(spec)) {
        assert.equal(o.mem.read8(addr), val, `${spec.name}: oracle did not write ${hx(val)} to ${hx(addr)}`);
      }
    } else {
      // Non-vacuity for the early-out: a seeded sentinel survived untouched.
      assert.equal(o.mem.read8((spec.ix + OBJ_FIELD_09) & 0xffff), SENTINEL,
        `${spec.name}: early-return path unexpectedly wrote the object state byte`);
    }
  }
  console.log(`  EQUAL/crafted: ${CRAFTED.length} crafted arms — full RAM == oracle, all writes verified`);
});

// -- 4. TEETH -----------------------------------------------------------------

/** Broken twin (a): stamps the wrong value into object state byte +0x09. */
function brokenWrongStateByte(m) {
  const { regs, mem } = m;
  const objBase = regs.ix;
  if ((mem.read8(MARIO_HAMMER_PENDING) & 0x01) === 0) return;
  mem.write8((objBase + OBJ_FIELD_09) & 0xffff, 0x07); // BUG: 0x07 instead of 0x06
  mem.write8((objBase + OBJ_FIELD_0A) & 0xffff, 0x03);
  regs.b = tileFor(mem.read8(MARIO_SPRITE_CODE));
  regs.c = 0x07;
  mem.write8(SAVED_BGM, mem.read8(SND_BGM));
  loc_2f7c(m);
}

/** Broken twin (b): stores the bare base tile, dropping Mario's facing bit. */
function brokenNoFacing(m) {
  const { regs, mem } = m;
  const objBase = regs.ix;
  if ((mem.read8(MARIO_HAMMER_PENDING) & 0x01) === 0) return;
  mem.write8((objBase + OBJ_FIELD_09) & 0xffff, 0x06);
  mem.write8((objBase + OBJ_FIELD_0A) & 0xffff, 0x03);
  regs.b = SPRITE_TILE; // BUG: dropped the | (facing bit)
  regs.c = 0x07;
  mem.write8(SAVED_BGM, mem.read8(SND_BGM));
  loc_2f7c(m);
}

/** Broken twin (c): inverts the pending gate — builds when it should skip and vice versa. */
function brokenInvertedGate(m) {
  const { regs, mem } = m;
  const objBase = regs.ix;
  if ((mem.read8(MARIO_HAMMER_PENDING) & 0x01) !== 0) return; // BUG: inverted
  mem.write8((objBase + OBJ_FIELD_09) & 0xffff, 0x06);
  mem.write8((objBase + OBJ_FIELD_0A) & 0xffff, 0x03);
  regs.b = tileFor(mem.read8(MARIO_SPRITE_CODE));
  regs.c = 0x07;
  mem.write8(SAVED_BGM, mem.read8(SND_BGM));
  loc_2f7c(m);
}

test("TEETH: wrong-state-byte, dropped-facing, and inverted-gate twins are CAUGHT", () => {
  const base = attractBase();

  // (a) wrong state byte — a build case; the object state byte +0x09 diverges.
  const specA = { name: "teeth-state", build: true, pending: 0x01, de: 0x6a1c, ix: 0x6690, spriteCode: 0x00, bgm: 0x08, marioX: 0x40, marioY: 0x80, offE: 0x05, offF: 0x02 };
  const stateDiff = runPair(base, specA, brokenWrongStateByte);
  assert.notEqual(stateDiff, null, "the wrong-state-byte twin escaped — the gate is worthless");
  assert.equal(stateDiff.addr, (specA.ix + OBJ_FIELD_09) & 0xffff,
    `expected the state diff at the object +0x09 byte ${hx((specA.ix + OBJ_FIELD_09) & 0xffff)}, got ${hx(stateDiff.addr)}`);

  // (b) dropped facing — a facing-RIGHT case (bit7 set), so the record code byte diverges
  // (oracle 0x9e vs twin 0x1e).
  const specB = { name: "teeth-facing", build: true, pending: 0x01, de: 0x6a18, ix: 0x6680, spriteCode: 0x8e, bgm: 0x08, marioX: 0x50, marioY: 0x60, offE: 0x00, offF: 0x00 };
  const facingDiff = runPair(base, specB, brokenNoFacing);
  assert.notEqual(facingDiff, null, "the dropped-facing twin escaped — the gate is worthless");
  assert.equal(facingDiff.addr, (specB.de + SPRITE_CODE) & 0xffff,
    `expected the facing diff at the record code byte ${hx((specB.de + SPRITE_CODE) & 0xffff)}, got ${hx(facingDiff.addr)}`);

  // (c) inverted gate — a build case: the correct routine writes, the twin returns; the
  // first divergence is the lowest cell the build writes (the saved-BGM scratch at 0x6389).
  const specC = { name: "teeth-gate", build: true, pending: 0x01, de: 0x6a18, ix: 0x6680, spriteCode: 0x8e, bgm: 0x08, marioX: 0x40, marioY: 0x80, offE: 0x05, offF: 0x02 };
  const gateDiff = runPair(base, specC, brokenInvertedGate);
  assert.notEqual(gateDiff, null, "the inverted-gate twin escaped — the gate is worthless");
  assert.equal(gateDiff.addr, SAVED_BGM,
    `expected the inverted-gate diff at the saved-BGM cell ${hx(SAVED_BGM)}, got ${hx(gateDiff.addr)}`);

  console.log(`  TEETH: wrong-state caught @${hx(stateDiff.addr)}; dropped-facing caught @${hx(facingDiff.addr)}; inverted-gate caught @${hx(gateDiff.addr)}`);
});
