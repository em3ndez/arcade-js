// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_2f7c (ROM 0x2F7C) — the shared object-sprite record write.
 *
 * loc_2f7c is a LEAF that every build arm of the hammer/object sprite updater tail-calls
 * (`jp 0x2f7c`). Its inputs arrive in registers because those callers are still the
 * translated oracle: the destination sprite-record address, the object-record base, and
 * the tile-code / attribute bytes. From them it writes a 4-byte sprite record positioned
 * at Mario's X/Y plus the object's per-object displacement fields, and mirrors that X/Y
 * back into the object record. It writes ONLY those six cells and touches no stack (its
 * one terminal return pops but never writes), so the memory-equivalence contract is the
 * full RAM dump with NO exclusion — the oracle's residual registers/flags and its return
 * reach no consumer (every caller discards the tail result).
 *
 *   1. REACHABILITY — 0x2F7C is dispatched during attract (the object updater runs it
 *      every serviced frame), so real captured dispatches are available.
 *
 *   2. EQUAL (captured) — hook 0x2F7C in a real attract run, clone at each dispatch, and
 *      confirm loc_2f7c reproduces the oracle's full RAM dump on every real state the game
 *      actually produces (the live object-2 path: record 0x6A1C / object 0x6690).
 *
 *   3. EQUAL (crafted) — poke registers + cells identically on both sides to reach BOTH
 *      object records (0x6680 with record 0x6A18, and 0x6690 with record 0x6A1C), a
 *      positive and a wrapping (0xF0 = -16) displacement on each axis, the 8-bit position
 *      wrap, and distinct code/attribute bytes. Each case also asserts the oracle really
 *      wrote the six expected bytes (non-vacuity), so an all-no-op match cannot pass.
 *
 *   4. TEETH — three deliberately-broken twins the crafted comparison MUST catch:
 *        (a) dropped object mirror — writes the record but not the object's X/Y copy;
 *            caught at the object record's X field.
 *        (b) swapped code/attribute — stores the two sprite bytes into each other's field;
 *            caught at the record's code byte.
 *        (c) dropped Y displacement — stores Mario's raw Y instead of Y + the object's
 *            vertical displacement; caught at the record's Y byte.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2f7c.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2f7c as oracle } from "../../translated/loc_2f7c.js";
import { loc_2f7c } from "../loc_2f7c.js";
import { MARIO_X, MARIO_Y, SPRITE_X, SPRITE_CODE, SPRITE_ATTR, SPRITE_Y, OBJ_X, OBJ_Y } from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2f7c;
// The oracle's terminal `ret` pops the stack; point SP at work RAM so that pop reads
// valid bytes (never I/O). The oracle writes no RAM through the stack, so this choice
// never affects the compared memory — it only keeps the oracle well-defined.
const SAFE_SP = 0x6bf8;

const OBJ_X_DISP = 0x0e; // object-record field: horizontal displacement from Mario
const OBJ_Y_DISP = 0x0f; // object-record field: vertical displacement from Mario

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const u8 = (v) => v & 0xff;

/**
 * A synthetic entry: a clone of `base` with the register live-ins (record address,
 * object base, code, attribute) and the input cells (Mario X/Y, the object's two
 * displacement fields) set, plus a safe stack. `seed` stamps extra sentinel cells
 * (used by the teeth to guarantee a visible divergence). Frame machinery neutralised
 * so the oracle's step machinery cannot fire an NMI or push a frame in isolation.
 */
function makeEntry(base, spec) {
  const e = base.clone();
  e.regs.de = spec.de;
  e.regs.ix = spec.ix;
  e.regs.b = spec.b;
  e.regs.c = spec.c;
  e.mem.write8(MARIO_X, spec.marioX);
  e.mem.write8(MARIO_Y, spec.marioY);
  e.mem.write8((spec.ix + OBJ_X_DISP) & 0xffff, spec.offE);
  e.mem.write8((spec.ix + OBJ_Y_DISP) & 0xffff, spec.offF);
  for (const [addr, val] of spec.seed ?? []) e.mem.write8(addr, val);
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and `candidate` on two FRESH, byte-identical entries and diff the
 * full RAM dump. A fresh entry per side because the routine WRITES memory. Returns
 * the first differing RAM byte (or null).
 */
function runPair(base, spec, candidate) {
  const a = makeEntry(base, spec); // oracle
  const b = makeEntry(base, spec); // candidate
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

// A real, self-consistent machine: boot + a stretch of attract so work RAM holds
// realistic values around the crafted pokes.
function attractBase(frames = 300) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone();
}

// The crafted input space: both object records, both displacement signs, the 8-bit
// wrap, and distinct code/attribute bytes.
const CRAFTED = [
  // Object 2 (the live attract path): record 0x6A1C, object 0x6690.
  { name: "obj2 zero-disp", de: 0x6a1c, ix: 0x6690, b: 0x9e, c: 0x07, marioX: 0xba, marioY: 0xc4, offE: 0x00, offF: 0xf0 },
  { name: "obj2 +disp", de: 0x6a1c, ix: 0x6690, b: 0x42, c: 0x03, marioX: 0x40, marioY: 0x50, offE: 0x08, offF: 0x10 },
  // Object 1: record 0x6A18, object 0x6680.
  { name: "obj1 -disp (0xF0)", de: 0x6a18, ix: 0x6680, b: 0x88, c: 0x0b, marioX: 0x60, marioY: 0x90, offE: 0xf0, offF: 0xf0 },
  { name: "obj1 X wrap", de: 0x6a18, ix: 0x6680, b: 0x10, c: 0x02, marioX: 0xf0, marioY: 0x30, offE: 0x30, offF: 0x08 },
  // Y wrap and a code == attr degenerate byte pair.
  { name: "obj2 Y wrap", de: 0x6a1c, ix: 0x6690, b: 0x00, c: 0x00, marioX: 0x10, marioY: 0xf8, offE: 0x04, offF: 0x20 },
];

// The six bytes the routine must produce for a spec (for the non-vacuity assertion).
function expected(spec) {
  const x = u8(spec.marioX + spec.offE);
  const y = u8(spec.marioY + spec.offF);
  return [
    { addr: (spec.de + SPRITE_X) & 0xffff, val: x },
    { addr: (spec.de + SPRITE_CODE) & 0xffff, val: spec.b },
    { addr: (spec.de + SPRITE_ATTR) & 0xffff, val: spec.c },
    { addr: (spec.de + SPRITE_Y) & 0xffff, val: y },
    { addr: (spec.ix + OBJ_X) & 0xffff, val: x },
    { addr: (spec.ix + OBJ_Y) & 0xffff, val: y },
  ];
}

// -- 1. REACHABILITY ----------------------------------------------------------

test("REACHABILITY: 0x2F7C is dispatched during attract", () => {
  let count = 0;
  const snap = new Map([[TARGET, (mm) => { count++; return oracle(mm); }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(2000);
  assert.ok(count > 0, "0x2F7C should be dispatched — the object sprite updater tail-calls it");
  console.log(`  REACHABILITY: ${count} natural 0x2F7C dispatches in 2000 frames`);
});

// -- 2. EQUAL (captured) ------------------------------------------------------

test("EQUAL (captured): loc_2f7c == oracle on every real dispatch", () => {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => {
    if (caps.length < 128) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(2000);
  assert.ok(caps.length >= 1, "expected at least one real 0x2F7C dispatch during attract");

  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    oracle(a);
    loc_2f7c(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      ram,
      null,
      ram && `RAM diverges on real dispatch at ${hx(ram.addr)} (${ram.a}->${ram.b})`,
    );
  }
  console.log(`  EQUAL/captured: ${caps.length} real 0x2F7C dispatches — full RAM dump == oracle`);
});

// -- 3. EQUAL (crafted) -------------------------------------------------------

test("EQUAL (crafted): both object records, both displacement signs, and the wraps match", () => {
  const base = attractBase();
  for (const spec of CRAFTED) {
    const ram = runPair(base, spec, loc_2f7c);
    assert.equal(ram, null, ram && `${spec.name}: RAM diverges at ${hx(ram.addr)} (${ram.a}->${ram.b})`);

    // Non-vacuity: the oracle genuinely wrote the six expected bytes for this spec.
    const o = makeEntry(base, spec);
    oracle(o);
    for (const { addr, val } of expected(spec)) {
      assert.equal(o.mem.read8(addr), val, `${spec.name}: oracle did not write ${hx(val)} to ${hx(addr)}`);
    }
  }
  console.log(`  EQUAL/crafted: ${CRAFTED.length} crafted arms — full RAM dump == oracle, all writes verified`);
});

// -- 4. TEETH -----------------------------------------------------------------

/** Broken twin (a): writes the sprite record but drops the object mirror. */
function brokenNoMirror(m) {
  const { regs, mem } = m;
  const recordAddr = regs.de, objBase = regs.ix;
  const x = mem.read8(MARIO_X) + mem.read8((objBase + OBJ_X_DISP) & 0xffff);
  mem.write8((recordAddr + SPRITE_X) & 0xffff, x);
  // BUG: object X mirror dropped
  mem.write8((recordAddr + SPRITE_CODE) & 0xffff, regs.b);
  mem.write8((recordAddr + SPRITE_ATTR) & 0xffff, regs.c);
  const y = mem.read8(MARIO_Y) + mem.read8((objBase + OBJ_Y_DISP) & 0xffff);
  mem.write8((recordAddr + SPRITE_Y) & 0xffff, y);
  // BUG: object Y mirror dropped
}

/** Broken twin (b): stores the two sprite bytes into each other's field. */
function brokenSwapCodeAttr(m) {
  const { regs, mem } = m;
  const recordAddr = regs.de, objBase = regs.ix;
  const x = mem.read8(MARIO_X) + mem.read8((objBase + OBJ_X_DISP) & 0xffff);
  mem.write8((recordAddr + SPRITE_X) & 0xffff, x);
  mem.write8((objBase + OBJ_X) & 0xffff, x);
  mem.write8((recordAddr + SPRITE_CODE) & 0xffff, regs.c); // BUG: attr into code
  mem.write8((recordAddr + SPRITE_ATTR) & 0xffff, regs.b); // BUG: code into attr
  const y = mem.read8(MARIO_Y) + mem.read8((objBase + OBJ_Y_DISP) & 0xffff);
  mem.write8((recordAddr + SPRITE_Y) & 0xffff, y);
  mem.write8((objBase + OBJ_Y) & 0xffff, y);
}

/** Broken twin (c): stores Mario's raw Y, dropping the object's vertical displacement. */
function brokenNoYOffset(m) {
  const { regs, mem } = m;
  const recordAddr = regs.de, objBase = regs.ix;
  const x = mem.read8(MARIO_X) + mem.read8((objBase + OBJ_X_DISP) & 0xffff);
  mem.write8((recordAddr + SPRITE_X) & 0xffff, x);
  mem.write8((objBase + OBJ_X) & 0xffff, x);
  mem.write8((recordAddr + SPRITE_CODE) & 0xffff, regs.b);
  mem.write8((recordAddr + SPRITE_ATTR) & 0xffff, regs.c);
  const y = mem.read8(MARIO_Y); // BUG: dropped the + OBJ_Y_DISP field
  mem.write8((recordAddr + SPRITE_Y) & 0xffff, y);
  mem.write8((objBase + OBJ_Y) & 0xffff, y);
}

test("TEETH: dropped-mirror, swapped-code/attr, and dropped-Y-displacement twins are CAUGHT", () => {
  const base = attractBase();

  // (a) dropped mirror: sentinel the object X/Y so the missing writes visibly differ.
  const specA = {
    name: "teeth-mirror", de: 0x6a18, ix: 0x6680, b: 0x88, c: 0x0b,
    marioX: 0x40, marioY: 0x80, offE: 0x05, offF: 0x02,
    seed: [[(0x6680 + OBJ_X) & 0xffff, 0x00], [(0x6680 + OBJ_Y) & 0xffff, 0x00]],
  };
  const mirrorDiff = runPair(base, specA, brokenNoMirror);
  assert.notEqual(mirrorDiff, null, "the dropped-object-mirror twin escaped — the gate is worthless");
  assert.equal(mirrorDiff.addr, (0x6680 + OBJ_X) & 0xffff,
    `expected the mirror diff at the object X field ${hx((0x6680 + OBJ_X) & 0xffff)}, got ${hx(mirrorDiff.addr)}`);

  // (b) swapped code/attr: code 0x9e != attr 0x07, so the record's code byte diverges.
  const specB = { name: "teeth-swap", de: 0x6a1c, ix: 0x6690, b: 0x9e, c: 0x07, marioX: 0x50, marioY: 0x60, offE: 0x00, offF: 0x00 };
  const swapDiff = runPair(base, specB, brokenSwapCodeAttr);
  assert.notEqual(swapDiff, null, "the swapped-code/attr twin escaped — the gate is worthless");
  assert.equal(swapDiff.addr, (0x6a1c + SPRITE_CODE) & 0xffff,
    `expected the swap diff at the record code byte ${hx((0x6a1c + SPRITE_CODE) & 0xffff)}, got ${hx(swapDiff.addr)}`);

  // (c) dropped Y displacement: offF 0x10 != 0, so the wrong Y lands in BOTH the record
  // Y byte and the object Y mirror; the lowest-address diverging cell is the object Y
  // field, which the diff reports first.
  const specC = { name: "teeth-yoff", de: 0x6a18, ix: 0x6680, b: 0x10, c: 0x02, marioX: 0x20, marioY: 0x50, offE: 0x00, offF: 0x10 };
  const yDiff = runPair(base, specC, brokenNoYOffset);
  assert.notEqual(yDiff, null, "the dropped-Y-displacement twin escaped — the gate is worthless");
  assert.equal(yDiff.addr, (0x6680 + OBJ_Y) & 0xffff,
    `expected the Y-displacement diff at the object Y field ${hx((0x6680 + OBJ_Y) & 0xffff)}, got ${hx(yDiff.addr)}`);

  console.log(`  TEETH: dropped-mirror caught @${hx(mirrorDiff.addr)}; swapped-code/attr caught @${hx(swapDiff.addr)}; dropped-Y caught @${hx(yDiff.addr)}`);
});
