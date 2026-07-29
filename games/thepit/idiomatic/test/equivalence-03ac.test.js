// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for resetStateAndShowSetup (ROM 0x03ac, The Pit) — the reset/round-restart
 * epilogue: it clears the active-player byte (0x8001) and arms the secondary state byte
 * (0x8002), applies the DIP switches, paints + holds the round-setup screen, then tail-
 * jumps into the still-oracle reset/entry handler 0x01f9.
 *
 * THREE WRINKLES this routine forces:
 *
 *   1. The tail-jump never returns. resetStateAndShowSetup's hand-off (0x01f9) re-seats the stack and
 *      runs the game loop, which spins forever — so the routine cannot be run to
 *      completion. The gate installs a no-op stub at 0x01f9 IDENTICALLY on both arms (via
 *      the machine's override map, which clone() carries), so the tail-jump terminates
 *      the same way on each side and the comparison isolates resetStateAndShowSetup's own work + its two
 *      already-decompiled callees. The same stub is in place during capture, so the boot
 *      cascade unwinds after the first 0x03ac dispatch instead of running into the loop.
 *
 *   2. The setup-screen frame waits. showSetupScreen holds the screen for thirty passes,
 *      each busy-looping on the per-frame countdown (0x8009) reaching 0 — driven in the
 *      live game by the per-frame interrupt, which does not fire on an isolated clone. So
 *      the harness models that tick with ONE hook installed identically on both clones:
 *      reading the watchdog (which each wait pass does once) decrements the countdown,
 *      floored at 0. Same hook on both sides -> it can only reveal a difference, never
 *      manufacture one. (The same device equivalence-3a6f uses.)
 *
 *   3. The stack scratch. The oracle wraps its callees in stack pushes + returns while the
 *      idiomatic routine calls its already-decompiled leaves directly, so the two leave
 *      DIFFERENT dead bytes in the work stack just below the entry stack pointer. Both are
 *      classic dead scratch (overwritten by the caller's next push before anything reads
 *      them), so the RAM diff EXCLUDES that window — [entrySP - 32, entrySP + 2) — and
 *      compares everything else (all the work / colour / video RAM the DIP decode and the
 *      setup paint produce) byte for byte. pc / SP / value registers are excluded per the
 *      memory-equivalence contract (the idiomatic layer does not preserve the register/pc
 *      trace; the whole-machine pixel gate backstops it, and this contract survives the
 *      0x01f9 callee later being dissolved).
 *
 * resetStateAndShowSetup is dispatched once, at the tail of cold boot (the power-on init tail-jumps to
 * it), so the real entry is captured from a boot run. The real dispatch runs with DSW = 0
 * (the default upright cabinet); a crafted sweep pokes the DIP byte across representative
 * values (bit 7 clear — the top bit diverts to a colour-test screen that only makes
 * progress under the live frame loop) to exercise the DIP decode + count-label arms of the
 * delegated setup screen.
 *
 * CHECKS:
 *   0. HARNESS — capture the real boot dispatch; oracle vs oracle is deterministic, the
 *      state bytes come out 0 / 1, and the setup hold counter drains to 0.
 *   1. EQUAL (real dispatch) — resetStateAndShowSetup == oracle over RAM outside the stack scratch, and
 *      the state bytes / DIP-decoded block / setup records / drained hold hold their values.
 *   2. EQUAL (DIP sweep) — the DIP byte poked to representative values (< 0x80) identically
 *      on both sides stays equal across the decode + count-label arms.
 *   3. TEETH (wrong mode store) — a twin that corrupts the active-player byte is CAUGHT at
 *      0x8001.
 *   4. TEETH (dropped mode-clear) — with 0x8001 pre-poked non-zero identically on both
 *      sides, a twin that SKIPS the clear-to-0 store is CAUGHT at 0x8001 (proving that
 *      store is load-bearing, not a value the entry already carried).
 *   5. TEETH (corrupted setup output) — a twin that corrupts a setup-screen record cell is
 *      CAUGHT at that cell (proving the delegated paint is inside the diff, not just the
 *      routine's own two stores).
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-03ac.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_03ac as oracle } from "../../translated/loc_03ac.js";
import { resetStateAndShowSetup as idiomatic } from "../resetStateAndShowSetup.js";
import { applyDipSwitches } from "../applyDipSwitches.js";
import { showSetupScreen } from "../showSetupScreen.js";
import { makeMachineFactory } from "../../machine.js";
import { GAME_STATE, ACTIVE_PLAYER, STEP_TIMER_BASE } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) =>
      nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x03ac;
const RESET_HANDLER = 0x01f9; // the tail-jump target — stubbed to a no-op on both arms
const CAPTURE_FRAMES = 2500; // 0x03ac fires at the tail of cold boot
const WATCHDOG = 0xb800; // reading it kicks the watchdog + (in the harness) ticks the countdown
const COUNTDOWN = 0x8009; // the per-frame countdown each setup frame-wait drains to 0
const HOLD_COUNTER = 0x800a; // the setup screen's thirty-pass hold counter, drained to 0
const DSW_COUNT_A = 0x804c; // first DIP-derived HUD count (written by the DIP decode)
const REC_A = 0x928e; // the setup screen's first count record cell (shows DSW_COUNT_A)
const STACK_SCRATCH = 32; // bytes below the entry SP the two call styles differ in
const RETURN_SLOT = 2; // the two bytes at/just above entry SP that differ likewise
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/** No-op stub for the reset handler, so resetStateAndShowSetup's tail-jump terminates instead of
 *  running into the endless game loop. Identical on both arms — it can only isolate the
 *  comparison to resetStateAndShowSetup's own work, never hide a difference. */
const resetHandlerStub = () => {};

/**
 * Capture the pristine machine state at the FIRST real 0x03ac dispatch during a boot run.
 * The hook clones the entry, then runs the oracle so the host proceeds (its interrupt
 * fires, so the setup frame-waits terminate). With 0x01f9 stubbed, the cascade unwinds and
 * the boot completes after this one dispatch. clone() carries both overrides, so every
 * replay off this entry resolves 0x01f9 to the same stub.
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
 * Model the once-per-frame interrupt tick that drives each setup frame-wait to completion:
 * every watchdog read (a wait does exactly one per pass) ticks the countdown down by one,
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

/**
 * First differing RAM byte between two machines, EXCLUDING the dead stack-scratch window
 * around the entry stack pointer (where the oracle's per-call pushes and the idiomatic
 * direct calls legitimately differ). Null when otherwise identical.
 */
function ramDiffOutsideStack(a, b, entrySP) {
  const da = a.dumpState();
  const db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= entrySP - STACK_SCRATCH && addr < entrySP + RETURN_SLOT) continue;
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/**
 * Run the oracle and `candidate` on two independent clones of the real captured entry,
 * with the frame-tick harness on both. `opts.dsw` forces the DIP byte and `opts.poke`
 * ({addr,val}) forces a work-RAM byte, identically on both sides — the crafted levers.
 * Returns the first RAM diff outside the stack scratch (or null) plus both clones.
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
  return { ram: ramDiffOutsideStack(a, b, ENTRY.regs.sp), oracleM: a, candM: b };
}

// -- 0. HARNESS (reachability + determinism) ----------------------------------

test("HARNESS: the real boot 0x03ac dispatch is captured and the oracle run is deterministic", () => {
  assert.ok(ENTRY, "expected 0x03ac to be dispatched at the tail of cold boot");

  const { ram, oracleM } = runPair(oracle); // candidate arm = the oracle itself
  assert.equal(ram, null, ram && `oracle run not deterministic: diff at ${hx(ram.addr ?? 0)}`);
  assert.equal(oracleM.mem.read8(GAME_STATE), 0, "the epilogue must clear the active-player byte to 0");
  assert.equal(oracleM.mem.read8(ACTIVE_PLAYER), 1, "the epilogue must arm the secondary state byte to 1");
  assert.equal(oracleM.mem.read8(HOLD_COUNTER), 0, "the setup screen's thirty-pass hold must drain to 0");
  console.log(
    `  HARNESS: captured a real 0x03ac entry (SP=${hx(ENTRY.regs.sp)}, DSW=${hx(ENTRY.io.dsw)}); ` +
      "oracle deterministic, state bytes 0/1, hold drained",
  );
});

// -- 1. EQUAL on the real captured dispatch -----------------------------------

test("EQUAL (real dispatch): resetStateAndShowSetup == oracle over RAM outside the stack scratch", () => {
  const { ram, candM } = runPair(idiomatic);
  assert.equal(ram, null, ram && `RAM diverged at ${hx(ram.addr ?? 0)} (oracle=${ram.a} idiomatic=${ram.b})`);

  // Positive checks: the two state bytes, the DIP-decoded block (DSW=0 -> slow base 55),
  // the delegated setup record, and the drained hold counter.
  assert.equal(candM.mem.read8(GAME_STATE), 0, "active-player byte must be cleared to 0");
  assert.equal(candM.mem.read8(ACTIVE_PLAYER), 1, "secondary state byte must be armed to 1");
  assert.equal(candM.mem.read8(STEP_TIMER_BASE), 55, "DIP decode must run (default cabinet step-timer base)");
  assert.equal(candM.mem.read8(REC_A), candM.mem.read8(DSW_COUNT_A), "setup screen must stamp the count record");
  assert.equal(candM.mem.read8(HOLD_COUNTER), 0, "setup hold counter must drain to 0");
  console.log("  EQUAL/real: identical observable RAM; state bytes 0/1, DIP block + setup screen produced");
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

// -- 3. TEETH: a wrong mode store is caught -----------------------------------

/** Broken twin: runs correctly, then corrupts the active-player byte. */
function twinWrongModeStore(m) {
  idiomatic(m);
  m.mem.write8(GAME_STATE, m.mem.read8(GAME_STATE) ^ 0xff); // BUG: wrong active-player byte
}

test("TEETH (wrong mode store): a corrupted active-player byte is CAUGHT at 0x8001", () => {
  const { ram } = runPair(twinWrongModeStore);
  assert.notEqual(ram, null, "the gate FAILED to catch a corrupted mode store — it is worthless");
  assert.equal(ram.addr, GAME_STATE, `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected ${hx(GAME_STATE)})`);
  console.log(`  TEETH/mode: caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

// -- 4. TEETH: a dropped mode-clear is caught (the store is load-bearing) ------

/** Broken twin: resetStateAndShowSetup with the clear-to-0 of the active-player byte OMITTED. With the
 *  entry pre-poked non-zero, the missing store leaves the wrong value behind. */
function twinDropModeClear(m) {
  const { mem8 } = m;
  // BUG: the `mem8[GAME_STATE] = 0` store is dropped.
  mem8[ACTIVE_PLAYER] = 1;
  applyDipSwitches(m);
  m.push16(0x03bb);
  showSetupScreen(m);
  return m.call(RESET_HANDLER);
}

test("TEETH (dropped mode-clear): with 0x8001 pre-poked non-zero, skipping the clear is CAUGHT at 0x8001", () => {
  // Sanity: with the entry pre-poked non-zero, the CORRECT routine still clears it to 0
  // (so the poke is not itself the diff), and the drop-twin is caught.
  const clean = runPair(idiomatic, { poke: { addr: GAME_STATE, val: 0x55 } });
  assert.equal(clean.ram, null, clean.ram && `pre-poked entry must stay equal for the correct routine (diff at ${hx(clean.ram?.addr ?? 0)})`);
  assert.equal(clean.candM.mem.read8(GAME_STATE), 0, "the correct routine must clear the pre-poked byte to 0");

  const { ram } = runPair(twinDropModeClear, { poke: { addr: GAME_STATE, val: 0x55 } });
  assert.notEqual(ram, null, "the gate FAILED to catch the dropped mode-clear — the store looks dead");
  assert.equal(ram.addr, GAME_STATE, `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected ${hx(GAME_STATE)})`);
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
