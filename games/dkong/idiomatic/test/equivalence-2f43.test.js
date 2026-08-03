// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_2f43 (ROM 0x2F43) — the active-hammer per-frame updater.
 *
 * loc_2f43 stamps the caller's hammer sprite code into Mario's sprite record, resets the
 * shared record attribute, ticks the 16-bit hammer duration counter (HAMMER_TIMER_LO/HI),
 * and routes on how far it has run:
 *   - low byte advances without wrapping  -> selectHammerSpriteBlinkByTimer (0x2FB7);
 *   - low byte wraps, high byte now non-expiry -> blinkHammerSpriteOnFramePhase (0x2FBE);
 *   - low byte wraps, high byte reaches 2 (~512 counts) -> END the hammer: reset the
 *     counter high byte, clear MARIO_HAMMER_ACTIVE, deactivate the object and park its
 *     sprite at the screen origin, restore Mario's sprite code + the saved tune, then
 *     commit the cleared record (commitSpriteRecordAtMarioOffset, 0x2F7C).
 * All three routes tail-call the shared record write; the record destination, object
 * base, and tile code pass through in registers (the still-translated caller boundary).
 *
 * Neither this updater nor any tail WRITES the stack: loc_2f43 pushes nothing (every exit
 * is a jump/fall-through), the two build arms push nothing, and loc_2f7c only pops (a
 * read). So the memory-equivalence contract is the FULL RAM dump with NO exclusion. The
 * residual registers/flags and the tails' terminal return reach no consumer — every
 * caller of this updater discards the result — so live-out is memory-only (pc/SP are not
 * compared).
 *
 *   1. REACHABILITY — 0x2F43 is dispatched every frame an attract hammer is active; the
 *      common route is the low-byte tick (select arm), with the wrap (blink) and expiry
 *      routes at the 256- and 512-count boundaries.
 *
 *   2. EQUAL (captured) — hook 0x2F43 in a real attract run, clone at each dispatch, and
 *      confirm loc_2f43 reproduces the oracle's full RAM dump on every real state.
 *
 *   3. EQUAL (crafted) — poke registers + counter cells identically on both sides to reach
 *      ALL routes: the select arm with the timer high byte both zero (direct write) and set
 *      (blink), the low-byte wrap boundary, the 256-count wrap into the blink arm (both
 *      blink phases), and the 512-count EXPIRY teardown (counter reset, hammer-flag clear,
 *      sprite park, code+tune restore) across both object records and the 8-bit position
 *      wraps. Each case also asserts the oracle wrote its route-defining bytes (non-vacuity).
 *
 *   4. TEETH — three deliberately-broken twins the comparison MUST catch:
 *        (a) inverted low-byte-wrap gate — selects when it should carry and vice versa;
 *        (b) wrong expiry threshold — never tears the hammer down at 512;
 *        (c) dropped hammer-flag clear — leaves MARIO_HAMMER_ACTIVE set through expiry.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2f43.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2f43 as oracle } from "../../translated/loc_2f43.js";
import { updateActiveHammer as loc_2f43 } from "../updateActiveHammer.js";
import { selectHammerSpriteBlinkByTimer } from "../selectHammerSpriteBlinkByTimer.js"; // proven-equal select arm (0x2FB7), used by the teeth
import { blinkHammerSpriteOnFramePhase } from "../blinkHammerSpriteOnFramePhase.js";   // proven-equal blink arm (0x2FBE), used by the teeth
import { commitSpriteRecordAtMarioOffset } from "../commitSpriteRecordAtMarioOffset.js"; // proven-equal record write (0x2F7C), used by the teeth
import {
  HAMMER_TIMER_LO, HAMMER_TIMER_HI, MARIO_HAMMER_ACTIVE,
  MARIO_X, MARIO_Y, MARIO_SPRITE_CODE, MARIO_SPRITE_RECORD,
  SPRITE_X, SPRITE_CODE, SPRITE_ATTR, SPRITE_Y, OBJ_ACTIVE, OBJ_X, OBJ_Y, SND_BGM, FRAME,
  HAMMER_SAVED_BGM as SAVED_BGM,
} from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2f43;
// The expiry/blink/direct routes all end in loc_2f7c's terminal `ret`, which pops the
// stack; point SP at work RAM so that pop reads valid bytes (never I/O). No routine in
// the chain writes RAM through the stack, so this choice never affects the compared memory.
const SAFE_SP = 0x6bf8;

const BLINK_PHASE_BIT = 0x08; // FRAME bit 3 — the blink-phase selector inside the blink arm
const BLINK_ATTR = 0x01;      // attribute forced during the blink half
const RECORD_ATTR = 0x07;     // shared attribute loc_2f43 sets for the record write
const EXPIRY_HIGH = 0x02;     // counter high byte at which the hammer's ~512-count life is up
const OBJ_FIELD_01 = 0x01;    // object-record field cleared on expiry
const OBJ_X_DISP = 0x0e;      // object-record field: horizontal displacement from Mario
const OBJ_Y_DISP = 0x0f;      // object-record field: vertical displacement from Mario
const HAMMER_SPRITE_CELL = MARIO_SPRITE_RECORD + SPRITE_CODE; // 0x694D — Mario record's code byte

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const u8 = (v) => v & 0xff;

// Which COUNTER route loc_2f43 takes for a given entry, from the counter's pre-tick state
// (used for reachability/capture reporting): the low-byte tick (select), the 256-count wrap
// (blink), or the 512-count expiry.
function routeOf(lo, hi) {
  if (u8(lo + 1) !== 0) return "select";
  return u8(hi + 1) === EXPIRY_HIGH ? "expiry" : "blink";
}

// Which SPRITE ARM ultimately writes the record — the outcome a crafted spec is labelled by:
//   - "direct": the select route with the timer high byte zero (attribute passes 0x07);
//   - "blink":  the select route with the high byte set, OR the 256-count wrap route;
//   - "expiry": the 512-count teardown (attribute passes 0x07).
function armOf(spec) {
  const r = routeOf(spec.lo, spec.hi);
  if (r === "expiry") return "expiry";
  if (r === "blink") return "blink";
  return u8(spec.hi) === 0 ? "direct" : "blink"; // select route: sub-branch on the high byte
}

const loWraps = (spec) => u8(spec.lo + 1) === 0;
const isExpiry = (spec) => spec.path === "expiry";
// The attribute the record ends up with: direct/expiry store the shared 0x07; the blink
// arm forces 1 on the blink-phase half, else passes the shared 0x07 through.
const attrFor = (spec) =>
  spec.path === "blink"
    ? ((spec.frame & BLINK_PHASE_BIT) ? BLINK_ATTR : RECORD_ATTR)
    : RECORD_ATTR;

/**
 * A synthetic entry: a clone of `base` with the register live-ins (record address, object
 * base, tile code, and the caller's hammer sprite code), the counter cells that select the
 * route, and the input cells the tails read (Mario X/Y and sprite code, the object's two
 * displacement fields, the frame counter, the saved tune). MARIO_HAMMER_ACTIVE is set live
 * (1) and SND_BGM to a sentinel distinct from the saved tune so the expiry restore is
 * observable. Frame machinery neutralised so the oracle's step machinery cannot fire an NMI.
 */
function makeEntry(base, spec) {
  const e = base.clone();
  e.regs.de = spec.de;
  e.regs.ix = spec.ix;
  e.regs.b = spec.b;
  e.regs.c = spec.c;
  e.mem.write8(HAMMER_TIMER_LO, spec.lo);
  e.mem.write8(HAMMER_TIMER_HI, spec.hi);
  e.mem.write8(FRAME, spec.frame);
  e.mem.write8(MARIO_X, spec.marioX);
  e.mem.write8(MARIO_Y, spec.marioY);
  e.mem.write8(MARIO_SPRITE_CODE, spec.marioSpriteCode);
  e.mem.write8(MARIO_HAMMER_ACTIVE, 0x01);
  e.mem.write8(SND_BGM, 0xee);              // sentinel != savedBgm -> the restore is visible
  e.mem.write8(SAVED_BGM, spec.savedBgm);
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

// A real, self-consistent machine: boot + a stretch of attract so work RAM holds realistic
// values around the crafted pokes.
function attractBase(frames = 300) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone();
}

// The crafted input space: the select arm with the timer high byte zero (direct) and set
// (blink), the low-byte wrap boundary, the 256-count wrap into the blink arm (both phases),
// and the 512-count expiry — across both object records and the 8-bit position wraps.
const CRAFTED = [
  // SELECT arm, high byte zero -> direct write; attribute is the shared 0x07, the caller's
  // c (0x8a) is stamped into Mario's record code byte, not the record attribute.
  { name: "select-direct hi=0", path: "direct", lo: 0x10, hi: 0x00, frame: 0x00, de: 0x6a18, ix: 0x6680, b: 0x88, c: 0x8a, marioX: 0x40, marioY: 0x50, marioSpriteCode: 0x0e, savedBgm: 0x04, offE: 0x08, offF: 0x10 },
  // SELECT arm, high byte zero, low byte at the wrap boundary (0xfe -> 0xff, still no wrap),
  // blink phase set (ignored on the direct sub-branch).
  { name: "select-direct hi=0, lo=0xfe boundary, phase set", path: "direct", lo: 0xfe, hi: 0x00, frame: 0x08, de: 0x6a1c, ix: 0x6690, b: 0x42, c: 0x88, marioX: 0x60, marioY: 0x90, marioSpriteCode: 0x8e, savedBgm: 0x06, offE: 0x00, offF: 0xf0 },
  // SELECT arm, high byte set -> blink sub-branch, phase CLEAR (attribute passes 0x07).
  { name: "select-blink hi=1, phase clr", path: "blink", lo: 0x10, hi: 0x01, frame: 0xf0, de: 0x6a18, ix: 0x6680, b: 0x9e, c: 0x33, marioX: 0xba, marioY: 0xc4, marioSpriteCode: 0x0f, savedBgm: 0x04, offE: 0x00, offF: 0x00 },
  // SELECT arm, high byte set -> blink sub-branch, phase SET (attribute forced to 1), Y wrap.
  { name: "select-blink hi=1, phase SET, Y wrap", path: "blink", lo: 0x10, hi: 0x01, frame: 0x08, de: 0x6a1c, ix: 0x6690, b: 0x88, c: 0x0b, marioX: 0x10, marioY: 0xf8, marioSpriteCode: 0x03, savedBgm: 0x02, offE: 0x04, offF: 0x20 },
  // WRAP into blink arm: low wraps 0xff -> 0, high 0 -> 1 (not expiry), phase SET, X wrap.
  { name: "wrap-blink hi 0->1, phase SET, X wrap", path: "blink", lo: 0xff, hi: 0x00, frame: 0x08, de: 0x6a18, ix: 0x6680, b: 0x88, c: 0x07, marioX: 0xf0, marioY: 0x60, marioSpriteCode: 0x0e, savedBgm: 0x04, offE: 0x30, offF: 0x08 },
  // WRAP into blink arm with a larger high byte: low wraps, high 5 -> 6 (not expiry), phase clr.
  { name: "wrap-blink hi 5->6, phase clr", path: "blink", lo: 0xff, hi: 0x05, frame: 0x00, de: 0x6a1c, ix: 0x6690, b: 0x00, c: 0x07, marioX: 0x20, marioY: 0x70, marioSpriteCode: 0x06, savedBgm: 0x08, offE: 0x00, offF: 0x00 },
  // EXPIRY: low wraps 0xff -> 0, high 1 -> 2 -> tear the hammer down and commit, obj record 1.
  { name: "EXPIRY hi 1->2, obj1", path: "expiry", lo: 0xff, hi: 0x01, frame: 0x00, de: 0x6a18, ix: 0x6680, b: 0x88, c: 0x07, marioX: 0x40, marioY: 0x80, marioSpriteCode: 0x0e, savedBgm: 0x04, offE: 0x30, offF: 0x22 },
  // EXPIRY, obj record 2, with a big Mario X (the parked sprite X still resolves to 0).
  { name: "EXPIRY hi 1->2, obj2, big marioX", path: "expiry", lo: 0xff, hi: 0x01, frame: 0xff, de: 0x6a1c, ix: 0x6690, b: 0x9e, c: 0x07, marioX: 0xf0, marioY: 0x30, marioSpriteCode: 0x8e, savedBgm: 0x06, offE: 0x11, offF: 0x08 },
];

// The route-defining bytes the oracle must produce for a spec (non-vacuity). The record X
// on expiry is parked at 0 (X-displacement becomes -marioX, so marioX + it wraps to 0).
function expected(spec) {
  const recX = isExpiry(spec) ? 0 : u8(spec.marioX + spec.offE);
  const recY = u8(spec.marioY + spec.offF);
  const list = [
    { addr: HAMMER_TIMER_LO, val: u8(spec.lo + 1) },
    { addr: HAMMER_SPRITE_CELL, val: isExpiry(spec) ? spec.marioSpriteCode : spec.c },
    { addr: (spec.de + SPRITE_X) & 0xffff, val: recX },
    { addr: (spec.de + SPRITE_CODE) & 0xffff, val: spec.b },
    { addr: (spec.de + SPRITE_ATTR) & 0xffff, val: attrFor(spec) },
    { addr: (spec.de + SPRITE_Y) & 0xffff, val: recY },
    { addr: (spec.ix + OBJ_X) & 0xffff, val: recX },
    { addr: (spec.ix + OBJ_Y) & 0xffff, val: recY },
    { addr: HAMMER_TIMER_HI, val: isExpiry(spec) ? 0 : (loWraps(spec) ? u8(spec.hi + 1) : spec.hi) },
  ];
  if (isExpiry(spec)) {
    list.push({ addr: MARIO_HAMMER_ACTIVE, val: 0 });
    list.push({ addr: SND_BGM, val: spec.savedBgm });
    list.push({ addr: (spec.ix + OBJ_ACTIVE) & 0xffff, val: 0 });
    list.push({ addr: (spec.ix + OBJ_FIELD_01) & 0xffff, val: 0 });
    list.push({ addr: (spec.ix + OBJ_X_DISP) & 0xffff, val: u8(-spec.marioX) });
  }
  return list;
}

// -- 1. REACHABILITY ----------------------------------------------------------

test("REACHABILITY: 0x2F43 is dispatched during attract (hammer active)", () => {
  const counts = { select: 0, blink: 0, expiry: 0 };
  const snap = new Map([[TARGET, (mm) => {
    counts[routeOf(mm.mem.read8(HAMMER_TIMER_LO), mm.mem.read8(HAMMER_TIMER_HI))]++;
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(6000);
  const total = counts.select + counts.blink + counts.expiry;
  assert.ok(total > 0, "0x2F43 should be dispatched while an attract hammer is active");
  assert.ok(counts.select > 0, "the low-byte tick (select) route should occur naturally");
  console.log(`  REACHABILITY: ${total} natural 0x2F43 dispatches in 6000 frames (select ${counts.select}, blink ${counts.blink}, expiry ${counts.expiry})`);
});

// -- 2. EQUAL (captured) ------------------------------------------------------

test("EQUAL (captured): loc_2f43 == oracle on every real dispatch", () => {
  const caps = [];
  const byRoute = { select: 0, blink: 0, expiry: 0 };
  const snap = new Map([[TARGET, (mm) => {
    const r = routeOf(mm.mem.read8(HAMMER_TIMER_LO), mm.mem.read8(HAMMER_TIMER_HI));
    if (caps.length < 200) { caps.push(mm.clone()); byRoute[r]++; }
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(6000);
  assert.ok(caps.length >= 1, "expected at least one real 0x2F43 dispatch during attract");

  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    oracle(a);
    loc_2f43(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(ram, null, ram && `RAM diverges on real dispatch at ${hx(ram.addr)} (${ram.a}->${ram.b})`);
  }
  console.log(`  EQUAL/captured: ${caps.length} real 0x2F43 dispatches — full RAM dump == oracle (select ${byRoute.select}, blink ${byRoute.blink}, expiry ${byRoute.expiry})`);
});

// -- 3. EQUAL (crafted) -------------------------------------------------------

test("EQUAL (crafted): all routes, both object records, both blink phases, and the wraps match", () => {
  const base = attractBase();
  for (const spec of CRAFTED) {
    // Sanity: the spec's counter cells actually drive the sprite arm it claims.
    assert.equal(armOf(spec), spec.path, `${spec.name}: spec does not drive its declared arm`);

    const ram = runPair(base, spec, loc_2f43);
    assert.equal(ram, null, ram && `${spec.name}: RAM diverges at ${hx(ram.addr)} (${ram.a}->${ram.b})`);

    // Non-vacuity: the oracle genuinely wrote this route's defining bytes.
    const o = makeEntry(base, spec);
    oracle(o);
    for (const { addr, val } of expected(spec)) {
      assert.equal(o.mem.read8(addr), val, `${spec.name}: oracle did not write ${hx(val)} to ${hx(addr)}`);
    }
  }
  console.log(`  EQUAL/crafted: ${CRAFTED.length} crafted routes — full RAM dump == oracle, all route-defining writes verified`);
});

// -- 4. TEETH -----------------------------------------------------------------
//
// Each twin reuses the proven-equal callees, so the only possible divergence is loc_2f43's
// own routing/teardown logic.

/** Faithful entry prologue shared by the twins: stamp the caller's code, set the attribute. */
function prologue(m) {
  const { regs, mem } = m;
  mem.write8(HAMMER_SPRITE_CELL, regs.c);
  regs.c = RECORD_ATTR;
}

/** Broken twin (a): inverted low-byte-wrap gate — selects when it should carry, carries when
 *  it should select. On a select spec it wrongly touches the high byte and blinks. */
function brokenInvertedWrapGate(m) {
  const { mem } = m;
  prologue(m);
  const lo = u8(mem.read8(HAMMER_TIMER_LO) + 1);
  mem.write8(HAMMER_TIMER_LO, lo);
  if (lo === 0) { selectHammerSpriteBlinkByTimer(m); return; } // BUG: should be `lo !== 0`
  const hi = u8(mem.read8(HAMMER_TIMER_HI) + 1);
  mem.write8(HAMMER_TIMER_HI, hi);
  if (hi !== EXPIRY_HIGH) { blinkHammerSpriteOnFramePhase(m); return; }
  expiryTeardown(m);
}

/** Broken twin (b): wrong expiry threshold — the hammer never tears down at 512, it blinks
 *  instead, leaving the counter high byte and hammer flag untouched. */
function brokenExpiryThreshold(m) {
  const { mem } = m;
  prologue(m);
  const lo = u8(mem.read8(HAMMER_TIMER_LO) + 1);
  mem.write8(HAMMER_TIMER_LO, lo);
  if (lo !== 0) { selectHammerSpriteBlinkByTimer(m); return; }
  const hi = u8(mem.read8(HAMMER_TIMER_HI) + 1);
  mem.write8(HAMMER_TIMER_HI, hi);
  if (hi !== 0x03) { blinkHammerSpriteOnFramePhase(m); return; } // BUG: should be EXPIRY_HIGH (2)
  expiryTeardown(m);
}

/** Broken twin (c): drops the hammer-active flag clear during expiry. */
function brokenDroppedFlagClear(m) {
  const { regs, mem } = m;
  prologue(m);
  const lo = u8(mem.read8(HAMMER_TIMER_LO) + 1);
  mem.write8(HAMMER_TIMER_LO, lo);
  if (lo !== 0) { selectHammerSpriteBlinkByTimer(m); return; }
  const hi = u8(mem.read8(HAMMER_TIMER_HI) + 1);
  mem.write8(HAMMER_TIMER_HI, hi);
  if (hi !== EXPIRY_HIGH) { blinkHammerSpriteOnFramePhase(m); return; }
  const objBase = regs.ix;
  mem.write8(HAMMER_TIMER_HI, 0);
  // BUG: mem.write8(MARIO_HAMMER_ACTIVE, 0) dropped
  mem.write8((objBase + OBJ_FIELD_01) & 0xffff, 0);
  mem.write8((objBase + OBJ_X_DISP) & 0xffff, -mem.read8(MARIO_X));
  mem.write8(HAMMER_SPRITE_CELL, mem.read8(MARIO_SPRITE_CODE));
  mem.write8((objBase + OBJ_ACTIVE) & 0xffff, 0);
  mem.write8(SND_BGM, mem.read8(SAVED_BGM));
  commitSpriteRecordAtMarioOffset(m);
}

/** The faithful expiry teardown, shared by twins (a)/(b) so only their gate is wrong. */
function expiryTeardown(m) {
  const { regs, mem } = m;
  const objBase = regs.ix;
  mem.write8(HAMMER_TIMER_HI, 0);
  mem.write8(MARIO_HAMMER_ACTIVE, 0);
  mem.write8((objBase + OBJ_FIELD_01) & 0xffff, 0);
  mem.write8((objBase + OBJ_X_DISP) & 0xffff, -mem.read8(MARIO_X));
  mem.write8(HAMMER_SPRITE_CELL, mem.read8(MARIO_SPRITE_CODE));
  mem.write8((objBase + OBJ_ACTIVE) & 0xffff, 0);
  mem.write8(SND_BGM, mem.read8(SAVED_BGM));
  commitSpriteRecordAtMarioOffset(m);
}

test("TEETH: inverted-gate, wrong-threshold, and dropped-flag-clear twins are CAUGHT", () => {
  const base = attractBase();

  // (a) inverted gate on a SELECT spec: the correct routine leaves the high byte alone; the
  // twin carries into it and blinks -> divergence at the counter high byte.
  const specA = CRAFTED[0]; // select-direct hi=0
  const invDiff = runPair(base, specA, brokenInvertedWrapGate);
  assert.notEqual(invDiff, null, "the inverted-gate twin escaped — the gate is worthless");
  assert.equal(invDiff.addr, HAMMER_TIMER_HI,
    `expected the inverted-gate diff at the counter high byte ${hx(HAMMER_TIMER_HI)}, got ${hx(invDiff.addr)}`);

  // (b) wrong threshold on an EXPIRY spec: the correct routine tears the hammer down (and
  // restores the saved tune); the twin blinks instead and leaves the whole teardown undone
  // — the lowest-addressed of those undone writes is the tune restore at SND_BGM.
  const specB = CRAFTED[6]; // EXPIRY obj1
  const thrDiff = runPair(base, specB, brokenExpiryThreshold);
  assert.notEqual(thrDiff, null, "the wrong-threshold twin escaped — the gate is worthless");
  assert.equal(thrDiff.addr, SND_BGM,
    `expected the wrong-threshold diff at the tune restore ${hx(SND_BGM)}, got ${hx(thrDiff.addr)}`);

  // (c) dropped flag clear on an EXPIRY spec: MARIO_HAMMER_ACTIVE stays set.
  const specC = CRAFTED[7]; // EXPIRY obj2
  const flagDiff = runPair(base, specC, brokenDroppedFlagClear);
  assert.notEqual(flagDiff, null, "the dropped-flag-clear twin escaped — the gate is worthless");
  assert.equal(flagDiff.addr, MARIO_HAMMER_ACTIVE,
    `expected the dropped-flag-clear diff at the hammer flag ${hx(MARIO_HAMMER_ACTIVE)}, got ${hx(flagDiff.addr)}`);

  console.log(`  TEETH: inverted-gate caught @${hx(invDiff.addr)}; wrong-threshold caught @${hx(thrDiff.addr)}; dropped-flag-clear caught @${hx(flagDiff.addr)}`);
});
