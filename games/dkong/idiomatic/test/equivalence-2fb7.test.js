// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_2fb7 (ROM 0x2FB7) — the hammer-timer branch of the
 * object-sprite updater.
 *
 * loc_2fb7 is one of the build arms that feed the shared record write (loc_2f7c). Its
 * whole added behaviour is a one-byte decision: read the hammer duration counter's high
 * byte and pick the tail —
 *   - high byte zero  -> commit the record directly (loc_2f7c), attribute unchanged;
 *   - high byte non-zero -> route through the blink arm (loc_2fbe), which forces the
 *     record's attribute to 1 on the frame counter's blink-phase half before committing.
 * Both tails lay down the same six-cell record; they differ ONLY in the attribute byte,
 * and only when the frame's blink phase is set. So loc_2fb7's memory effect is loc_2f7c's
 * record write with the attribute chosen by (high byte, blink phase).
 *
 * Neither this arm nor its tails WRITE the stack: loc_2fb7 and loc_2fbe push nothing, and
 * loc_2f7c only pops (a read). So the memory-equivalence contract is the FULL RAM dump
 * with NO exclusion. The residual registers/flags and the tails' terminal return reach no
 * consumer — every caller of this arm discards the result — so live-out is memory-only
 * (pc/SP are not compared).
 *
 *   1. REACHABILITY — 0x2FB7 is dispatched during attract (the hammer grab). Because it
 *      fans into loc_2fbe, BOTH branches occur naturally: the direct-write branch (high
 *      byte zero) and the blink branch (high byte set), and inside the blink branch both
 *      blink phases.
 *
 *   2. EQUAL (captured) — hook 0x2FB7 in a real attract run, bucketed so both branches are
 *      captured, clone at each dispatch, and confirm loc_2fb7 reproduces the oracle's full
 *      RAM dump on every real state.
 *
 *   3. EQUAL (crafted) — poke registers + cells identically on both sides to reach BOTH
 *      branches against BOTH object records (0x6680/record 0x6A18, 0x6690/record 0x6A1C):
 *      the direct branch even with the blink phase set (proving it ignores the phase),
 *      both blink phases in the blink branch, several pass-through attributes, and the
 *      8-bit X/Y position wraps. Each case also asserts the oracle wrote the six expected
 *      bytes (non-vacuity), so an all-no-op match cannot pass.
 *
 *   4. TEETH — three deliberately-broken twins the comparison MUST catch, each caught at
 *      the record's attribute byte:
 *        (a) inverted branch — blinks when it should write direct and vice versa;
 *        (b) always-direct — drops the blink branch entirely;
 *        (c) always-blink  — drops the direct branch entirely.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2fb7.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2fb7 as oracle } from "../../translated/loc_2fb7.js";
import { selectHammerSpriteBlinkByTimer as loc_2fb7 } from "../selectHammerSpriteBlinkByTimer.js";
import { commitSpriteRecordAtMarioOffset as loc_2f7c } from "../commitSpriteRecordAtMarioOffset.js"; // proven-equal direct record write, used by the teeth
import { blinkHammerSpriteOnFramePhase as loc_2fbe } from "../blinkHammerSpriteOnFramePhase.js"; // proven-equal blink arm, used by the teeth
import {
  HAMMER_TIMER_HI, FRAME, MARIO_X, MARIO_Y,
  SPRITE_X, SPRITE_CODE, SPRITE_ATTR, SPRITE_Y, OBJ_X, OBJ_Y,
} from "../names.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2fb7;
// The direct/blink tails end in loc_2f7c's terminal `ret`, which pops the stack; point SP
// at work RAM so that pop reads valid bytes (never I/O). No routine writes RAM through the
// stack, so this choice never affects the compared memory.
const SAFE_SP = 0x6bf8;

const BLINK_PHASE_BIT = 0x08; // FRAME bit 3 — the blink-phase selector inside loc_2fbe
const BLINK_ATTR = 1;         // attribute forced during the blink half
const OBJ_X_DISP = 0x0e;      // object-record field: horizontal displacement from Mario
const OBJ_Y_DISP = 0x0f;      // object-record field: vertical displacement from Mario

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const u8 = (v) => v & 0xff;

// The branch loc_2fb7 takes: high byte zero -> direct write, else -> blink arm.
const isDirect = (spec) => u8(spec.timerHi) === 0;
// The attribute the record must end up with: direct passes the caller's value through;
// the blink arm forces 1 on the blink-phase half, else passes it through.
const attrFor = (spec) =>
  isDirect(spec) ? spec.c : (spec.frame & BLINK_PHASE_BIT ? BLINK_ATTR : spec.c);

/**
 * A synthetic entry: a clone of `base` with the register live-ins (record address, object
 * base, tile code, attribute) that pass straight through to the tail, the input cells
 * (Mario X/Y, the object's two displacement fields, the frame counter), and the hammer
 * timer high byte that selects the branch. Frame machinery neutralised so the oracle's
 * step machinery cannot fire an NMI or push a frame in isolation.
 */
function makeEntry(base, spec) {
  const e = base.clone();
  e.regs.de = spec.de;
  e.regs.ix = spec.ix;
  e.regs.b = spec.b;
  e.regs.c = spec.c;
  e.mem.write8(HAMMER_TIMER_HI, spec.timerHi);
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

// The crafted input space: both branches, both object records, both blink phases in the
// blink branch, the phase-ignored direct branch, several pass-through attributes, and the
// 8-bit X/Y wraps.
const CRAFTED = [
  // DIRECT branch (high byte zero) — attribute passes through, blink phase ignored.
  { name: "direct obj1 pass 0x07, phase clr", timerHi: 0x00, frame: 0x00, de: 0x6a18, ix: 0x6680, b: 0x88, c: 0x07, marioX: 0x40, marioY: 0x50, offE: 0x08, offF: 0x10 },
  { name: "direct obj2 pass 0x03, phase SET (ignored)", timerHi: 0x00, frame: 0x08, de: 0x6a1c, ix: 0x6690, b: 0x42, c: 0x03, marioX: 0x60, marioY: 0x90, offE: 0x00, offF: 0xf0 },
  { name: "direct obj1 pass 0x00, X wrap", timerHi: 0x00, frame: 0xff, de: 0x6a18, ix: 0x6680, b: 0x10, c: 0x00, marioX: 0xf0, marioY: 0x30, offE: 0x30, offF: 0x08 },
  // BLINK branch (high byte set) — phase CLEAR: attribute passes through.
  { name: "blink(hi=1) obj2 pass 0x07, phase clr", timerHi: 0x01, frame: 0xf0, de: 0x6a1c, ix: 0x6690, b: 0x9e, c: 0x07, marioX: 0xba, marioY: 0xc4, offE: 0x00, offF: 0x00 },
  // BLINK branch — phase SET: attribute forced to 1 regardless of entry value.
  { name: "blink(hi=1) obj1 over 0x0b, phase SET, Y wrap", timerHi: 0x01, frame: 0x08, de: 0x6a18, ix: 0x6680, b: 0x88, c: 0x0b, marioX: 0x10, marioY: 0xf8, offE: 0x04, offF: 0x20 },
  { name: "blink(hi=0xff) obj2 over 0x07, phase SET", timerHi: 0xff, frame: 0x0c, de: 0x6a1c, ix: 0x6690, b: 0x00, c: 0x07, marioX: 0x50, marioY: 0x60, offE: 0xf0, offF: 0xf0 },
  { name: "blink(hi=1) obj1 over 0x01, phase SET", timerHi: 0x01, frame: 0xff, de: 0x6a18, ix: 0x6680, b: 0x00, c: 0x01, marioX: 0x20, marioY: 0x70, offE: 0x00, offF: 0x00 },
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

test("REACHABILITY: 0x2FB7 is dispatched during attract (both branches, both blink phases)", () => {
  let direct = 0, blink = 0;
  const phases = new Set();
  const snap = new Map([[TARGET, (mm) => {
    if (mm.mem.read8(HAMMER_TIMER_HI) === 0) direct++;
    else { blink++; phases.add(mm.mem.read8(FRAME) & BLINK_PHASE_BIT ? "set" : "clr"); }
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(6000);
  assert.ok(direct > 0, "the direct-write branch (high byte zero) should occur naturally");
  assert.ok(blink > 0, "the blink branch (high byte set) should occur naturally");
  assert.ok(phases.has("set") && phases.has("clr"), "both blink phases should occur in the blink branch");
  console.log(`  REACHABILITY: ${direct + blink} natural 0x2FB7 dispatches in 6000 frames (direct ${direct}, blink ${blink}; phases ${[...phases].join(",")})`);
});

// -- 2. EQUAL (captured) ------------------------------------------------------

test("EQUAL (captured): loc_2fb7 == oracle on every real dispatch", () => {
  const capsDirect = [], capsBlink = [];
  const snap = new Map([[TARGET, (mm) => {
    if (mm.mem.read8(HAMMER_TIMER_HI) === 0) { if (capsDirect.length < 96) capsDirect.push(mm.clone()); }
    else { if (capsBlink.length < 96) capsBlink.push(mm.clone()); }
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(6000);
  assert.ok(capsDirect.length >= 1, "expected a real direct-branch 0x2FB7 dispatch during attract");
  assert.ok(capsBlink.length >= 1, "expected a real blink-branch 0x2FB7 dispatch during attract");

  const caps = [...capsDirect, ...capsBlink];
  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    oracle(a);
    loc_2fb7(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      ram,
      null,
      ram && `RAM diverges on real dispatch at ${hx(ram.addr)} (${ram.a}->${ram.b})`,
    );
  }
  console.log(`  EQUAL/captured: ${caps.length} real 0x2FB7 dispatches — full RAM dump == oracle (${capsDirect.length} direct, ${capsBlink.length} blink)`);
});

// -- 3. EQUAL (crafted) -------------------------------------------------------

test("EQUAL (crafted): both branches, both object records, both blink phases, and the wraps match", () => {
  const base = attractBase();
  for (const spec of CRAFTED) {
    const ram = runPair(base, spec, loc_2fb7);
    assert.equal(ram, null, ram && `${spec.name}: RAM diverges at ${hx(ram.addr)} (${ram.a}->${ram.b})`);

    // Non-vacuity: the oracle genuinely wrote the six expected bytes (incl. the
    // branch/phase-selected attribute) for this spec.
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
// Each twin makes the WRONG branch choice, then commits through the proven-equal tails
// (loc_2f7c / loc_2fbe) — so the only possible divergence is the record attribute byte,
// which is exactly the difference between the two tails and thus loc_2fb7's whole job.
// Every twin spec sets the blink phase and a pass-through attribute != 1, so the two
// tails genuinely disagree on the attribute.

/** Broken twin (a): inverted branch — direct when it should blink and vice versa. */
function brokenInvertedBranch(m) {
  if (m.mem.read8(HAMMER_TIMER_HI) === 0) loc_2fbe(m); else loc_2f7c(m); // BUG: swapped
}

/** Broken twin (b): always writes direct — the blink branch is dropped. */
function brokenAlwaysDirect(m) {
  loc_2f7c(m); // BUG: never routes through the blink arm
}

/** Broken twin (c): always blinks — the direct branch is dropped. */
function brokenAlwaysBlink(m) {
  loc_2fbe(m); // BUG: always routes through the blink arm
}

test("TEETH: inverted-branch, always-direct, and always-blink twins are CAUGHT", () => {
  const base = attractBase();
  const attrAddr = (de) => (de + SPRITE_ATTR) & 0xffff;

  // (a) inverted branch on a DIRECT case with the phase set: oracle passes 0x07 through
  // (direct), twin blinks to 1.
  const specA = { name: "teeth-invert", timerHi: 0x00, frame: 0x08, de: 0x6a18, ix: 0x6680, b: 0x88, c: 0x07, marioX: 0x40, marioY: 0x80, offE: 0x05, offF: 0x02 };
  const invDiff = runPair(base, specA, brokenInvertedBranch);
  assert.notEqual(invDiff, null, "the inverted-branch twin escaped — the gate is worthless");
  assert.equal(invDiff.addr, attrAddr(specA.de),
    `expected the inverted-branch diff at the record attribute byte ${hx(attrAddr(specA.de))}, got ${hx(invDiff.addr)}`);

  // (b) always-direct on a BLINK case with the phase set: oracle forces 1 (blink), twin
  // passes 0x07 through.
  const specB = { name: "teeth-always-direct", timerHi: 0x01, frame: 0x08, de: 0x6a1c, ix: 0x6690, b: 0x9e, c: 0x07, marioX: 0x50, marioY: 0x60, offE: 0x00, offF: 0x00 };
  const dirDiff = runPair(base, specB, brokenAlwaysDirect);
  assert.notEqual(dirDiff, null, "the always-direct twin escaped — the gate is worthless");
  assert.equal(dirDiff.addr, attrAddr(specB.de),
    `expected the always-direct diff at the record attribute byte ${hx(attrAddr(specB.de))}, got ${hx(dirDiff.addr)}`);

  // (c) always-blink on a DIRECT case with the phase set: oracle passes 0x07 through, twin
  // forces 1.
  const specC = { name: "teeth-always-blink", timerHi: 0x00, frame: 0x0c, de: 0x6a18, ix: 0x6680, b: 0x10, c: 0x07, marioX: 0x20, marioY: 0x50, offE: 0x00, offF: 0x10 };
  const blkDiff = runPair(base, specC, brokenAlwaysBlink);
  assert.notEqual(blkDiff, null, "the always-blink twin escaped — the gate is worthless");
  assert.equal(blkDiff.addr, attrAddr(specC.de),
    `expected the always-blink diff at the record attribute byte ${hx(attrAddr(specC.de))}, got ${hx(blkDiff.addr)}`);

  console.log(`  TEETH: inverted-branch caught @${hx(invDiff.addr)}; always-direct caught @${hx(dirDiff.addr)}; always-blink caught @${hx(blkDiff.addr)}`);
});
