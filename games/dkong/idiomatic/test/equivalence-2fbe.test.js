// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_2fbe (ROM 0x2FBE) — the blink-phase attribute arm of the
 * object-sprite updater.
 *
 * loc_2fbe is one of the build arms that tail-call the shared record write (loc_2f7c).
 * Its whole added behaviour is a one-bit decision: read the frame counter, and on the
 * half of its 16-frame cycle where bit 3 is set force the sprite attribute to 1 —
 * otherwise pass the caller's attribute (in the attribute register) straight through —
 * then commit the four-byte sprite record via loc_2f7c. So its memory effect is exactly
 * loc_2f7c's six-cell record write with the attribute byte chosen by FRAME bit 3.
 *
 * The oracle tail-jumps into loc_2f7c (`jp 0x2f7c`), whose terminal `ret` pops the stack;
 * neither routine WRITES the stack (loc_2fbe pushes nothing; loc_2f7c only pops), so the
 * memory-equivalence contract is the FULL RAM dump with NO exclusion. The residual
 * registers/flags and the terminal return reach no consumer — every caller of this arm
 * discards the tail result — so live-out is memory-only (pc/SP are not compared).
 *
 *   1. REACHABILITY — 0x2FBE is dispatched during attract (the hammer flash), so real
 *      captured dispatches are available; both blink phases occur naturally.
 *
 *   2. EQUAL (captured) — hook 0x2FBE in a real attract run, clone at each dispatch, and
 *      confirm loc_2fbe reproduces the oracle's full RAM dump on every real state (entry
 *      attribute 0x07, both phases).
 *
 *   3. EQUAL (crafted) — poke registers + cells identically on both sides to reach BOTH
 *      blink phases against BOTH object records (0x6680/record 0x6A18, 0x6690/record
 *      0x6A1C), several pass-through attribute values, and the 8-bit X/Y position wraps.
 *      Each case also asserts the oracle wrote the six expected bytes (non-vacuity), so an
 *      all-no-op match cannot pass.
 *
 *   4. TEETH — three deliberately-broken twins the comparison MUST catch, each caught at
 *      the record's attribute byte:
 *        (a) inverted phase — blinks on the wrong half of the cycle;
 *        (b) wrong blink attribute — forces 2 instead of 1;
 *        (c) never blink — always passes the caller's attribute through.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2fbe.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2fbe as oracle } from "../../translated/loc_2fbe.js";
import { blinkHammerSpriteOnFramePhase as loc_2fbe } from "../blinkHammerSpriteOnFramePhase.js";
import { commitSpriteRecordAtMarioOffset as loc_2f7c } from "../commitSpriteRecordAtMarioOffset.js"; // the proven-equal record-write tail, used by the teeth
import { FRAME, MARIO_X, MARIO_Y, SPRITE_X, SPRITE_CODE, SPRITE_ATTR, SPRITE_Y, OBJ_X, OBJ_Y } from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2fbe;
// The oracle tail-jumps into loc_2f7c, whose terminal `ret` pops the stack; point SP at
// work RAM so that pop reads valid bytes (never I/O). Neither routine writes RAM through
// the stack, so this choice never affects the compared memory.
const SAFE_SP = 0x6bf8;

const BLINK_PHASE_BIT = 0x08; // FRAME bit 3 — the blink-phase selector
const BLINK_ATTR = 1;         // attribute forced during the blink half
const OBJ_X_DISP = 0x0e;      // object-record field: horizontal displacement from Mario
const OBJ_Y_DISP = 0x0f;      // object-record field: vertical displacement from Mario

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const u8 = (v) => v & 0xff;

/**
 * A synthetic entry: a clone of `base` with the register live-ins (record address, object
 * base, tile code, attribute), the input cells (Mario X/Y, the object's two displacement
 * fields), and the frame counter set, plus a safe stack. Frame machinery neutralised so
 * the oracle's step machinery cannot fire an NMI or push a frame in isolation.
 */
function makeEntry(base, spec) {
  const e = base.clone();
  e.regs.de = spec.de;
  e.regs.ix = spec.ix;
  e.regs.b = spec.b;
  e.regs.c = spec.c;
  e.mem.write8(FRAME, spec.frame);
  e.mem.write8(MARIO_X, spec.marioX);
  e.mem.write8(MARIO_Y, spec.marioY);
  e.mem.write8((spec.ix + OBJ_X_DISP) & 0xffff, spec.offE);
  e.mem.write8((spec.ix + OBJ_Y_DISP) & 0xffff, spec.offF);
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

// A real, self-consistent machine: boot + a stretch of attract so work RAM holds
// realistic values around the crafted pokes.
function attractBase(frames = 300) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone();
}

// The attribute the routine must store for a spec: forced to 1 on the blink half, else
// the caller's pass-through value.
const attrFor = (spec) => (spec.frame & BLINK_PHASE_BIT ? BLINK_ATTR : spec.c);

// The crafted input space: both blink phases, both object records, several pass-through
// attributes, and the 8-bit X/Y wraps.
const CRAFTED = [
  // Blink phase CLEAR (FRAME bit 3 = 0) — attribute passes through unchanged.
  { name: "clr-phase obj2 pass 0x07", frame: 0x00, de: 0x6a1c, ix: 0x6690, b: 0x88, c: 0x07, marioX: 0xba, marioY: 0xc4, offE: 0x00, offF: 0xf0 },
  { name: "clr-phase obj1 pass 0x03", frame: 0xf0, de: 0x6a18, ix: 0x6680, b: 0x42, c: 0x03, marioX: 0x40, marioY: 0x50, offE: 0x08, offF: 0x10 },
  { name: "clr-phase obj1 pass 0x00, X wrap", frame: 0x07, de: 0x6a18, ix: 0x6680, b: 0x10, c: 0x00, marioX: 0xf0, marioY: 0x30, offE: 0x30, offF: 0x08 },
  // Blink phase SET (FRAME bit 3 = 1) — attribute forced to 1 regardless of entry value.
  { name: "set-phase obj2 blink over 0x07", frame: 0x08, de: 0x6a1c, ix: 0x6690, b: 0x9e, c: 0x07, marioX: 0x60, marioY: 0x90, offE: 0xf0, offF: 0xf0 },
  { name: "set-phase obj1 blink over 0x0b, Y wrap", frame: 0xff, de: 0x6a18, ix: 0x6680, b: 0x88, c: 0x0b, marioX: 0x10, marioY: 0xf8, offE: 0x04, offF: 0x20 },
  { name: "set-phase obj2 blink over 0x01", frame: 0x0c, de: 0x6a1c, ix: 0x6690, b: 0x00, c: 0x01, marioX: 0x50, marioY: 0x60, offE: 0x00, offF: 0x00 },
];

// The six bytes the routine must produce for a spec (for the non-vacuity assertion).
function expected(spec) {
  const x = u8(spec.marioX + spec.offE);
  const y = u8(spec.marioY + spec.offF);
  return [
    { addr: (spec.de + SPRITE_X) & 0xffff, val: x },
    { addr: (spec.de + SPRITE_CODE) & 0xffff, val: spec.b },
    { addr: (spec.de + SPRITE_ATTR) & 0xffff, val: attrFor(spec) },
    { addr: (spec.de + SPRITE_Y) & 0xffff, val: y },
    { addr: (spec.ix + OBJ_X) & 0xffff, val: x },
    { addr: (spec.ix + OBJ_Y) & 0xffff, val: y },
  ];
}

// -- 1. REACHABILITY ----------------------------------------------------------

test("REACHABILITY: 0x2FBE is dispatched during attract (both blink phases)", () => {
  let count = 0;
  const phases = new Set();
  const snap = new Map([[TARGET, (mm) => {
    count++;
    phases.add(mm.mem.read8(FRAME) & BLINK_PHASE_BIT ? "set" : "clr");
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(4000);
  assert.ok(count > 0, "0x2FBE should be dispatched — the hammer updater flashes through it");
  assert.ok(phases.has("set") && phases.has("clr"), "both blink phases should occur naturally");
  console.log(`  REACHABILITY: ${count} natural 0x2FBE dispatches in 4000 frames; phases ${[...phases].join(",")}`);
});

// -- 2. EQUAL (captured) ------------------------------------------------------

test("EQUAL (captured): loc_2fbe == oracle on every real dispatch", () => {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => {
    if (caps.length < 128) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(4000);
  assert.ok(caps.length >= 1, "expected at least one real 0x2FBE dispatch during attract");

  let sawSet = 0, sawClr = 0;
  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    (a.mem.read8(FRAME) & BLINK_PHASE_BIT) ? sawSet++ : sawClr++;
    oracle(a);
    loc_2fbe(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      ram,
      null,
      ram && `RAM diverges on real dispatch at ${hx(ram.addr)} (${ram.a}->${ram.b})`,
    );
  }
  console.log(`  EQUAL/captured: ${caps.length} real 0x2FBE dispatches — full RAM dump == oracle (${sawSet} blink, ${sawClr} pass-through)`);
});

// -- 3. EQUAL (crafted) -------------------------------------------------------

test("EQUAL (crafted): both blink phases, both object records, and the wraps match", () => {
  const base = attractBase();
  for (const spec of CRAFTED) {
    const ram = runPair(base, spec, loc_2fbe);
    assert.equal(ram, null, ram && `${spec.name}: RAM diverges at ${hx(ram.addr)} (${ram.a}->${ram.b})`);

    // Non-vacuity: the oracle genuinely wrote the six expected bytes (incl. the
    // phase-selected attribute) for this spec.
    const o = makeEntry(base, spec);
    oracle(o);
    for (const { addr, val } of expected(spec)) {
      assert.equal(o.mem.read8(addr), val, `${spec.name}: oracle did not write ${hx(val)} to ${hx(addr)}`);
    }
  }
  console.log(`  EQUAL/crafted: ${CRAFTED.length} crafted arms — full RAM dump == oracle, all writes verified`);
});

// -- 4. TEETH -----------------------------------------------------------------
//
// Each twin makes the WRONG attribute decision, then commits through the proven-equal
// record-write tail (loc_2f7c) — so the only possible divergence is the attribute byte,
// which is exactly loc_2fbe's added behaviour.

/** Broken twin (a): blinks on the wrong half of the frame cycle. */
function brokenInvertedPhase(m) {
  if ((m.mem.read8(FRAME) & BLINK_PHASE_BIT) === 0) m.regs.c = BLINK_ATTR; // BUG: inverted
  loc_2f7c(m);
}

/** Broken twin (b): forces attribute 2 instead of 1 during the blink half. */
function brokenWrongAttr(m) {
  if ((m.mem.read8(FRAME) & BLINK_PHASE_BIT) !== 0) m.regs.c = 2; // BUG: wrong value
  loc_2f7c(m);
}

/** Broken twin (c): never blinks — always passes the caller's attribute through. */
function brokenNeverBlink(m) {
  loc_2f7c(m); // BUG: the blink override is dropped
}

test("TEETH: inverted-phase, wrong-attribute, and never-blink twins are CAUGHT", () => {
  const base = attractBase();
  const attrAddr = (de) => (de + SPRITE_ATTR) & 0xffff;

  // (a) inverted phase on a CLEAR-phase case: oracle passes 0x07 through, twin blinks to 1.
  const specA = { name: "teeth-invert", frame: 0x00, de: 0x6a18, ix: 0x6680, b: 0x88, c: 0x07, marioX: 0x40, marioY: 0x80, offE: 0x05, offF: 0x02 };
  const invDiff = runPair(base, specA, brokenInvertedPhase);
  assert.notEqual(invDiff, null, "the inverted-phase twin escaped — the gate is worthless");
  assert.equal(invDiff.addr, attrAddr(specA.de),
    `expected the inverted-phase diff at the record attribute byte ${hx(attrAddr(specA.de))}, got ${hx(invDiff.addr)}`);

  // (b) wrong blink attribute on a SET-phase case: oracle forces 1, twin forces 2.
  const specB = { name: "teeth-wrong-attr", frame: 0x08, de: 0x6a1c, ix: 0x6690, b: 0x9e, c: 0x07, marioX: 0x50, marioY: 0x60, offE: 0x00, offF: 0x00 };
  const wrongDiff = runPair(base, specB, brokenWrongAttr);
  assert.notEqual(wrongDiff, null, "the wrong-attribute twin escaped — the gate is worthless");
  assert.equal(wrongDiff.addr, attrAddr(specB.de),
    `expected the wrong-attribute diff at the record attribute byte ${hx(attrAddr(specB.de))}, got ${hx(wrongDiff.addr)}`);

  // (c) never blink on a SET-phase case: oracle forces 1, twin keeps 0x07.
  const specC = { name: "teeth-never-blink", frame: 0x0c, de: 0x6a18, ix: 0x6680, b: 0x10, c: 0x07, marioX: 0x20, marioY: 0x50, offE: 0x00, offF: 0x10 };
  const neverDiff = runPair(base, specC, brokenNeverBlink);
  assert.notEqual(neverDiff, null, "the never-blink twin escaped — the gate is worthless");
  assert.equal(neverDiff.addr, attrAddr(specC.de),
    `expected the never-blink diff at the record attribute byte ${hx(attrAddr(specC.de))}, got ${hx(neverDiff.addr)}`);

  console.log(`  TEETH: inverted-phase caught @${hx(invDiff.addr)}; wrong-attribute caught @${hx(wrongDiff.addr)}; never-blink caught @${hx(neverDiff.addr)}`);
});
