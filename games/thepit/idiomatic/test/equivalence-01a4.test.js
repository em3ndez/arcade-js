// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for coldBootInit (ROM 0x01a4, The Pit) — the power-on
 * cold-boot init reached from the reset vector: it re-seats the stack, switches the
 * per-frame interrupt off, clears the triple-redundant credit counter + game-mode byte,
 * seeds the coin/start input debounce state, readies the score / sound / high-score
 * tables and the blank board screen, requests the power-on sound, decodes the DIP
 * switches, holds briefly, then tail-jumps into the reset/round-restart epilogue
 * (resetStateAndShowSetup), which itself tail-hands into the still-oracle reset/entry handler 0x01f9.
 *
 * THREE WRINKLES this routine forces (the same shape its sibling resetStateAndShowSetup forces):
 *
 *   1. The tail never returns. coldBootInit -> resetStateAndShowSetup -> the reset/entry handler
 *      (0x01f9) re-seats the stack and runs the game loop, which spins forever — so the
 *      routine cannot run to completion. The gate installs a no-op stub at 0x01f9
 *      IDENTICALLY on both arms (via the machine's override map, which clone() carries),
 *      so the tail terminates the same way on each side and the comparison isolates
 *      coldBootInit's own work + its already-decompiled callees + the delegated epilogue.
 *      The same stub is in place during capture, so the boot cascade unwinds after the
 *      first 0x01a4 dispatch instead of running into the loop.
 *
 *   2. The frame waits. coldBootInit holds for 60 frames and the delegated epilogue holds
 *      the setup screen for a further spell, each busy-looping on the per-frame countdown
 *      (0x8009) reaching 0 — driven in the live game by the per-frame interrupt, which
 *      does not fire on an isolated clone. So the harness models that tick with ONE hook
 *      installed identically on both clones: reading the watchdog (which each wait pass
 *      does once) decrements the countdown, floored at 0. Same hook on both sides -> it
 *      can only reveal a difference, never manufacture one.
 *
 *   3. The stack scratch. coldBootInit re-seats the stack to the top of work RAM (0x83ff)
 *      — the captured entry SP is the garbage power-on value (0), so the stack lives
 *      wherever this routine puts it, not at the entry SP. The oracle wraps its callees
 *      in stack pushes + returns while the idiomatic routine calls its already-decompiled
 *      leaves directly, so the two leave DIFFERENT dead bytes in the work stack around
 *      that re-seated top (the observed litter spans 0x83f7..0x8402). Both are classic
 *      dead scratch — no routine ever reads work RAM at/above 0x8240 (verified: not one
 *      translated routine stores there; the whole 0x8240..0x87ff region is stack only) —
 *      so the RAM diff EXCLUDES a window around the stack top [0x83df, 0x840f) and
 *      compares everything else (all the seed stores + score/sound/high-score tables +
 *      DIP-decoded block + board + setup paint) byte for byte. pc / SP / value registers
 *      are excluded per the memory-equivalence contract (the idiomatic layer does not
 *      preserve the register/pc trace; the whole-machine pixel gate backstops it, and this
 *      contract survives the 0x01f9 callee later being dissolved).
 *
 * coldBootInit is dispatched exactly once, at the very first instruction after reset, so
 * the real entry is captured from a boot run (a pristine power-on machine state). The real
 * dispatch runs with DSW = 0 (the default upright cabinet); a crafted sweep pokes the DIP
 * byte across representative values (bit 7 clear — the top bit diverts the DIP decode to a
 * colour-test screen that only makes progress under the live frame loop) to exercise the
 * decode + count-label arms of the delegated setup screen.
 *
 * CHECKS:
 *   0. HARNESS — capture the real boot dispatch; oracle vs oracle is deterministic, the
 *      credit counter clears to 0, the state bytes come out 0 / 1, and the setup hold
 *      counter drains to 0.
 *   1. EQUAL (real dispatch) — coldBootInit == oracle over RAM outside the stack scratch,
 *      and the seed stores / state bytes / DIP-decoded block / setup record / drained hold
 *      hold their expected values.
 *   2. EQUAL (DIP sweep) — the DIP byte poked to representative values (< 0x80) identically
 *      on both sides stays equal across the decode + count-label arms.
 *   3. TEETH (wrong seed store) — a twin that corrupts a coin-switch debounce seed byte is
 *      CAUGHT at that address (this routine's own seed stores are inside the diff).
 *   4. TEETH (dropped credit-clear) — with the credit counter pre-poked non-zero identically
 *      on both sides, a twin that SKIPS the clear-to-0 is CAUGHT at 0x8000 (proving the
 *      clear is load-bearing, not a value the pristine entry already carried).
 *   5. TEETH (corrupted setup output) — a twin that corrupts a setup-screen record cell is
 *      CAUGHT at that cell (proving the delegated epilogue paint is inside the diff).
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-01a4.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_01a4 as oracle } from "../../translated/loc_01a4.js";
import { coldBootInit as idiomatic } from "../coldBootInit.js";
import { makeMachineFactory } from "../../machine.js";
import { GAME_MODE, GAME_STATE2, IN1_DEBOUNCED, IN1_PREV, STEP_TIMER_BASE } from "../ram.js";

// Callees imported for the dropped-credit-clear twin (a faithful copy of the body).
import { disableFrameInterrupt } from "../disableFrameInterrupt.js";
import { resetScoreAndSoundQueue } from "../resetScoreAndSoundQueue.js";
import { initScoreDisplay } from "../initScoreDisplay.js";
import { enableSound } from "../enableSound.js";
import { blankScreen } from "../blankScreen.js";
import { setupBoardModeC0 } from "../setupBoardModeC0.js";
import { requestSound2 } from "../requestSound2.js";
import { applyDipSwitches } from "../applyDipSwitches.js";
import { waitFrames } from "../waitFrames.js";
import { resetStateAndShowSetup } from "../resetStateAndShowSetup.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) =>
      nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x01a4;
const RESET_HANDLER = 0x01f9; // the tail eventually reaches this still-oracle handler — stubbed
const CAPTURE_FRAMES = 2500; // 0x01a4 fires at the very first instruction after reset
const WATCHDOG = 0xb800; // reading it kicks the watchdog + (in the harness) ticks the countdown
const COUNTDOWN = 0x8009; // the per-frame countdown each frame-wait drains to 0
const HOLD_COUNTER = 0x800a; // the setup screen's hold counter, drained to 0
const DSW_COUNT_A = 0x804c; // first DIP-derived HUD count (written by the DIP decode)
const REC_A = 0x928e; // the setup screen's first count record cell (shows DSW_COUNT_A)
const CREDIT_COUNTER = 0x8000; // credit/restart counter, cleared to 0 (mirrors 0x801c / 0x812c)
const COIN_DEBOUNCE = 0x8003; // a coin-switch debounce accumulator, seeded to the idle 0xAA
// The stack lives where coldBootInit re-seats it, NOT at the captured (power-on) entry SP.
const STACK_TOP = 0x83ff;
const STACK_SCRATCH_BELOW = 32; // dead scratch just below the re-seated stack top
const STACK_SCRATCH_ABOVE = 16; // dead scratch just above it (transient pushes past the top)
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/** No-op stub for the reset/entry handler, so the boot tail terminates instead of running
 *  into the endless game loop. Identical on both arms — it can only isolate the comparison
 *  to coldBootInit's own work + its callees, never hide a difference. */
const resetHandlerStub = () => {};

/**
 * Capture the pristine machine state at the FIRST real 0x01a4 dispatch during a boot run.
 * The hook clones the entry, then runs the oracle so the host proceeds (its interrupt
 * fires, so the frame-waits terminate). With 0x01f9 stubbed, the cascade unwinds and the
 * boot completes after this one dispatch. clone() carries both overrides, so every replay
 * off this entry resolves 0x01f9 to the same stub.
 */
function captureEntry() {
  let entry = null;
  const overrides = new Map([
    [TARGET, (mm) => {
      if (entry === null) entry = mm.clone();
      return oracle(mm);
    }],
    [RESET_HANDLER, resetHandlerStub],
  ]);
  makeMachine(overrides).runFrames(CAPTURE_FRAMES);
  return entry;
}

const ENTRY = ROM_PRESENT ? captureEntry() : null;

/**
 * Model the once-per-frame interrupt tick that drives each frame-wait to completion: every
 * watchdog read (a wait does exactly one per pass) ticks the countdown down by one, floored
 * at 0. Installed identically on both clones, so it can only expose a difference.
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
 * First differing RAM byte between two machines, EXCLUDING the dead stack-scratch window
 * around the re-seated stack top (where the oracle's per-call pushes and the idiomatic
 * direct calls legitimately differ). Null when otherwise identical.
 */
function ramDiffOutsideStack(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= STACK_TOP - STACK_SCRATCH_BELOW && addr < STACK_TOP + STACK_SCRATCH_ABOVE) continue;
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/**
 * Run the oracle and `candidate` on two independent clones of the real captured entry, with
 * the frame-tick harness on both. `opts.dsw` forces the DIP byte and `opts.poke` ({addr,val})
 * forces a work-RAM byte, identically on both sides — the crafted levers. Returns the first
 * RAM diff outside the stack scratch (or null) plus both clones.
 */
function runPair(candidate, opts = {}) {
  const a = ENTRY.clone();
  const b = ENTRY.clone();
  for (const c of [a, b]) {
    if (opts.dsw !== undefined) c.io.dsw = opts.dsw;
    if (opts.poke) c.mem.write8(opts.poke.addr, opts.poke.val);
  }
  installFrameTick(a);
  installFrameTick(b);
  oracle(a);
  candidate(b);
  return { ram: ramDiffOutsideStack(a, b), oracleM: a, candM: b };
}

// -- 0. HARNESS (reachability + determinism) ----------------------------------

test("HARNESS: the real boot 0x01a4 dispatch is captured and the oracle run is deterministic", () => {
  assert.ok(ENTRY, "expected 0x01a4 to be dispatched at the first instruction after reset");
  assert.equal(ENTRY.regs.sp, 0, "the pristine power-on entry SP is 0 (the routine re-seats it)");

  const { ram, oracleM } = runPair(oracle); // candidate arm = the oracle itself
  assert.equal(ram, null, ram && `oracle run not deterministic: diff at ${hx(ram.addr ?? 0)}`);
  assert.equal(oracleM.mem.read8(CREDIT_COUNTER), 0, "the boot must clear the credit counter to 0");
  assert.equal(oracleM.mem.read8(GAME_MODE), 0, "the boot must clear the game-mode byte to 0");
  assert.equal(oracleM.mem.read8(GAME_STATE2), 1, "the boot must arm the secondary state byte to 1");
  assert.equal(oracleM.mem.read8(HOLD_COUNTER), 0, "the setup screen's hold must drain to 0");
  console.log(
    `  HARNESS: captured a real 0x01a4 entry (SP=${hx(ENTRY.regs.sp)}, DSW=${hx(ENTRY.io.dsw)}); ` +
      "oracle deterministic, credit counter 0, state bytes 0/1, hold drained",
  );
});

// -- 1. EQUAL on the real captured dispatch -----------------------------------

test("EQUAL (real dispatch): coldBootInit == oracle over RAM outside the stack scratch", () => {
  const { ram, candM } = runPair(idiomatic);
  assert.equal(ram, null, ram && `RAM diverged at ${hx(ram.addr ?? 0)} (oracle=${ram.a} idiomatic=${ram.b})`);

  // Positive checks: the seed stores, the two state bytes, the DIP-decoded block
  // (DSW=0 -> slow base 55), the delegated setup record, and the drained hold counter.
  assert.equal(candM.mem.read8(CREDIT_COUNTER), 0, "credit counter must be cleared to 0");
  assert.equal(candM.mem.read8(0x801c), 0, "credit mirror 1 must be cleared to 0");
  assert.equal(candM.mem.read8(0x812c), 0, "credit mirror 2 must be cleared to 0");
  assert.equal(candM.mem.read8(GAME_MODE), 0, "game-mode byte must be cleared to 0");
  assert.equal(candM.mem.read8(GAME_STATE2), 1, "secondary state byte must be armed to 1");
  assert.equal(candM.mem.read8(IN1_DEBOUNCED), 6, "coin/start debounce latch must be seeded to 6");
  assert.equal(candM.mem.read8(IN1_PREV), 6, "coin/start debounce sample must be seeded to 6");
  assert.equal(candM.mem.read8(COIN_DEBOUNCE), 0xaa, "coin-switch debounce accumulator must be seeded to 0xAA");
  assert.equal(candM.mem.read8(STEP_TIMER_BASE), 55, "DIP decode must run (default cabinet step-timer base)");
  assert.equal(candM.mem.read8(REC_A), candM.mem.read8(DSW_COUNT_A), "setup screen must stamp the count record");
  assert.equal(candM.mem.read8(HOLD_COUNTER), 0, "setup hold counter must drain to 0");
  console.log("  EQUAL/real: identical observable RAM; seed stores, state bytes 0/1, DIP block + setup screen produced");
});

// -- 2. EQUAL across a crafted DIP-byte sweep ---------------------------------

test("EQUAL (DIP sweep): the DIP byte poked to representative values (< 0x80) stays equal", () => {
  const dips = [0x00, 0x04, 0x08, 0x0c, 0x2a, 0x55, 0x7f]; // decode + count-label arms; bit 7 kept clear
  for (const dsw of dips) {
    const { ram } = runPair(idiomatic, { dsw });
    assert.equal(ram, null, ram && `DSW=${hx(dsw)}: RAM diverged at ${hx(ram.addr ?? 0)} (oracle=${ram.a} idiomatic=${ram.b})`);
  }
  console.log(`  EQUAL/dipsweep: ${dips.length} DIP settings all RAM-equal (decode + count-label arms exercised)`);
});

// -- 3. TEETH: a wrong seed store is caught -----------------------------------

/** Broken twin: runs correctly, then corrupts a coin-switch debounce seed byte. */
function twinWrongSeedStore(m) {
  idiomatic(m);
  m.mem.write8(COIN_DEBOUNCE, m.mem.read8(COIN_DEBOUNCE) ^ 0xff); // BUG: wrong debounce seed
}

test("TEETH (wrong seed store): a corrupted coin-switch debounce seed is CAUGHT at 0x8003", () => {
  const { ram } = runPair(twinWrongSeedStore);
  assert.notEqual(ram, null, "the gate FAILED to catch a corrupted seed store — it is worthless");
  assert.equal(ram.addr, COIN_DEBOUNCE, `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected ${hx(COIN_DEBOUNCE)})`);
  console.log(`  TEETH/seed: caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

// -- 4. TEETH: a dropped credit-clear is caught (the clear is load-bearing) ----

/** A faithful copy of coldBootInit with the clear-to-0 of the credit counter (0x8000)
 *  OMITTED. With the entry pre-poked non-zero, the missing store leaves the wrong value. */
function twinDropCreditClear(m) {
  const { mem8, regs } = m;
  regs.sp = 0x83ff;
  disableFrameInterrupt(m);
  // BUG: the `mem8[0x8000] = 0` clear is dropped (the two mirrors are still cleared).
  mem8[0x801c] = 0;
  mem8[0x812c] = 0;
  mem8[GAME_MODE] = 0;
  mem8[IN1_DEBOUNCED] = 6;
  mem8[IN1_PREV] = 6;
  mem8[0x8004] = 0x55;
  mem8[0x8005] = 0x55;
  mem8[0x8003] = 0xaa;
  resetScoreAndSoundQueue(m);
  initScoreDisplay(m);
  enableSound(m);
  blankScreen(m);
  setupBoardModeC0(m);
  requestSound2(m);
  mem8[GAME_STATE2] = 1;
  applyDipSwitches(m);
  m.push16(0x01f6);
  waitFrames(m, 60);
  return resetStateAndShowSetup(m);
}

test("TEETH (dropped credit-clear): with 0x8000 pre-poked non-zero, skipping the clear is CAUGHT at 0x8000", () => {
  // Sanity: with the entry pre-poked non-zero, the CORRECT routine still clears it to 0
  // (so the poke is not itself the diff), and the drop-twin is caught.
  const clean = runPair(idiomatic, { poke: { addr: CREDIT_COUNTER, val: 0x55 } });
  assert.equal(clean.ram, null, clean.ram && `pre-poked entry must stay equal for the correct routine (diff at ${hx(clean.ram?.addr ?? 0)})`);
  assert.equal(clean.candM.mem.read8(CREDIT_COUNTER), 0, "the correct routine must clear the pre-poked byte to 0");

  const { ram } = runPair(twinDropCreditClear, { poke: { addr: CREDIT_COUNTER, val: 0x55 } });
  assert.notEqual(ram, null, "the gate FAILED to catch the dropped credit-clear — the store looks dead");
  assert.equal(ram.addr, CREDIT_COUNTER, `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected ${hx(CREDIT_COUNTER)})`);
  assert.equal(ram.a, 0, "oracle clears the byte to 0");
  assert.equal(ram.b, 0x55, "the drop-twin leaves the pre-poked value");
  console.log(`  TEETH/dropclear: caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b}) — the clear store is load-bearing`);
});

// -- 5. TEETH: a corrupted setup-screen output is caught ----------------------

/** Broken twin: runs correctly, then corrupts a setup-screen record cell. */
function twinCorruptSetupRecord(m) {
  idiomatic(m);
  m.mem.write8(REC_A, m.mem.read8(REC_A) ^ 0xff); // BUG: corrupts the painted count record
}

test("TEETH (corrupted setup output): a corrupted count record is CAUGHT at that cell", () => {
  const { ram } = runPair(twinCorruptSetupRecord);
  assert.notEqual(ram, null, "the gate FAILED to catch a corrupted setup record — the delegated paint is outside the diff");
  assert.equal(ram.addr, REC_A, `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected ${hx(REC_A)})`);
  console.log(`  TEETH/setup: caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});
