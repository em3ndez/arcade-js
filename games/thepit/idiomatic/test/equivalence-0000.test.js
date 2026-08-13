// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for resetVector (ROM 0x0000, The Pit) — the power-on reset
 * vector: the first instruction the processor runs after reset, which hands straight off
 * to cold-boot init (0x01a4) and never returns. The idiomatic routine is pure delegation
 * (`return coldBootInit(m)`), so this gate proves the delegation is faithful: driving the
 * boot through it leaves the same observable RAM as the oracle, which resolves the same
 * hand-off through the address registry.
 *
 * The boot never returns (resetVector -> coldBootInit -> the reset/round-restart epilogue
 * -> the still-oracle reset/entry handler 0x01f9, which re-seats the stack and spins the
 * game loop forever), so the routine cannot run to completion. This is the same shape the
 * sibling coldBootInit gate (equivalence-01a4.test.js) handles one level down, and this
 * gate reuses that harness:
 *
 *   1. STUB THE TAIL. A no-op is installed at 0x01f9 IDENTICALLY on both arms (via the
 *      machine's override map, which clone() carries), so the boot cascade unwinds after
 *      the first dispatch instead of running into the endless loop. The same stub is in
 *      place during capture, so the boot completes on the very first reset dispatch.
 *
 *   2. TICK THE FRAME WAITS. Cold-boot holds for 60 frames and the delegated epilogue
 *      holds the setup screen for a further spell, each busy-looping on the per-frame
 *      countdown (0x8009) reaching 0 — driven in the live game by the per-frame interrupt,
 *      which does not fire on an isolated clone. The harness models that tick with ONE hook
 *      on both clones: each watchdog read (one per wait pass) decrements the countdown,
 *      floored at 0. Same hook on both sides -> it can only reveal a difference.
 *
 *   3. EXCLUDE THE STACK SCRATCH. Cold-boot re-seats the stack to the top of work RAM
 *      (0x83ff); the oracle wraps its callees in stack pushes + returns while the idiomatic
 *      side calls its already-decompiled leaves directly, so the two leave different dead
 *      bytes around that re-seated top. No routine ever reads work RAM at/above 0x8240
 *      (the whole 0x8240..0x87ff region is stack only), so the RAM diff EXCLUDES a window
 *      around the stack top and compares everything else byte for byte. pc / SP / value
 *      registers are excluded per the memory-equivalence contract (the idiomatic layer does
 *      not preserve the register/pc trace; the whole-machine pixel gate backstops it, and
 *      this contract survives the 0x01f9 callee later being dissolved).
 *
 * resetVector is dispatched exactly once, at the first instruction after reset, so the real
 * entry is captured from a boot run (a pristine power-on machine state, SP = 0).
 *
 * CHECKS:
 *   0. HARNESS — capture the real reset dispatch; oracle vs oracle is deterministic, and the
 *      boot completes (credit counter cleared to 0, state bytes 0 / 1, setup hold drained).
 *   1. EQUAL (real dispatch) — resetVector == oracle over RAM outside the stack scratch, and
 *      the delegated boot's outputs (seed stores, state bytes, DIP-decoded block, drained
 *      hold) hold their expected values — proving the vector really drove the whole boot,
 *      not a no-op that happens to match a zeroed power-on state.
 *   2. TEETH (delegation dropped) — a twin that SKIPS coldBootInit is CAUGHT: with a
 *      boot-written cell pre-poked identically on both sides, the correct routine still
 *      overwrites it while the no-delegation twin leaves the poke, so the diff pinpoints it.
 *   3. TEETH (corrupted boot output) — a twin that delegates then corrupts one named boot
 *      output is CAUGHT at that cell (the delegated work is inside the diff).
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-0000.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0000 as oracle } from "../../translated/loc_0000.js";
import { resetVector as idiomatic } from "../resetVector.js";
import { makeMachineFactory } from "../../machine.js";
import { GAME_STATE, ACTIVE_PLAYER, IN1_DEBOUNCED, IN1_PREV, STEP_TIMER_BASE } from "../names.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
// RETIRED (coroutine go-live): this address is a control-SPINE routine — now a generator (or a caller of
// one) under runIdiomaticGame. Its isolated crafted-entry harness below drove it as a plain function,
// which no longer models it: a boot-chain / main-loop / wait generator never "returns", and a transition
// is a mid-frame throw-restart, neither expressible as one plain call. The WHOLE-GAME byte-exact coroutine
// gates SUBSUME it — idiomatic.test.js (boot->attract), tape.test.js (coin/start/dig), transition.test.js
// (level / round / game-over boundaries) run every spine routine live and diff against the translated
// oracle frame-for-frame. Kept (not deleted) to preserve the harness + rationale. See
// docs/integration-testing.md "Go-live, the RIGHT way".
const test = (name, fn) => nodeTest(name, { skip: "retired: control-spine routine validated by the whole-game coroutine gates (idiomatic/tape/transition)" }, fn);

const TARGET = 0x0000; // the reset vector — dispatched at the first instruction after reset
const RESET_HANDLER = 0x01f9; // the still-oracle handler the boot tail reaches — stubbed
const CAPTURE_FRAMES = 2500; // 0x0000 fires at the very first instruction after reset
const WATCHDOG = 0xb800; // reading it kicks the watchdog + (in the harness) ticks the countdown
const COUNTDOWN = 0x8009; // the per-frame countdown each frame-wait drains to 0
const HOLD_COUNTER = 0x800a; // the setup screen's hold counter, drained to 0
const CREDIT_COUNTER = 0x8000; // credit/restart counter, cleared to 0 by the boot
const COIN_DEBOUNCE = 0x8003; // a coin-switch debounce accumulator, seeded to the idle 0xAA
// The stack lives where cold-boot re-seats it, NOT at the captured (power-on) entry SP.
const STACK_TOP = 0x83ff;
const STACK_SCRATCH_BELOW = 32; // dead scratch just below the re-seated stack top
const STACK_SCRATCH_ABOVE = 16; // dead scratch just above it (transient pushes past the top)
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/** No-op stub for the reset/entry handler, so the boot tail terminates instead of running
 *  into the endless game loop. Identical on both arms — it can only isolate the comparison
 *  to the boot's own work, never hide a difference. */
const resetHandlerStub = () => {};

/**
 * Capture the pristine machine state at the FIRST real 0x0000 dispatch during a boot run.
 * The hook clones the entry, then runs the oracle so the host proceeds (its interrupt fires,
 * so the frame-waits terminate). With 0x01f9 stubbed, the cascade unwinds and the boot
 * completes after this one dispatch. clone() carries both overrides, so every replay off
 * this entry resolves 0x01f9 to the same stub.
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
 * the frame-tick harness on both. `opts.poke` ({addr,val}) forces a work-RAM byte identically
 * on both sides (the crafted lever). Returns the first RAM diff outside the stack scratch (or
 * null) plus both clones.
 */
function runPair(candidate, opts = {}) {
  const a = ENTRY.clone();
  const b = ENTRY.clone();
  for (const c of [a, b]) {
    if (opts.poke) c.mem.write8(opts.poke.addr, opts.poke.val);
  }
  installFrameTick(a);
  installFrameTick(b);
  oracle(a);
  candidate(b);
  return { ram: ramDiffOutsideStack(a, b), oracleM: a, candM: b };
}

// -- 0. HARNESS (reachability + determinism) ----------------------------------

test("HARNESS: the real reset 0x0000 dispatch is captured and the oracle run is deterministic", () => {
  assert.ok(ENTRY, "expected 0x0000 to be dispatched at the first instruction after reset");
  assert.equal(ENTRY.regs.sp, 0, "the pristine power-on entry SP is 0 (the boot re-seats it)");

  const { ram, oracleM } = runPair(oracle); // candidate arm = the oracle itself
  assert.equal(ram, null, ram && `oracle run not deterministic: diff at ${hx(ram.addr ?? 0)}`);
  assert.equal(oracleM.mem.read8(CREDIT_COUNTER), 0, "the boot must clear the credit counter to 0");
  assert.equal(oracleM.mem.read8(GAME_STATE), 0, "the boot must clear the game-mode byte to 0");
  assert.equal(oracleM.mem.read8(ACTIVE_PLAYER), 1, "the boot must arm the secondary state byte to 1");
  assert.equal(oracleM.mem.read8(HOLD_COUNTER), 0, "the setup screen's hold must drain to 0");
  console.log(
    `  HARNESS: captured a real 0x0000 entry (SP=${hx(ENTRY.regs.sp)}); ` +
      "oracle deterministic, credit counter 0, state bytes 0/1, hold drained",
  );
});

// -- 1. EQUAL on the real captured dispatch -----------------------------------

test("EQUAL (real dispatch): resetVector == oracle over RAM outside the stack scratch", () => {
  const { ram, candM } = runPair(idiomatic);
  assert.equal(ram, null, ram && `RAM diverged at ${hx(ram.addr ?? 0)} (oracle=${ram.a} idiomatic=${ram.b})`);

  // Positive checks: the delegated boot really ran (not a no-op that matches a zeroed
  // power-on state). Seed stores, the two state bytes, the DIP-decoded block, drained hold.
  assert.equal(candM.mem.read8(CREDIT_COUNTER), 0, "credit counter must be cleared to 0");
  assert.equal(candM.mem.read8(GAME_STATE), 0, "game-mode byte must be cleared to 0");
  assert.equal(candM.mem.read8(ACTIVE_PLAYER), 1, "secondary state byte must be armed to 1");
  assert.equal(candM.mem.read8(IN1_DEBOUNCED), 6, "coin/start debounce latch must be seeded to 6");
  assert.equal(candM.mem.read8(IN1_PREV), 6, "coin/start debounce sample must be seeded to 6");
  assert.equal(candM.mem.read8(COIN_DEBOUNCE), 0xaa, "coin-switch debounce accumulator must be seeded to 0xAA");
  assert.equal(candM.mem.read8(STEP_TIMER_BASE), 55, "DIP decode must run (default cabinet step-timer base)");
  assert.equal(candM.mem.read8(HOLD_COUNTER), 0, "setup hold counter must drain to 0");
  console.log("  EQUAL/real: identical observable RAM; the delegated boot produced seed stores, state bytes 0/1, DIP block");
});

// -- 2. TEETH: dropping the delegation is caught (the hand-off is load-bearing) -

/** Broken twin: SKIPS the delegation entirely — never boots. */
function twinNoDelegation() {
  // BUG: does not call coldBootInit, so none of the boot's work happens.
}

test("TEETH (delegation dropped): a twin that skips coldBootInit is CAUGHT at a pre-poked boot cell", () => {
  // Sanity: with ACTIVE_PLAYER pre-poked to a non-boot value, the CORRECT routine still boots
  // and overwrites it to 1 (so the poke is not itself the diff), and the no-boot twin is caught.
  const clean = runPair(idiomatic, { poke: { addr: ACTIVE_PLAYER, val: 0x55 } });
  assert.equal(clean.ram, null, clean.ram && `pre-poked entry must stay equal for the correct routine (diff at ${hx(clean.ram?.addr ?? 0)})`);
  assert.equal(clean.candM.mem.read8(ACTIVE_PLAYER), 1, "the correct routine must overwrite the pre-poked byte to 1");

  const { ram } = runPair(twinNoDelegation, { poke: { addr: ACTIVE_PLAYER, val: 0x55 } });
  assert.notEqual(ram, null, "the gate FAILED to catch the dropped delegation — it is worthless");
  assert.equal(ram.addr, ACTIVE_PLAYER, `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected ${hx(ACTIVE_PLAYER)})`);
  assert.equal(ram.a, 1, "oracle boots and arms the byte to 1");
  assert.equal(ram.b, 0x55, "the no-delegation twin leaves the pre-poked value");
  console.log(`  TEETH/nodelegate: caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b}) — the hand-off is load-bearing`);
});

// -- 3. TEETH: a corrupted boot output is caught ------------------------------

/** Broken twin: delegates correctly, then corrupts one named boot output. */
function twinCorruptBootOutput(m) {
  idiomatic(m);
  m.mem.write8(COIN_DEBOUNCE, m.mem.read8(COIN_DEBOUNCE) ^ 0xff); // BUG: wrong debounce seed
}

test("TEETH (corrupted boot output): a corrupted coin-switch debounce seed is CAUGHT at 0x8003", () => {
  const { ram } = runPair(twinCorruptBootOutput);
  assert.notEqual(ram, null, "the gate FAILED to catch a corrupted boot output — the delegated work is outside the diff");
  assert.equal(ram.addr, COIN_DEBOUNCE, `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected ${hx(COIN_DEBOUNCE)})`);
  console.log(`  TEETH/corrupt: caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});
