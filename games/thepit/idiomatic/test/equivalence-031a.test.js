// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for initRoundAndEnterMainLoop (ROM 0x031a, The Pit) — the final per-round
 * (re)init: request the round-start sound, restore the player record, paint the board,
 * (in real play) draw the players HUD, seed the object / column-reveal / reaction state,
 * derive the main loop's per-frame pacing delay (0x8011 = 0x804e - LEVEL), clear the
 * frame counter and the first sound slot, then fall through into the main game loop.
 *
 * THE CONTRACT — OBSERVABLE RAM. The routine's output is memory: the setup chain's
 * writes (painted tilemap/colour map, HUD, object/column/reaction state, sound ring),
 * the pacing delay at 0x8011, and the two cleared bytes. pc, SP and the value registers
 * are the declared-dead live-out and are EXCLUDED — the routine exits into a forever
 * loop that re-establishes its own state, so nothing reads a register back.
 *
 * TWO WRINKLES the harness models identically on both sides, so neither can manufacture
 * a difference — only reveal one:
 *   - The main-loop fall-through. initRoundAndEnterMainLoop's tail is a fall-through into the in-game main
 *     loop (mainLoop, 0x0348), now a DIRECT idiomatic call, no longer a registry boundary.
 *     It re-seats the stack and spins forever, so running either arm to completion would
 *     hang. Rather than stub it (the idiomatic direct call can no longer be intercepted),
 *     both arms run the REAL loop — idiomatic via its import, oracle via m.call to the real
 *     translated loop registered on the clone — under ONE shared watchdog hook that stops
 *     both at the loop's entry. The loop reads the watchdog once at the top of every pass,
 *     BEFORE it does any per-frame work; the setup frame-waits only read the watchdog while
 *     the per-frame countdown is still draining, so the FIRST watchdog read the hook sees
 *     with the countdown already at 0 is unambiguously the loop's pass top — it throws
 *     there. That is the identical point the old no-op stub compared at (the loop has done
 *     nothing yet), so the diff still measures exactly initRoundAndEnterMainLoop's own work.
 *   - paintScreen's frame-waits. The board paint pauses one frame before each copy via a
 *     busy-wait on the per-frame countdown cell (0x8009), which nothing in the code drives
 *     — in the live game the per-frame interrupt ticks it down. The same watchdog hook
 *     models that once-per-frame tick: each watchdog read that finds the countdown non-zero
 *     decrements it (floored at 0), so every frame-wait terminates.
 *
 * ONE MORE WRINKLE — dead stack scratch. The oracle threads its calls through the Z80
 * stack (The Pit's stack is real diffed work RAM near 0x83ff); the direct idiomatic calls
 * leave different bytes in the eight scratch cells just below the entry stack pointer
 * ([0x83f7, 0x83ff)). Those cells are dead — overwritten by the next push or never read,
 * and the fall-through main loop hard-resets the stack anyway — the classic stack scratch.
 * The RAM diff therefore excludes exactly that window and compares everything else
 * byte-for-byte; the window sits in the stack page, far above every observable output
 * (named work RAM ends by 0x823f; the colour map 0x8800 and tilemap 0x9000 lie above it),
 * so it can hide no real difference.
 *
 * Checks:
 *   1. HARNESS — the real boot dispatch is captured (0x031a fires once from entering play
 *      mode, ~frame 530), the entry is sane (SP in the stack page, the excluded window
 *      pure stack, game mode 4 = attract), and the oracle run is deterministic.
 *   2. EQUAL (captured, mode 4) — initRoundAndEnterMainLoop == oracle outside the stack scratch; the pacing
 *      delay is derived and the frame counter + first sound slot are cleared.
 *   3. EQUAL (crafted, mode 1) — poking game mode to 1 forces the real-play arm that draws
 *      the players HUD; initRoundAndEnterMainLoop == oracle there too, which proves the mode gate on that
 *      draw matches the oracle (a wrong condition would diff the HUD region).
 *   4. TEETH (wrong pacing delay) — a twin that corrupts 0x8011 is CAUGHT at 0x8011.
 *   5. TEETH (skipped flag clear) — a twin that leaves the frame counter non-zero (skips
 *      the clear) is CAUGHT at PLAY_PHASE_COUNTER.
 *   6. TEETH (wrong players-HUD arm) — a twin that draws the players HUD in attract (mode 4,
 *      where the oracle does not) is CAUGHT in the HUD region, proving the draw arm is
 *      load-bearing.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-031a.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_031a as oracle } from "../../translated/loc_031a.js";
import { initRoundAndEnterMainLoop as idiomatic } from "../initRoundAndEnterMainLoop.js";
import { loc_0348 as oracleMainLoop } from "../../translated/loc_0348.js";
import { drawPlayerLabel } from "../drawPlayerLabel.js";
import { makeMachineFactory } from "../../machine.js";
import { GAME_STATE, LEVEL, SOUND_RING, PLAY_PHASE_COUNTER } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
// RETIRED (coroutine go-live): this address is a control-SPINE routine — now a generator (or a caller of
// one) under runGeneratorGame. Its isolated crafted-entry harness below drove it as a plain function,
// which no longer models it: a boot-chain / main-loop / wait generator never "returns", and a transition
// is a mid-frame throw-restart, neither expressible as one plain call. The WHOLE-GAME byte-exact coroutine
// gates SUBSUME it — golive.test.js (boot->attract), tape.test.js (coin/start/dig), transition.test.js
// (level / round / game-over boundaries) run every spine routine live and diff against the translated
// oracle frame-for-frame. Kept (not deleted) to preserve the harness + rationale. See
// docs/integration-testing.md "Go-live, the RIGHT way".
const test = (name, fn) => nodeTest(name, { skip: "retired: control-spine routine validated by the whole-game coroutine gates (golive/tape/transition)" }, fn);

const TARGET = 0x031a;
const MAIN_LOOP = 0x0348; // the never-returning main loop initRoundAndEnterMainLoop falls into (now a direct call)
const COUNTDOWN = 0x8009; // per-frame countdown paintScreen's frame-waits drain to 0
const WATCHDOG = 0xb800; // reading it kicks the watchdog (once per busy-wait / loop pass)
const DELAY = 0x8011; // the main loop's per-frame pacing delay this routine derives
const HUD_CELL = 0x8981; // a colour cell drawPlayerLabel paints (fill byte 7; attract leaves 6)
const STACK_SCRATCH = 8; // dead scratch cells just below the entry SP the oracle's calls leave
const CAPTURE_FRAMES = 700; // 0x031a dispatches once during boot (~frame 530)
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// A unique token thrown to bound the never-returning main loop at its entry (see wrinkle 1).
const BOUND = Symbol("mainLoop-entry-bound");

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture the pristine machine state at 0x031a's genuine boot dispatch. The main loop it
 * falls into (0x0348) is stubbed to a no-op during capture so the host boot run does not
 * hang on the forever loop; the comparison clones re-register the REAL loop (see runBounded).
 */
function captureEntry() {
  let entry = null;
  const overrides = new Map([
    [TARGET, (mm) => {
      if (entry === null) entry = mm.clone();
      return oracle(mm);
    }],
    [MAIN_LOOP, () => {}],
  ]);
  makeMachine(overrides).runFrames(CAPTURE_FRAMES);
  return entry;
}

const ENTRY = ROM_PRESENT ? captureEntry() : null;

/**
 * Install the shared main-loop bound on a clone: register the REAL translated main loop at
 * 0x0348 (so the oracle arm runs it for real, not the capture stub), then hook the watchdog.
 * Each read that finds the per-frame countdown non-zero drains it (modelling the per-frame
 * interrupt, so paintScreen's frame-waits terminate); the FIRST read with the countdown
 * already at 0 is the main loop's pass top (the setup frame-waits never read it drained), so
 * the hook runs `atBound` (a teeth mutation, if any) and throws to stop at the loop's entry.
 * Restores read8 before running `atBound` so the mutation cannot re-enter the hook.
 */
function installMainLoopBound(m, atBound) {
  m.routines.set(MAIN_LOOP, oracleMainLoop);
  const mem = m.mem;
  const origRead8 = mem.read8.bind(mem);
  mem.read8 = (addr) => {
    if (addr === WATCHDOG) {
      const c = origRead8(COUNTDOWN);
      if (c !== 0) {
        mem.write8(COUNTDOWN, c - 1);
      } else {
        mem.read8 = origRead8;
        if (atBound) atBound(m);
        throw BOUND;
      }
    }
    return origRead8(addr);
  };
}

/** Run `fn` on a fresh clone of `entry` bounded at the main loop's entry (optionally applying
 *  `atBound` there, for the teeth twins). Asserts the run reached the bound. */
function runBounded(entry, fn, atBound) {
  const m = entry.clone();
  installMainLoopBound(m, atBound);
  let bounded = false;
  try {
    fn(m);
  } catch (e) {
    if (e !== BOUND) throw e;
    bounded = true;
  }
  assert.ok(bounded, "run did not reach the main loop's entry bound — the harness never engaged");
  return m;
}

/**
 * First differing RAM byte between two machines, EXCLUDING the dead stack-scratch window
 * just below the entry SP (the oracle's balanced pushes leave different bytes there and
 * nothing reads them). Null when otherwise identical.
 */
function ramDiffOutsideStack(a, b, entrySP) {
  const da = a.dumpState();
  const db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= entrySP - STACK_SCRATCH && addr < entrySP) continue; // dead stack scratch
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/**
 * Run the oracle and a candidate on two independent clones of an entry, both bounded at the
 * main loop's entry (`atBound` applied only to the candidate, for the teeth), and return the
 * first RAM difference outside the stack scratch (null == EQUAL on the observable contract).
 */
function observableDiff(entry, candidate, atBound) {
  const a = runBounded(entry, oracle);
  const b = runBounded(entry, candidate, atBound);
  return ramDiffOutsideStack(a, b, entry.regs.sp);
}

/** Run a candidate on a clone bounded at the main loop's entry and hand back the machine. */
function run(entry, candidate) {
  return runBounded(entry, candidate);
}

// -- 1. HARNESS: real dispatch captured + entry sane + oracle deterministic ----

test("HARNESS: 0x031a boot dispatch captured, entry sane, oracle deterministic", () => {
  assert.ok(ENTRY, "expected 0x031a to be dispatched during boot");
  const sp = ENTRY.regs.sp;
  // The excluded window must sit in the stack page, above every observable output (named
  // work RAM ends by 0x823f, colour map 0x8800, tilemap 0x9000), so it can hide nothing.
  assert.ok(sp - STACK_SCRATCH > 0x8300 && sp <= 0x83ff, `entry SP ${hx(sp)} not in the stack page`);
  assert.equal(ENTRY.mem.read8(GAME_STATE), 4, "captured boot dispatch is the attract demo (game mode 4)");

  assert.equal(observableDiff(ENTRY, oracle), null, "oracle run not deterministic outside the stack scratch");
  console.log(`  HARNESS: captured 0x031a (SP=${hx(sp)}, mode=${ENTRY.mem.read8(GAME_STATE)}); oracle deterministic, real main loop bounded at entry`);
});

// -- 2. EQUAL: real captured dispatch (attract, mode 4) -----------------------

test("EQUAL (captured, mode 4): initRoundAndEnterMainLoop == oracle outside the stack scratch", () => {
  assert.ok(ENTRY, "need the captured 0x031a entry");
  const ram = observableDiff(ENTRY, idiomatic);
  assert.equal(ram, null, ram && `RAM diverged at ${hx(ram.addr ?? 0)} (oracle=${ram.a} idiomatic=${ram.b})`);

  // Positive checks: the delay was derived and the two flags cleared, matching the oracle.
  const c = run(ENTRY, idiomatic);
  const o = run(ENTRY, oracle);
  assert.equal(c.mem.read8(DELAY), o.mem.read8(DELAY), "pacing delay 0x8011 not derived to match the oracle");
  assert.equal(c.mem.read8(PLAY_PHASE_COUNTER), 0, "frame counter not cleared");
  assert.equal(c.mem.read8(SOUND_RING), 0, "first sound slot not cleared");
  console.log(`  EQUAL/captured: identical outside the stack scratch; delay 0x8011=${c.mem.read8(DELAY)}, flags cleared`);
});

// -- 3. EQUAL: crafted mode 1 forces the players-HUD arm ----------------------

test("EQUAL (crafted, mode 1): drawing the players HUD in real play, still == oracle", () => {
  const seed = ENTRY.clone();
  seed.mem.write8(GAME_STATE, 1); // real play, 1 player -> the drawPlayerLabel arm fires
  const ram = observableDiff(seed, idiomatic);
  assert.equal(ram, null, ram && `RAM diverged at ${hx(ram.addr ?? 0)} (oracle=${ram.a} idiomatic=${ram.b})`);

  // Confirm the mode gate really is load-bearing: mode 1 paints the HUD cell, mode 4 (attract)
  // does not, so the same cell differs between the two arms — the branch was exercised.
  const hudMode1 = run(seed, idiomatic).mem.read8(HUD_CELL);
  const hudMode4 = run(ENTRY, idiomatic).mem.read8(HUD_CELL);
  assert.notEqual(hudMode1, hudMode4, "players-HUD arm produced no observable change vs attract");
  console.log(`  EQUAL/mode1: identical outside the stack scratch; HUD cell ${hx(HUD_CELL)} ${hudMode4}->${hudMode1} (arm taken)`);
});

// -- 4. TEETH: a wrong pacing delay -------------------------------------------

test("TEETH (wrong delay): a corrupted 0x8011 is CAUGHT", () => {
  // At the main-loop entry bound, initRoundAndEnterMainLoop has already derived the pacing delay; flip it there.
  const ram = observableDiff(ENTRY, idiomatic, (m) => m.mem.write8(DELAY, m.mem.read8(DELAY) ^ 0xff));
  assert.notEqual(ram, null, "the gate FAILED to catch a wrong pacing delay — it is worthless");
  assert.equal(ram.addr, DELAY, `teeth caught ${hx(ram.addr ?? 0)} (expected ${hx(DELAY)})`);
  console.log(`  TEETH/delay: wrong delay caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

// -- 5. TEETH: a skipped flag clear -------------------------------------------

test("TEETH (skipped flag clear): a non-zero frame counter is CAUGHT", () => {
  // initRoundAndEnterMainLoop clears the frame counter before the loop; re-dirty it at the bound (the "skip").
  const ram = observableDiff(ENTRY, idiomatic, (m) => m.mem.write8(PLAY_PHASE_COUNTER, 0xff));
  assert.notEqual(ram, null, "the gate FAILED to catch a skipped flag clear — it is worthless");
  assert.equal(ram.addr, PLAY_PHASE_COUNTER, `teeth caught ${hx(ram.addr ?? 0)} (expected ${hx(PLAY_PHASE_COUNTER)})`);
  console.log(`  TEETH/flag: uncleared frame counter caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

// -- 6. TEETH: the players-HUD drawn when it should not be --------------------

test("TEETH (wrong players-HUD arm): drawing the HUD in attract is CAUGHT in the HUD region", () => {
  // Draw the players HUD at the bound even in attract (mode 4), where the oracle leaves it
  // alone — the wrong-mode-gate bug the HUD region must catch.
  const ram = observableDiff(ENTRY, idiomatic, (m) => drawPlayerLabel(m));
  assert.notEqual(ram, null, "the gate FAILED to catch a wrongly-drawn players HUD — it is worthless");
  // The extra paint lands in drawPlayerLabel's plot scratch (0x8055..0x8060) and its colour
  // column (0x8800+), all genuine (non-stack) cells — the first diff is one of them.
  assert.ok(ram.addr < 0x8300 || ram.addr >= 0x8800, `expected a HUD-paint diff, got ${hx(ram.addr ?? 0)}`);
  console.log(`  TEETH/hud: wrongly-drawn HUD caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});
