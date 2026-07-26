// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for showFixedScreen (ROM 0x3b81, The Pit) — the routine
 * that paints a canned full-screen tile image from ROM, tints the whole display one
 * flat colour, and holds it for a fixed spell before returning to its caller.
 *
 * THE WRINKLE this routine forces (inherited from waitFrames): it makes two frame
 * waits, each of which busy-waits on the per-frame countdown cell (0x8009) reaching 0.
 * Nothing in the code drives that countdown — in the live game the per-frame interrupt
 * decrements it once a frame. Run in isolation on a clone (whose frame machinery is
 * neutralised, so no interrupt fires) those loops would never terminate. So the harness
 * models that once-per-frame tick with ONE hook installed IDENTICALLY on both clones:
 * reading the watchdog (which each frame-wait pass does exactly once) decrements the
 * countdown by one, floored at 0. Being the same hook on both sides, it can only ever
 * reveal a difference between oracle and idiomatic, never manufacture one.
 *
 * The memory-observable output is the full tilemap image (video RAM 0x9000..0x93ff),
 * the flooded colour RAM (0x8800..0x8bff), the countdown left at 0, and the balanced
 * work stack + the return to the caller (pc/SP). The register file the paint leaves is
 * dead, so it is intentionally not compared (the contract is RAM + pc + SP).
 *
 * CHECKS:
 *   1. EQUAL — idiomatic == oracle on the real captured boot/attract dispatch, over
 *      RAM + pc + SP, with the frame-tick harness on both sides.
 *   2. TEETH — a twin that floods the wrong flat colour is CAUGHT in colour RAM; a twin
 *      that corrupts the copied image is CAUGHT in video RAM.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3b81.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3b81 as oracle } from "../../translated/loc_3b81.js";
import { showFixedScreen as idiomatic } from "../showFixedScreen.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) =>
      nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x3b81; // loc_3b81 / showFixedScreen
const COUNTDOWN = 0x8009; // the per-frame countdown the two frame-waits drain to 0
const WATCHDOG = 0xb800; // reading it kicks the watchdog (once per busy-wait pass)
const COLOR_CELL = 0x8800; // first colour-RAM cell the flat-colour flood writes
const VIDEO_LAST = 0x93ff; // last tilemap cell the image copy writes
const CAPTURE_FRAMES = 700; // 0x3b81 dispatches once at ~frame 530; the paint holds ~160 more
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture the machine state at the FIRST real 0x3b81 dispatch. The hook clones the
 * pristine entry, then runs the real oracle so the host run proceeds — in the live
 * host the interrupt fires, so both frame waits terminate normally.
 */
function captureEntry() {
  let entry = null;
  const overrides = new Map([
    [TARGET, (mm) => {
      if (entry === null) entry = mm.clone();
      return oracle(mm);
    }],
  ]);
  const host = makeMachine(overrides);
  host.runFrames(CAPTURE_FRAMES);
  return entry;
}

const ENTRY = ROM_PRESENT ? captureEntry() : null;

/**
 * Model the once-per-frame interrupt tick that drives each frame-wait to completion:
 * every watchdog read (a frame-wait does exactly one per pass) ticks the countdown down
 * by one, floored at 0 so the loops are guaranteed to terminate. Installed identically
 * on both clones, so it can only expose a difference, never create one.
 */
function installFrameTick(m) {
  const mem = m.mem;
  const origRead8 = mem.read8.bind(mem);
  mem.read8 = (addr) => {
    if (addr === WATCHDOG) {
      const c = origRead8(COUNTDOWN);
      if (c !== 0) mem.write8(COUNTDOWN, c - 1);
    }
    return origRead8(addr);
  };
}

/**
 * Run the oracle and a candidate on two independent clones of the real captured entry,
 * with the frame-tick harness on both, and diff the memory-equivalence contract:
 * RAM + exit pc + SP. (The register file the paint leaves is dead live-out, so it is
 * intentionally not compared.)
 */
function runPair(candidate) {
  const a = ENTRY.clone();
  const b = ENTRY.clone();
  installFrameTick(a);
  installFrameTick(b);

  oracle(a);
  candidate(b);

  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    pcDiff: a.pc === b.pc ? null : { a: a.pc, b: b.pc },
    spDiff: a.regs.sp === b.regs.sp ? null : { a: a.regs.sp, b: b.regs.sp },
    countdownLanded: a.mem.read8(COUNTDOWN),
  };
}

// -- 1. EQUAL: idiomatic == oracle on the real captured dispatch ---------------

test("EQUAL: idiomatic == oracle on the captured 0x3b81 dispatch (RAM + pc + SP)", () => {
  assert.ok(ENTRY, "captured the real boot/attract 0x3b81 dispatch");
  assert.equal(ENTRY.regs.a, 0x00, "the routine has no register live-in (entry A is incidental 0)");

  const r = runPair(idiomatic);
  assert.equal(r.ram, null, r.ram && `RAM diverged at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} idiomatic=${r.ram.b})`);
  assert.equal(r.pcDiff, null, r.pcDiff && `pc diverged (oracle=${hx(r.pcDiff.a)} idiomatic=${hx(r.pcDiff.b)})`);
  assert.equal(r.spDiff, null, r.spDiff && `SP diverged (oracle=${hx(r.spDiff.a)} idiomatic=${hx(r.spDiff.b)})`);
  assert.equal(r.countdownLanded, 0, "both frame waits must drain the countdown to 0");
  console.log("  EQUAL: full paint + hold identical to the oracle (RAM + pc + SP)");
});

// -- 2. TEETH: broken twins the gate MUST catch -------------------------------

/** Broken twin A: paints correctly, then floods the wrong flat colour into one cell. */
function brokenFloodColour(m) {
  idiomatic(m);
  m.mem.write8(COLOR_CELL, m.mem.read8(COLOR_CELL) ^ 0xff); // BUG: wrong flat-colour attribute
}

/** Broken twin B: paints correctly, then corrupts a copied image cell. */
function brokenCopyImage(m) {
  idiomatic(m);
  m.mem.write8(VIDEO_LAST, m.mem.read8(VIDEO_LAST) ^ 0xff); // BUG: wrong tile in the copied image
}

test("TEETH: a wrong flat colour is CAUGHT in colour RAM", () => {
  const r = runPair(brokenFloodColour);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a wrong colour flood — it is worthless");
  assert.equal(r.ram.addr, COLOR_CELL, `teeth caught the wrong address ${hx(r.ram.addr ?? 0)} (expected ${hx(COLOR_CELL)})`);
  console.log(`  TEETH: wrong colour caught at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

test("TEETH: a corrupted image cell is CAUGHT in video RAM", () => {
  const r = runPair(brokenCopyImage);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a corrupted image — it is worthless");
  assert.equal(r.ram.addr, VIDEO_LAST, `teeth caught the wrong address ${hx(r.ram.addr ?? 0)} (expected ${hx(VIDEO_LAST)})`);
  console.log(`  TEETH: corrupted image caught at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});
