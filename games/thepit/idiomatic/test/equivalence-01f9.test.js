// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_01f9 (ROM 0x01f9) — the boot/restart state entry: it
 * hard-resets the stack, re-arms the machine (frame interrupt on, secondary game-state
 * byte armed, DIP settings committed), then forks on the restart flag (0x8000) into either
 * the held credit screen (flag set) or the mute → clear game-mode → paint fixed screen →
 * enter play sequence (flag clear).
 *
 * The routine's declared live-out is MEMORY-ONLY, so the gate compares OBSERVABLE RAM
 * (dumpState: work + colour + video + sprite RAM) and nothing else — not pc, SP, or the
 * value registers the oracle threads through. Both exits are tail hand-offs into
 * never-returning state entries, so there is no register live-out, and a strict
 * pc/register contract would false-fail this register-free rewrite. This is the
 * memory-equivalence contract enterPlayMode (0x03be) and showFixedScreen (0x3b81) use.
 *
 * THREE WRINKLES this entry forces:
 *
 *  1. NEITHER PATH RETURNS. The flag-clear path enters play, which falls through into the
 *     main game loop and spins forever; the flag-set path spins forever on the credit
 *     screen. Both terminate at a still-oracle tail (the round init 0x031a and the
 *     credit-screen painter 0x3ba8), reached the SAME way on both arms, so the gate stubs
 *     both to a no-op on both clones — "equal by construction" for the shared tails, which
 *     bounds each run at its tail and lets the diff measure only the work up to it.
 *
 *  2. THE FIXED-SCREEN PAINT BUSY-WAITS. The flag-clear path paints the fixed screen,
 *     whose two frame-waits busy-loop on a per-frame countdown the interrupt drains in the
 *     live game. Run in isolation there is no interrupt, so the harness models that
 *     once-per-frame tick with ONE hook installed identically on both clones: each
 *     watchdog read (one per busy-wait pass) decrements the countdown, floored at 0. Same
 *     hook on both sides, so it can only reveal a difference, never manufacture one.
 *
 *  3. TOP-OF-STACK SCRATCH. This entry hard-resets the stack, and its delegatees push/pop
 *     return slots around that reset top; the stack-free direct calls the idiomatic rewrite
 *     makes push fewer of them, and its fixed-screen tail even pops one slot ABOVE the reset
 *     top. Those dead scratch bytes straddle the reset SP — measured span 0x83f9..0x8400 —
 *     overwritten before anything reads them, with no game-observable cell inside. The RAM
 *     diff EXCLUDES exactly that window and compares every real cell byte-for-byte; the
 *     teeth confirm the window hides no real output (they are caught at real cells below it).
 *
 * CHECKS:
 *   0. HARNESS — capture a real 0x01f9 dispatch; confirm it is the flag-clear path with the
 *      DIP top bit clear (so the DIP decode takes no diversion), and the oracle run is
 *      deterministic.
 *   1. EQUAL (real flag-clear entry) — loc_01f9 leaves the same observable RAM as the
 *      oracle, and the effects hold: secondary game-state armed, entering play left the
 *      play-mode value, the fixed screen was painted.
 *   2. EQUAL (crafted flag-set entry) — with the restart flag poked nonzero identically on
 *      both sides, the credit-screen arm leaves the same observable RAM (game mode 3).
 *   3. TEETH (inverted fork, flag-clear) — a twin that takes the credit-screen arm anyway
 *      is CAUGHT at the game-mode byte (4 vs 3).
 *   4. TEETH (inverted fork, flag-set) — a twin that takes the play arm anyway is CAUGHT at
 *      the game-mode byte (3 vs 4).
 *   5. TEETH (corrupted paint) — a twin that corrupts a painted tilemap cell is CAUGHT in
 *      video RAM.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-01f9.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_01f9 as oracle } from "../../translated/loc_01f9.js";
import { loc_01f9 as idiomatic } from "../loc_01f9.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { GAME_MODE, GAME_STATE2 } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x01f9;
const RESTART_FLAG = 0x8000; // the fork byte: nonzero = warm restart (credit screen)
const ROUND_INIT_TAIL = 0x031a; // flag-clear tail (spins forever in the main loop)
const CREDIT_PAINTER_TAIL = 0x3ba8; // flag-set tail (spins forever on the credit screen)
const TEST_SCREEN_TAIL = 0x4f47; // DIP top-bit diversion; stubbed defensively (top bit is clear)
const WATCHDOG = 0xb800; // reading it kicks the watchdog (once per busy-wait pass)
const COUNTDOWN = 0x8009; // the per-frame countdown the fixed-screen frame-waits drain to 0
const VIDEO_CELL = 0x9000; // first tilemap cell the fixed-screen paint fills
const IMAGE_SOURCE = 0x3e32; // ROM address of the fixed-screen image (paint copies from here)
const VIDEO_LAST = 0x93ff; // last tilemap cell the paint fills (teeth target)
// Dead top-of-stack scratch straddling the reset SP: return slots the delegatees park
// around 0x83ff that the stack-free rewrite does not reproduce. Measured span, excluded.
const STACK_SCRATCH_LO = 0x83f9;
const STACK_SCRATCH_HI = 0x8400;
const CAPTURE_FRAMES = 900; // 0x01f9's flag-clear path is reached ~frame 700 as attract enters the demo
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/** Hook 0x01f9 in a real boot/attract run and clone the machine at its first dispatch. */
function captureRealEntry(maxFrames) {
  let entry = null;
  const snapshot = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return oracle(mm);
  }]]);
  makeMachine(snapshot).runFrames(maxFrames);
  return entry;
}

/**
 * Model the once-per-frame interrupt tick that drives the fixed-screen frame-waits to
 * completion: each watchdog read (one per busy-wait pass) ticks the countdown down by one,
 * floored at 0. Installed identically on both clones, so it can only expose a difference.
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

/** A fresh clone of `seed`, its never-returning tails stubbed and the frame-tick harness
 *  installed, ready to run one arm to its tail boundary. */
function prepArm(seed) {
  const c = seed.clone();
  c.routines.set(ROUND_INIT_TAIL, () => {}); // bound the forever-spinning tails on both arms
  c.routines.set(CREDIT_PAINTER_TAIL, () => {});
  c.routines.set(TEST_SCREEN_TAIL, () => {});
  installFrameTick(c);
  return c;
}

function runArm(seed, fn) {
  const c = prepArm(seed);
  fn(c);
  return c;
}

/** First differing observable-RAM byte between the oracle and `fn` on clones of one seed,
 *  EXCLUDING the dead top-of-stack scratch window. Null when otherwise identical. */
function ramDiff(seed, fn) {
  const a = runArm(seed, oracle);
  const b = runArm(seed, fn);
  const da = a.dumpState();
  const db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= STACK_SCRATCH_LO && addr <= STACK_SCRATCH_HI) continue; // dead stack scratch
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/** A real captured entry with the restart flag poked to `flag` identically on both sides. */
function craftFlag(seed, flag) {
  const e = seed.clone();
  e.mem8[RESTART_FLAG] = flag;
  return e;
}

// -- 0. HARNESS (reachability + determinism) ---------------------------------

test("HARNESS: a real 0x01f9 dispatch is captured on the flag-clear path and the oracle is deterministic", () => {
  const entry = captureRealEntry(CAPTURE_FRAMES);
  assert.ok(entry, "expected 0x01f9 to be dispatched during boot/attract");
  assert.equal(entry.mem8[RESTART_FLAG], 0, "the natural boot dispatch takes the flag-clear path");
  assert.equal(entry.io.dsw & 0x80, 0, "the DIP top bit is clear, so the DIP decode takes no diversion");

  const a = runArm(entry, oracle);
  const b = runArm(entry, oracle);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, d && `oracle run not deterministic: diff at ${hx(d.addr ?? 0)}`);
  console.log(
    `  HARNESS: captured a real 0x01f9 entry (SP=${hx(entry.regs.sp)}, flag=${entry.mem8[RESTART_FLAG]}, ` +
      `DSW=${hx(entry.io.dsw)}); oracle run deterministic`,
  );
});

// -- 1. EQUAL on the real captured flag-clear entry --------------------------

test("EQUAL (real flag-clear entry): loc_01f9 == oracle over observable RAM", () => {
  const entry = captureRealEntry(CAPTURE_FRAMES);
  assert.ok(entry, "need a captured 0x01f9 entry");

  const d = ramDiff(entry, idiomatic);
  assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)} oracle=${d.a} cand=${d.b}`);

  // Positive checks: the flag-clear path re-armed and entered play, and painted the screen.
  const c = runArm(entry, idiomatic);
  assert.equal(c.mem8[GAME_STATE2], 1, "secondary game-state armed before the fork");
  assert.equal(c.mem8[GAME_MODE], 4, "entering play left the play-mode value in the game-mode byte");
  assert.equal(c.mem8[VIDEO_CELL], c.mem8[IMAGE_SOURCE], "the fixed screen was painted from the ROM image");
  console.log("  EQUAL/flag-clear: identical observable RAM; re-armed, painted, entered play (game mode 4)");
});

// -- 2. EQUAL on a crafted flag-set entry ------------------------------------

test("EQUAL (crafted flag-set entry): the credit-screen arm == oracle over observable RAM", () => {
  const seed = captureRealEntry(CAPTURE_FRAMES);
  assert.ok(seed, "need a captured entry to craft the flag-set path from");
  const entry = craftFlag(seed, 1);

  const d = ramDiff(entry, idiomatic);
  assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)} oracle=${d.a} cand=${d.b}`);

  const c = runArm(entry, idiomatic);
  assert.equal(c.mem8[GAME_MODE], 3, "the warm-restart arm armed the credit-screen game mode");
  console.log("  EQUAL/flag-set: identical observable RAM; credit-screen arm armed game mode 3");
});

// -- 3. TEETH: an inverted fork on the flag-clear path is caught --------------

/** Broken twin: re-arms correctly but always takes the credit-screen arm, ignoring the flag. */
function twinAlwaysCredit(m) {
  const { mem8, regs } = m;
  regs.sp = 0x83ff;
  enableNmiInline(m);
  mem8[GAME_STATE2] = 1;
  applyDipInline(m);
  return m.call(0x021c); // BUG: ignores the restart flag -> credit screen even when it is clear
}

// The twins re-arm through the registry (oracle enableNmi/DIP) so the ONLY difference from
// the real routine is the fork it takes — the mutation the teeth is meant to attack.
function enableNmiInline(m) { m.push16(0x0000); m.call(0x4b14); }
function applyDipInline(m) { m.push16(0x0000); m.call(0x4b55); }

test("TEETH (inverted fork, flag-clear): always taking the credit arm is CAUGHT at the game-mode byte", () => {
  const entry = captureRealEntry(CAPTURE_FRAMES);
  assert.ok(entry, "need a captured entry to seed the teeth check");

  const d = ramDiff(entry, twinAlwaysCredit);
  assert.ok(d, "the gate FAILED to catch an inverted fork — it proves nothing");
  assert.equal(d.addr, GAME_MODE, `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(GAME_MODE)})`);
  assert.equal(d.a, 4, "oracle enters play (game mode 4) on the flag-clear path");
  assert.equal(d.b, 3, "twin wrongly armed the credit-screen game mode 3");
  console.log(`  TEETH/fork-clear: inverted fork caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

// -- 4. TEETH: an inverted fork on the flag-set path is caught ----------------

/** Broken twin: always takes the play arm, ignoring the (set) restart flag. */
function twinAlwaysPlay(m) {
  const { mem8, regs } = m;
  regs.sp = 0x83ff;
  enableNmiInline(m);
  mem8[GAME_STATE2] = 1;
  applyDipInline(m);
  m.push16(0x0000); m.call(0x4c47); // disable sound
  mem8[GAME_MODE] = 0;
  m.push16(0x0000); m.call(0x3b81); // paint the fixed screen
  return m.call(0x03be); // BUG: ignores the set flag -> enters play instead of the credit screen
}

test("TEETH (inverted fork, flag-set): always taking the play arm is CAUGHT at the game-mode byte", () => {
  const seed = captureRealEntry(CAPTURE_FRAMES);
  assert.ok(seed, "need a captured entry to seed the teeth check");
  const entry = craftFlag(seed, 1);

  const d = ramDiff(entry, twinAlwaysPlay);
  assert.ok(d, "the gate FAILED to catch an inverted fork — it proves nothing");
  assert.equal(d.addr, GAME_MODE, `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(GAME_MODE)})`);
  assert.equal(d.a, 3, "oracle shows the credit screen (game mode 3) on the flag-set path");
  assert.equal(d.b, 4, "twin wrongly entered play (game mode 4)");
  console.log(`  TEETH/fork-set: inverted fork caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

// -- 5. TEETH: a corrupted painted cell is caught in video RAM ---------------

/** Broken twin: runs the real routine, then corrupts a painted tilemap cell. */
function twinCorruptPaint(m) {
  idiomatic(m);
  m.mem8[VIDEO_LAST] = m.mem8[VIDEO_LAST] ^ 0xff; // BUG: wrong tile in the painted image
}

test("TEETH (corrupted paint): a wrong painted tilemap cell is CAUGHT in video RAM", () => {
  const entry = captureRealEntry(CAPTURE_FRAMES);
  assert.ok(entry, "need a captured entry to seed the teeth check");

  const d = ramDiff(entry, twinCorruptPaint);
  assert.ok(d, "the gate FAILED to catch a corrupted paint — it proves nothing");
  assert.equal(d.addr, VIDEO_LAST, `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(VIDEO_LAST)})`);
  console.log(`  TEETH/paint: corrupted tilemap cell caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});
