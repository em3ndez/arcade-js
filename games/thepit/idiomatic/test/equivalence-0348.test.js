// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for mainLoop (ROM 0x0348) — the in-game / attract-demo main loop.
 *
 * The oracle NEVER returns: it re-establishes the stack, kicks the watchdog, runs the
 * per-frame services, burns a busy-delay, and loops back to its own top forever (broken
 * into only by the vblank interrupt). So the memory-equivalent UNIT is ONE PASS of the
 * loop body, and both the oracle and the idiomatic form are run for exactly one pass and
 * their resulting work/colour/video/sprite RAM compared.
 *
 * HOW ONE PASS IS BOUNDED. Every pass kicks the watchdog exactly once — a read of the
 * board port 0xB800 — at the very top, before any per-frame work. So the SECOND such read
 * marks the start of pass 2: a wrapper on the machine's read8 throws a sentinel there,
 * stopping each side after exactly one full pass. The same marker bounds both the oracle
 * and the idiomatic form (both kick the watchdog once per pass), so the comparison is fair;
 * a service reads 0xB800 nowhere else (only the boot/screen waits do, which this loop's
 * services never reach), so the second read is unambiguously the top of pass 2.
 *
 * THE CONTRACT is RAM-only (doc's honest-signature rule): the loop's live-out is memory —
 * it never returns a register/flag to anyone. pc/SP and the value registers are excluded.
 * The one wrinkle is the Z80 stack: it is real diffed work RAM at 0x83ff growing down, and
 * the oracle's per-pass call brackets leave dead return-address bytes just below 0x83ff
 * that the stack-free idiomatic JS never writes. Those are classic dead stack scratch
 * (overwritten by the next push before anything reads them), so the diff excludes exactly
 * the window the oracle's pushes reached — measured per run by tracking the lowest stack
 * pointer the oracle visits — and compares everything else byte-for-byte.
 *
 * Checks:
 *   0. HARNESS — a real 0x0348 entry is captured from the attract demo and the oracle's
 *      one pass is deterministic (oracle vs oracle -> identical RAM). The loop is confirmed
 *      never to return (it is stopped by the one-pass sentinel, not by falling off the end).
 *   1. EQUAL (real entry, game-mode 4) — mainLoop == oracle over RAM (outside the stack
 *      scratch). The real entry is in demo mode, so this exercises the demo-steer arm.
 *   2. EQUAL (crafted game-mode 0) — with the mode byte forced to 0 on both sides, the
 *      demo-steer call is skipped; still identical.
 *   3. TEETH (dropped service) — a twin that omits the reaction driver is CAUGHT in RAM.
 *   4. TEETH (flipped demo test) — a twin that runs the demo steerer on the WRONG mode is
 *      CAUGHT in RAM.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-0348.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0348 as oracle } from "../../translated/loc_0348.js";
import { mainLoop as idiomatic } from "../mainLoop.js";
import { makeMachineFactory } from "../../machine.js";
import { GAME_MODE } from "../ram.js";

// The idiomatic services the teeth twins reuse (they mirror mainLoop's body, one break each).
import { enableNmi } from "../enableNmi.js";
import { steerDemoPlayer } from "../steerDemoPlayer.js";
import { dispatchObjectFrameByStateTimer } from "../dispatchObjectFrameByStateTimer.js";
import { advanceColumnAnimation } from "../advanceColumnAnimation.js";
import { glitterJewels } from "../glitterJewels.js";
import { advanceReactionObject } from "../advanceReactionObject.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x0348;
const WATCHDOG = 0xb800; // reading this port kicks the watchdog — once at the top of every pass
const STACK_TOP = 0x83ff; // the loop re-seats SP here each pass; pushes grow downward
const CAPTURE_FRAMES = 1500; // the attract demo first enters 0x0348 around frame 695
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is async,
// so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/**
 * Hook 0x0348 in a real attract run and clone the machine the first time the demo enters
 * the main loop — a genuine in-play entry state (valid stack, live game RAM, game-mode 4).
 * The wrapper snapshots then runs the oracle so the host run proceeds to its own stop.
 */
function captureRealEntry() {
  let entry = null;
  const snapshot = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return oracle(mm);
  }]]);
  makeMachine(snapshot).runFrames(CAPTURE_FRAMES);
  return entry;
}

/** Sentinel thrown to stop the never-returning loop after exactly one pass. */
const ONE_PASS = Symbol("one-pass");

/**
 * Run `fn` (the oracle or any idiomatic-shaped main loop) for exactly one pass on
 * `machine`, by throwing at the SECOND watchdog kick (the top of pass 2). Returns the
 * number of watchdog reads seen — 2 means one full pass ran and we stopped at the next.
 * Restores read8 on the way out. Fails loudly if the loop ever returns (it must not).
 */
function runOnePass(machine, fn) {
  const realRead = machine.mem.read8.bind(machine.mem);
  let kicks = 0;
  machine.mem.read8 = (addr) => {
    if ((addr & 0xffff) === WATCHDOG) {
      kicks += 1;
      if (kicks >= 2) throw ONE_PASS;
    }
    return realRead(addr);
  };
  try {
    fn(machine);
    throw new Error("main loop returned — it must never return");
  } catch (e) {
    if (e !== ONE_PASS) throw e;
  } finally {
    machine.mem.read8 = realRead;
  }
  return kicks;
}

/**
 * Run the ORACLE for one pass and report the lowest stack pointer its pushes reached, so
 * the RAM diff can exclude exactly the dead [lowestSP, STACK_TOP) scratch the idiomatic
 * (stack-free) form never writes. Only the oracle pushes, so only its run is tracked.
 */
function runOraclePass(machine) {
  let lowestSP = STACK_TOP;
  const realPush = machine.push16.bind(machine);
  machine.push16 = (v) => {
    realPush(v);
    if (machine.regs.sp < lowestSP) lowestSP = machine.regs.sp;
  };
  const kicks = runOnePass(machine, oracle);
  machine.push16 = realPush;
  return { kicks, lowestSP };
}

/**
 * First differing RAM byte between the oracle machine and a candidate, EXCLUDING the dead
 * stack-scratch window [stackLow, STACK_TOP] the oracle's call brackets churn. Null when
 * otherwise identical.
 */
function ramDiffOutsideStack(oracleM, candM, stackLow) {
  const da = oracleM.dumpState();
  const db = candM.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = oracleM.stateOffsetToAddr(i);
    if (addr >= stackLow && addr <= STACK_TOP) continue; // dead stack scratch
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/**
 * Run the oracle and a candidate each for one pass from the same entry and return the first
 * RAM difference outside the stack scratch (null == EQUAL). Both sides start from independent
 * clones of `entry`, so any divergence is the candidate's fault.
 */
function diffOnePass(entry, cand) {
  const o = entry.clone();
  const { kicks, lowestSP } = runOraclePass(o);
  assert.equal(kicks, 2, "oracle ran exactly one pass (one watchdog kick, stopped at the next)");

  const c = entry.clone();
  const candKicks = runOnePass(c, cand);
  assert.equal(candKicks, 2, "candidate ran exactly one pass");

  return ramDiffOutsideStack(o, c, lowestSP);
}

// -- 0. HARNESS ---------------------------------------------------------------

test("HARNESS: a real 0x0348 entry is captured and the oracle's one pass is deterministic", () => {
  const entry = captureRealEntry();
  assert.ok(entry, "expected the attract demo to enter the main loop 0x0348");

  const diff = diffOnePass(entry, oracle); // oracle vs oracle -> must be identical
  assert.equal(diff, null, diff && `oracle run not deterministic: diff at ${hx(diff.addr)}`);
  console.log(
    `  HARNESS: captured a real 0x0348 entry (game-mode ${entry.mem.read8(GAME_MODE)}); ` +
      "oracle one-pass deterministic; loop confirmed non-returning",
  );
});

// -- 1. EQUAL on the real captured entry (game-mode 4 -> demo-steer arm) -------

test("EQUAL (real entry, demo mode): mainLoop == oracle over work/colour/video/sprite RAM", () => {
  const entry = captureRealEntry();
  assert.ok(entry, "need a captured 0x0348 entry");
  assert.equal(entry.mem.read8(GAME_MODE), 4, "the attract-demo entry is game-mode 4 (demo-steer arm)");

  const diff = diffOnePass(entry, idiomatic);
  assert.equal(diff, null, diff && `RAM diff at ${hx(diff.addr)} oracle=${diff.a} idiomatic=${diff.b}`);
  console.log("  EQUAL/real: mainLoop identical to the oracle over one pass (demo-steer arm)");
});

// -- 2. EQUAL on a crafted game-mode-0 entry (skip arm) -----------------------

test("EQUAL (crafted game-mode 0): the demo steerer is skipped on both sides, identical", () => {
  const seed = captureRealEntry();
  assert.ok(seed, "need a captured 0x0348 entry to craft from");
  const entry = seed.clone();
  entry.mem.write8(GAME_MODE, 0); // force the non-demo mode identically for both sides

  const diff = diffOnePass(entry, idiomatic);
  assert.equal(diff, null, diff && `RAM diff at ${hx(diff.addr)} oracle=${diff.a} idiomatic=${diff.b}`);
  console.log("  EQUAL/mode0: mainLoop identical to the oracle over one pass (skip arm)");
});

// -- 3 & 4. TEETH: broken twins of mainLoop the RAM diff must catch -----------

/** Broken twin: the correct pass but with the reaction driver dropped. */
function twinDroppedService(m) {
  const { mem8 } = m;
  for (;;) {
    void mem8[WATCHDOG];
    enableNmi(m);
    if (mem8[GAME_MODE] === 4) steerDemoPlayer(m);
    dispatchObjectFrameByStateTimer(m);
    advanceColumnAnimation(m);
    glitterJewels(m);
    // BUG: advanceReactionObject(m) omitted
  }
}

/** Broken twin: the demo-mode test flipped, so the steerer runs on the wrong mode. */
function twinFlippedDemoTest(m) {
  const { mem8 } = m;
  for (;;) {
    void mem8[WATCHDOG];
    enableNmi(m);
    if (mem8[GAME_MODE] !== 4) steerDemoPlayer(m); // BUG: should be === 4
    dispatchObjectFrameByStateTimer(m);
    advanceColumnAnimation(m);
    glitterJewels(m);
    advanceReactionObject(m);
  }
}

test("TEETH (dropped service): a twin that omits the reaction driver is CAUGHT in RAM", () => {
  const entry = captureRealEntry();
  assert.ok(entry, "need a captured 0x0348 entry to seed the teeth check");

  const diff = diffOnePass(entry, twinDroppedService);
  assert.ok(diff, "the gate FAILED to catch a dropped per-frame service — it proves nothing");
  console.log(`  TEETH/drop: dropped-service twin caught at ${hx(diff.addr)} (oracle=${diff.a} broken=${diff.b})`);
});

test("TEETH (flipped demo test): a twin that steers on the wrong mode is CAUGHT in RAM", () => {
  const entry = captureRealEntry();
  assert.ok(entry, "need a captured 0x0348 entry to seed the teeth check");
  assert.equal(entry.mem.read8(GAME_MODE), 4, "demo-mode entry needed to expose the flipped test");

  const diff = diffOnePass(entry, twinFlippedDemoTest);
  assert.ok(diff, "the gate FAILED to catch the flipped demo-mode test — it proves nothing");
  console.log(`  TEETH/flip: flipped-demo-test twin caught at ${hx(diff.addr)} (oracle=${diff.a} broken=${diff.b})`);
});
