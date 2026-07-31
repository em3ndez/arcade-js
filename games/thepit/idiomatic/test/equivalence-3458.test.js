// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for tickObjectDwellThenTransition (ROM 0x3458) — the per-object state countdown
 * that blinks the actor's sprite while it runs and hands off to the round/mode
 * transition (0x0278) when it expires.
 *
 * CONTRACT. The routine's declared live-out is MEMORY-ONLY — the decremented countdown
 * 0x808b plus, on every fourth tick, the paired top-bit flips of the actor-state flag
 * (0x8084) and the sprite code (0x8069). So the gate compares RAM only (dumpState),
 * excluding the Z80 pc/SP/value-registers the honest-signature rewrite does not
 * preserve (the oracle's residual A/flags are dead ABI, and its terminal ret only pops
 * the stack — it writes no memory).
 *
 * WHY A CRAFTED ENTRY + SWEEP. 0x3458's arrival/collision entry conditions (an object
 * reaching its target column, or being latched onto the player box) are never met in a
 * plain attract run, so the capture/replay harness cannot hook 0x3458 directly. Instead
 * the gate captures a REAL attract machine state at a sibling leaf that IS reached
 * (0x3dae, first dispatched ~frame 81) and replays 0x3458 from it. The countdown 0x808b
 * is the routine's ONLY branch input, so poking it across all 256 values is an
 * exhaustive sweep of the control flow: it hits the expiry tick (0x808b==1 -> 0), the
 * every-fourth-tick blink (0x808b in {5,9,13,...}), the idle ticks, and the 0->255 wrap
 * (0x808b==0).
 *
 * ONE WRINKLE — the expiry branch runs the real round/state-boundary transition
 * (idiomatic dockManAndDispatchRoundBoundary, the same code the candidate calls directly). dockManAndDispatchRoundBoundary and its
 * successors are all idiomatic now, so it runs its whole real successor chain, which
 * converges at the two TRUE oracle leaves — 0x031a (round-loop setup) and 0x01f9
 * (reset/entry handler) — that never return on hardware (they busy-wait on the vblank NMI,
 * which never fires on a neutralised clone). Both the oracle tickObjectDwellThenTransition (via dockManAndDispatchRoundBoundary) and
 * the candidate reach those same leaves, so the gate stubs THOSE identically on both clones
 * with a sentinel-writing no-op, and models the once-per-frame tick the chain's frame-waits
 * drain (else they never terminate). That keeps the expiry branch exercised and terminating,
 * and makes "took the expiry branch" observable in RAM (the sentinel) so a twin that skips
 * it is caught. The RAM diff excludes the dead top-of-stack scratch the chain leaves.
 *
 * Checks:
 *   0. HARNESS — capture a real 0x3dae attract state and confirm the oracle run of
 *      0x3458 is deterministic (oracle vs oracle -> identical RAM) across a few pokes.
 *   1. EQUAL (exhaustive sweep 0..255) — tickObjectDwellThenTransition == oracle over RAM for every countdown
 *      value, plus positive checks that the blink fired (0x808b==9), the idle tick did
 *      nothing (0x808b==3), and the expiry branch reached 0x0278 (0x808b==1 -> sentinel).
 *   2. TEETH (wrong flip bit) — a twin that flips bit 6 instead of bit 7 on the blink
 *      tick is CAUGHT at the sprite/state flags.
 *   3. TEETH (skips expiry) — a twin with no expiry branch (it blinks on the zero tick
 *      instead of transitioning) is CAUGHT.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3458.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3458 as oracle } from "../../translated/loc_3458.js";
import { tickObjectDwellThenTransition as idiomatic } from "../tickObjectDwellThenTransition.js";
import { dockManAndDispatchRoundBoundary } from "../dockManAndDispatchRoundBoundary.js";
import { loc_3dae as captureLeaf } from "../../translated/loc_3dae.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { ENEMY_ACTION_TIMER, ENEMY_WORK_SPRITE, PLAYER_FACING } from "../ram.js";

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

const CAPTURE_AT = 0x3dae; // a real attract leaf, reached ~frame 81 in a plain boot run
// The two TRUE oracle leaves dockManAndDispatchRoundBoundary's real successor chain converges at — each never
// returns on hardware, so the gate stubs both. Reaching either means the expiry transition
// ran to completion.
const EXPIRY_LEAVES = [0x031a, 0x01f9];
const SENTINEL_ADDR = 0x87ff; // an otherwise-untouched work-RAM byte the leaf stub marks
const SENTINEL = 0xaa;
const WATCHDOG = 0xb800; // reading it kicks the watchdog (once per frame-wait pass)
const COUNTDOWN = 0x8009; // the per-frame countdown the chain's frame-waits drain to 0
// Dead top-of-stack scratch the round-boundary chain leaves (its calls push return
// addresses / the teardown leaf resets SP to 0x83ff); the stack-free idiomatic calls do
// not. No real cell of tickObjectDwellThenTransition or its chain lives here (all named cells sit far below).
const STACK_SCRATCH_LO = 0x83e0;
const STACK_SCRATCH_HI = 0x8400;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/** Hook the reachable leaf 0x3dae in a real attract run and clone the machine at its
 *  first dispatch — a genuine mid-attract state (valid stack, in-play work RAM). */
function captureRealAttractState(maxFrames) {
  let entry = null;
  const snapshot = new Map([[CAPTURE_AT, (mm) => {
    if (entry === null) entry = mm.clone();
    return captureLeaf(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(maxFrames);
  return entry;
}

/** Identical no-op stub for each of dockManAndDispatchRoundBoundary's chain leaves: writes a sentinel so "the
 *  expiry branch ran to a leaf" is observable in RAM, and terminates (the real leaves
 *  would hang on a single-routine clone by busy-waiting on the NMI). */
function expiryStub(mm) {
  mm.mem.write8(SENTINEL_ADDR, SENTINEL);
}

/** Model the once-per-frame interrupt tick that drives the chain's frame-waits to
 *  completion: each watchdog read decrements the countdown, floored at 0. Identical on
 *  both clones, so it can only expose a difference, never create one. */
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

/** Clone the seed, force the countdown to `v`, install the identical leaf stubs + the
 *  frame-tick, then run `fn`. Returns the resulting machine. */
function runFrom(seed, v, fn) {
  const c = seed.clone();
  for (const addr of EXPIRY_LEAVES) c.routines.set(addr, expiryStub);
  installFrameTick(c);
  c.mem.write8(ENEMY_ACTION_TIMER, v);
  fn(c);
  return c;
}

/** First differing RAM byte between two machines (full dumpState), EXCLUDING the dead
 *  top-of-stack scratch the round-boundary chain leaves. Null when otherwise identical. */
function ramDiff(a, b) {
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

/** First differing RAM byte (outside the stack scratch) between the oracle run and
 *  `fn`'s run from countdown `v`, or null when their memory is identical. */
function ramDiffVsOracle(seed, v, fn) {
  const o = runFrom(seed, v, oracle);
  const c = runFrom(seed, v, fn);
  return ramDiff(o, c);
}

// -- 0. HARNESS (reachability + determinism) ---------------------------------

test("HARNESS: a real 0x3dae attract state is captured and the oracle run is deterministic", () => {
  const seed = captureRealAttractState(300);
  assert.ok(seed, "expected the leaf 0x3dae to be dispatched during attract");

  for (const v of [1, 3, 9, 0]) {
    const a = runFrom(seed, v, oracle);
    const b = runFrom(seed, v, oracle);
    const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(d, null, d && `oracle run not deterministic at 0x808b=${v}: diff at ${hx(d.addr ?? 0)}`);
  }
  console.log(
    `  HARNESS: captured a real 0x3dae entry (SP=${hx(seed.regs.sp)}, ` +
      `0x808b=${seed.mem.read8(ENEMY_ACTION_TIMER)}); oracle run of 0x3458 deterministic`,
  );
});

// -- 1. EQUAL over the exhaustive countdown sweep 0..255 ----------------------

test("EQUAL (sweep 0..255): tickObjectDwellThenTransition == oracle over RAM for every countdown value", () => {
  const seed = captureRealAttractState(300);
  assert.ok(seed, "need a captured 0x3dae entry");

  for (let v = 0; v < 256; v++) {
    const diff = ramDiffVsOracle(seed, v, idiomatic);
    assert.equal(diff, null, diff && `0x808b=${v}: RAM diff at ${hx(diff.addr ?? 0)} oracle=${diff.a} cand=${diff.b}`);
  }

  // Positive checks: the routine actually did the work on each branch (not vacuous).
  const base84 = seed.mem.read8(ENEMY_WORK_SPRITE), base69 = seed.mem.read8(PLAYER_FACING);

  const blink = runFrom(seed, 9, idiomatic); // remaining 8, a fourth tick -> blink
  assert.equal(blink.mem.read8(ENEMY_WORK_SPRITE), base84 ^ 0x80, "blink tick did not flip the actor-state top bit");
  assert.equal(blink.mem.read8(PLAYER_FACING), base69 ^ 0x80, "blink tick did not flip the sprite-code top bit");
  assert.equal(blink.mem.read8(ENEMY_ACTION_TIMER), 8, "countdown did not decrement on the blink tick");

  const idle = runFrom(seed, 3, idiomatic); // remaining 2, not a fourth tick -> idle
  assert.equal(idle.mem.read8(ENEMY_WORK_SPRITE), base84, "idle tick wrongly touched the actor-state flag");
  assert.equal(idle.mem.read8(PLAYER_FACING), base69, "idle tick wrongly touched the sprite code");
  assert.equal(idle.mem.read8(ENEMY_ACTION_TIMER), 2, "countdown did not decrement on the idle tick");

  const expiry = runFrom(seed, 1, idiomatic); // remaining 0 -> hand off to 0x0278
  assert.equal(expiry.mem.read8(SENTINEL_ADDR), SENTINEL, "expiry tick did not reach the transition 0x0278");
  assert.equal(expiry.mem.read8(ENEMY_ACTION_TIMER), 0, "countdown did not decrement to zero on expiry");

  const wrap = runFrom(seed, 0, idiomatic); // dec of 0 wraps to 255, then an idle tick
  assert.equal(wrap.mem.read8(ENEMY_ACTION_TIMER), 255, "countdown did not wrap 0 -> 255");

  console.log("  EQUAL/sweep: all 256 countdown values match the oracle; blink, idle, expiry and the 0->255 wrap confirmed");
});

// -- 2. TEETH: a wrong flip bit is caught ------------------------------------

/** Broken twin: flips bit 6 instead of bit 7 on the blink tick. */
function twinWrongFlipBit(m) {
  const { mem8 } = m;
  const remaining = mem8[ENEMY_ACTION_TIMER] - 1;
  mem8[ENEMY_ACTION_TIMER] = remaining;
  if (remaining === 0) return dockManAndDispatchRoundBoundary(m);
  if ((remaining & 3) !== 0) return;
  mem8[ENEMY_WORK_SPRITE] ^= 0x40; // BUG: wrong bit
  mem8[PLAYER_FACING] ^= 0x40; // BUG: wrong bit
}

test("TEETH (wrong flip bit): a bit-6 twin is CAUGHT at the blink flags", () => {
  const seed = captureRealAttractState(300);
  assert.ok(seed, "need a captured 0x3dae entry");

  const diff = ramDiffVsOracle(seed, 9, twinWrongFlipBit); // 0x808b=9 -> blink tick
  assert.notEqual(diff, null, "the gate FAILED to catch the wrong-flip-bit twin — it proves nothing");
  console.log(`  TEETH/flipbit: wrong-bit twin caught at ${hx(diff.addr ?? 0)} (oracle=${diff.a} broken=${diff.b})`);
});

// -- 3. TEETH: a twin that skips the expiry branch is caught -----------------

/** Broken twin: no expiry branch — on the zero tick it blinks instead of transitioning. */
function twinSkipsExpiry(m) {
  const { mem8 } = m;
  const remaining = mem8[ENEMY_ACTION_TIMER] - 1;
  mem8[ENEMY_ACTION_TIMER] = remaining;
  // BUG: missing `if (remaining === 0) return m.call(EXPIRY_TARGET);`
  if ((remaining & 3) !== 0) return;
  mem8[ENEMY_WORK_SPRITE] ^= 0x80;
  mem8[PLAYER_FACING] ^= 0x80;
}

test("TEETH (skips expiry): a twin with no expiry branch is CAUGHT on the zero tick", () => {
  const seed = captureRealAttractState(300);
  assert.ok(seed, "need a captured 0x3dae entry");

  const diff = ramDiffVsOracle(seed, 1, twinSkipsExpiry); // 0x808b=1 -> should transition
  assert.notEqual(diff, null, "the gate FAILED to catch the skips-expiry twin — it proves nothing");
  console.log(`  TEETH/expiry: skips-expiry twin caught at ${hx(diff.addr ?? 0)} (oracle=${diff.a} broken=${diff.b})`);
});
