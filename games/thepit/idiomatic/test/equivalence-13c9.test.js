// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for dispatchObjectFrameByStateTimer (ROM 0x13c9) — the per-frame head of the object/state
 * dispatcher, gated by the state-lockout countdown. Each frame it reads the countdown and either
 * advances the tracked object (countdown idle), ticks the countdown down and holds (still running),
 * or — the frame it expires — hands to a round-boundary routine chosen by the post-timer mode byte
 * (0 -> the round/state-boundary dispatcher dockManAndDispatchRoundBoundary; nonzero -> the round-advance / state-reset
 * path 0x02fd, still the frozen oracle).
 *
 * OBSERVABLE-EQUIVALENCE CONTRACT. The routine's own write is the countdown decrement; every other
 * effect comes from the chosen handler, and no caller reads a register back, so the declared
 * LIVE-OUT is MEMORY-ONLY. The gate diffs observable RAM (dumpState); pc / SP / value registers are
 * excluded (the honest-signature contract — the idiomatic layer keeps no Z80 pc/step/register
 * trace, and a strict pc/SP contract would break the moment a still-oracle handler is later
 * dissolved). The still-oracle handler chains thread bytes through the stack (The Pit's stack is
 * real diffed work RAM near 0x83fd) that the stack-free idiomatic calls do not reproduce, so the
 * diff EXCLUDES that dead top-of-stack scratch window [0x83f5, 0x8400). No real cell lives at 0x83xx
 * (real outputs are <= 0x813x, sprite records 0x8220+, video 0x9000+), and the teeth prove the
 * window hides no output.
 *
 * HOW EACH ARM IS RUN.
 *   - dispatch (countdown idle) — the idiomatic side calls advanceTrackedObject directly, the oracle
 *     tail-jumps to 0x13de through the registry; both run the same object dispatcher and its handlers
 *     return within the frame, so the arm just runs to completion and diffs RAM. Reached 3451× in
 *     attract.
 *   - tick (countdown still running) — a pure decrement + stop; the arm's only write is the countdown
 *     byte. Reached 243× in attract, plus a crafted sweep of every start value 2..255.
 *   - expiry -> dockManAndDispatchRoundBoundary (post-timer mode 0) — the idiomatic side calls dockManAndDispatchRoundBoundary directly, the oracle
 *     reaches it through the registry; both run the REAL boundary chain, which busy-waits on the
 *     per-frame countdown and never returns (it reaches the true oracle leaves 0x031a setup /
 *     0x01f9 reset). One shared frame-tick hook drains the countdown and identical stubs at the two
 *     leaves terminate the chain and surface the destination as a RAM byte. Reached 1× in attract.
 *   - expiry -> 0x02fd (post-timer mode nonzero) — both sides reach 0x02fd through the registry
 *     (m.call), so one identical registry stub intercepts both and surfaces "reached 0x02fd" as a
 *     RAM byte. Never reached in attract, so crafted.
 *
 * Checks:
 *   0. HARNESS — capture real 0x13c9 dispatches, confirm the three attract arms appear, and confirm
 *      the oracle run is deterministic (oracle vs oracle -> identical).
 *   1. EQUAL (dispatch arm) — every real countdown-idle dispatch leaves identical RAM.
 *   2. EQUAL (tick arm) — every real countdown-running dispatch, plus a crafted 2..255 start-value
 *      sweep, leaves identical RAM and decrements the countdown by exactly one.
 *   3. EQUAL (expiry -> dockManAndDispatchRoundBoundary) — a crafted mode-0 expiry runs the real boundary chain identically
 *      and both sides reach the same leaf with the countdown drained to zero.
 *   4. EQUAL (expiry -> 0x02fd) — a crafted mode-nonzero expiry reaches the stubbed 0x02fd on both
 *      sides identically, countdown drained to zero.
 *   5. TEETH (skip the decrement) — a twin that never decrements the countdown is CAUGHT at the
 *      countdown byte on a tick entry.
 *   6. TEETH (drop the dispatch) — a twin that returns instead of advancing the object is CAUGHT on a
 *      countdown-idle entry whose dispatch really writes RAM.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-13c9.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_13c9 as oracle } from "../../translated/loc_13c9.js";
import { dispatchObjectFrameByStateTimer as idiomatic } from "../dispatchObjectFrameByStateTimer.js";
import { advanceTrackedObject } from "../advanceTrackedObject.js";
import { dockManAndDispatchRoundBoundary as loc_0278Ref } from "../dockManAndDispatchRoundBoundary.js"; // the mode-0 expiry destination (teeth mirror)
import { advanceToNextLevel } from "../advanceToNextLevel.js"; // the mode-nonzero expiry destination (teeth mirror)
import { makeMachineFactory } from "../../machine.js";
import { TRANSITION_TIMER, GAME_STATE } from "../names.js";

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

const TARGET = 0x13c9;
const POST_TIMER_MODE = 0x807d; // selects the round-boundary routine on expiry (no names.js name yet)
const SETUP_LEAF = 0x031a; // round-loop setup — the "setup" boundary destination (never returns)
const RESET_LEAF = 0x01f9; // reset/entry handler — the "reset" boundary destination (never returns)
const MARKER = 0x8700; // dead work-RAM byte the leaf stubs stamp with the reached leaf's low byte
const WATCHDOG = 0xb800; // reading it kicks the watchdog (once per frame-wait pass)
const COUNTDOWN = 0x8009; // the per-frame countdown the boundary chain's frame-waits drain to 0
// Dead top-of-stack scratch: the oracle's stack-threaded handler chain and the idiomatic direct
// calls legitimately differ here (the boundary chains push down to ~0x83f3 and the reset leaf
// resets the stack pointer). No real cell lives at 0x83xx (highest named work RAM is far below);
// the teeth, which catch real cells at 0x807c / 0x801a / 0x801e, prove the window hides no output.
const STACK_SCRATCH_LO = 0x83f0;
const STACK_SCRATCH_HI = 0x8400;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is async, so build
// the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

const R = (mm, a) => mm.mem.read8(a);

/** Re-derive which arm dispatchObjectFrameByStateTimer takes for an entry, from its gate bytes (coverage + non-vacuity). */
function armOf(mm) {
  const t = R(mm, TRANSITION_TIMER);
  if (t === 0) return "dispatch";
  if (t - 1 !== 0) return "tick";
  return R(mm, POST_TIMER_MODE) === 0 ? "expiry->0278" : "expiry->02fd";
}

/**
 * Hook 0x13c9 in a real attract run and clone the machine at each of its first `limit` dispatches
 * that pass `keep`. The wrapper snapshots then runs the oracle so attract proceeds undisturbed.
 */
function capture(limit, maxFrames, keep = () => true) {
  const caps = [];
  const overrides = new Map([[TARGET, (mm) => {
    if (caps.length < limit && keep(mm)) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  makeMachine(overrides).runFrames(maxFrames);
  return caps;
}

/**
 * First differing state byte between two machines (full dumpState), EXCLUDING the dead
 * top-of-stack scratch window. Null when otherwise identical.
 */
function stateDiffOutsideStack(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= STACK_SCRATCH_LO && addr < STACK_SCRATCH_HI) continue; // dead stack scratch
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/** Run oracle and candidate on independent clones of `entry`; return the first differing byte
 *  outside the stack scratch (or null). An optional harness is installed identically on both. */
function stateDiff(entry, fn, harness) {
  const a = entry.clone();
  const b = entry.clone();
  if (harness) { harness(a); harness(b); }
  oracle(a);
  fn(b);
  return stateDiffOutsideStack(a, b);
}

/**
 * Model the once-per-frame interrupt tick that drives the boundary chain's frame-waits to
 * completion: each watchdog read (a wait does exactly one per pass) decrements the countdown,
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

/** Stub the two true boundary leaves so the never-returning chain terminates AND its destination
 *  (setup vs reset) surfaces as a RAM byte. Identical on both sides. */
function installLeafStubs(c) {
  c.routines.set(SETUP_LEAF, (mm) => mm.mem.write8(MARKER, SETUP_LEAF & 0xff));
  c.routines.set(RESET_LEAF, (mm) => mm.mem.write8(MARKER, RESET_LEAF & 0xff));
}

// The expiry harness: clear the marker, drive the frame-waits, terminate the true boundary leaves.
const boundaryHarness = (m) => { m.mem.write8(MARKER, 0); installFrameTick(m); installLeafStubs(m); };

/**
 * Craft a live-game expiry entry from a real countdown-idle capture with a SURGICAL nudge — force
 * the countdown to expire this frame, set the post-timer mode, and mark a live game in progress
 * (GAME_STATE 2). Only these bytes are touched: the record the handlers read is left exactly as the
 * real capture minted it, so the deep chain (which tallies the score on the bonus screen) runs on a
 * consistent state. With a live game both expiry handlers run their real chain and genuinely diverge
 * — dockManAndDispatchRoundBoundary docks/persists the man count, advanceToNextLevel bumps the level + rebuilds the board.
 */
function craftLiveExpiry(base, postTimerMode) {
  const entry = base.clone();
  entry.mem.write8(TRANSITION_TIMER, 1); // decrements to 0 this frame -> expiry
  entry.mem.write8(POST_TIMER_MODE, postTimerMode);
  entry.mem.write8(GAME_STATE, 2); // a live 1-or-2-player game -> the handlers run their real chain
  return entry;
}

// -- 0. HARNESS (reachability + determinism) ---------------------------------

test("HARNESS: the harness reaches 0x13c9 in attract, the reached arms appear, and oracle-vs-oracle is EQUAL", () => {
  const caps = capture(4000, 3000);
  assert.ok(caps.length >= 1, "expected at least one real 0x13c9 dispatch during attract");

  const seen = new Set(caps.map(armOf));
  for (const arm of ["dispatch", "tick", "expiry->0278"]) {
    assert.ok(seen.has(arm), `expected the ${arm} arm to occur in attract`);
  }

  const entry = caps.find((c) => armOf(c) === "dispatch");
  assert.equal(stateDiff(entry, oracle), null, "oracle vs oracle must be identical");
  console.log(
    `  HARNESS: captured ${caps.length} real dispatches (arms: ${[...seen].join(", ")}); ` +
      `oracle deterministic (SP=${hx(entry.regs.sp)})`,
  );
});

// -- 1. EQUAL over the real dispatch arm (countdown idle) --------------------

test("EQUAL (dispatch): dispatchObjectFrameByStateTimer == oracle over every real countdown-idle dispatch", () => {
  const caps = capture(2000, 3000, (mm) => R(mm, TRANSITION_TIMER) === 0);
  assert.ok(caps.length >= 1, "expected countdown-idle dispatches in attract");

  for (const cap of caps) {
    const d = stateDiff(cap, idiomatic);
    assert.equal(d, null, d && `dispatch diff at ${hx(d.addr ?? 0)} oracle=${d.a} idiomatic=${d.b}`);
  }
  console.log(`  EQUAL/dispatch: ${caps.length} countdown-idle dispatches identical to the oracle`);
});

// -- 2. EQUAL over the tick arm (countdown running) + a crafted start-value sweep --

test("EQUAL (tick): dispatchObjectFrameByStateTimer == oracle over real running-countdown ticks and a crafted 2..255 sweep", () => {
  const caps = capture(1000, 3000, (mm) => R(mm, TRANSITION_TIMER) > 1);
  assert.ok(caps.length >= 1, "expected running-countdown dispatches in attract");

  for (const cap of caps) {
    const start = R(cap, TRANSITION_TIMER);
    const d = stateDiff(cap, idiomatic);
    assert.equal(d, null, d && `tick diff at ${hx(d.addr ?? 0)} oracle=${d.a} idiomatic=${d.b}`);
    const c = cap.clone();
    idiomatic(c);
    assert.equal(R(c, TRANSITION_TIMER), start - 1, `countdown not decremented by one (start ${start})`);
  }

  // Crafted sweep: from a real countdown-idle entry, force every start value 2..255 (so the tick
  // arm holds after decrement) and confirm the decrement + no stray writes.
  const [base] = capture(1, 3000, (mm) => R(mm, TRANSITION_TIMER) === 0);
  assert.ok(base, "need a real entry to craft the tick sweep from");
  for (let start = 2; start <= 255; start++) {
    const entry = base.clone();
    entry.mem.write8(TRANSITION_TIMER, start);
    assert.equal(armOf(entry), "tick", `craft did not reach the tick arm at start ${start}`);
    const d = stateDiff(entry, idiomatic);
    assert.equal(d, null, d && `sweep start ${start}: diff at ${hx(d.addr ?? 0)} oracle=${d.a} idiomatic=${d.b}`);
    const c = entry.clone();
    idiomatic(c);
    assert.equal(R(c, TRANSITION_TIMER), start - 1, `sweep start ${start}: countdown not decremented by one`);
  }
  console.log(`  EQUAL/tick: ${caps.length} real ticks + 254 crafted start values identical; countdown always -1`);
});

// -- 3. EQUAL on the expiry -> dockManAndDispatchRoundBoundary arm (real boundary chain) -------------

test("EQUAL (expiry->dockManAndDispatchRoundBoundary): a crafted mode-0 expiry runs the real boundary chain identically", () => {
  const [base] = capture(1, 3000, (mm) => R(mm, TRANSITION_TIMER) === 0);
  assert.ok(base, "need a real entry to craft the expiry arm from");

  const entry = craftLiveExpiry(base, 0); // mode 0 -> dockManAndDispatchRoundBoundary
  assert.equal(armOf(entry), "expiry->0278", "craft did not reach the expiry->dockManAndDispatchRoundBoundary arm");

  const d = stateDiff(entry, idiomatic, boundaryHarness);
  assert.equal(d, null, d && `expiry->dockManAndDispatchRoundBoundary diff at ${hx(d.addr ?? 0)} oracle=${d.a} idiomatic=${d.b}`);

  // Non-vacuity: the countdown drained to zero and both sides ran the chain to the SAME leaf.
  const o = entry.clone(); boundaryHarness(o); oracle(o);
  const c = entry.clone(); boundaryHarness(c); idiomatic(c);
  assert.equal(R(c, TRANSITION_TIMER), 0, "the countdown should have drained to zero on expiry");
  assert.notEqual(R(c, MARKER), 0, "the boundary chain should have reached a leaf");
  assert.equal(R(c, MARKER), R(o, MARKER), "idiomatic and oracle reached different boundary leaves");
  console.log(`  EQUAL/expiry->dockManAndDispatchRoundBoundary: identical RAM; countdown -> 0, chain reached leaf ${hx(R(c, MARKER) === (SETUP_LEAF & 0xff) ? SETUP_LEAF : RESET_LEAF)}`);
});

// -- 4. EQUAL on the expiry -> advanceToNextLevel arm (real boundary chain) ---

test("EQUAL (expiry->advanceToNextLevel): a crafted mode-nonzero expiry runs the real chain identically", () => {
  const [base] = capture(1, 3000, (mm) => R(mm, TRANSITION_TIMER) === 0);
  assert.ok(base, "need a real entry to craft the expiry arm from");

  const entry = craftLiveExpiry(base, 1); // nonzero -> advanceToNextLevel
  assert.equal(armOf(entry), "expiry->02fd", "craft did not reach the expiry->advanceToNextLevel arm");

  const d = stateDiff(entry, idiomatic, boundaryHarness);
  assert.equal(d, null, d && `expiry->advanceToNextLevel diff at ${hx(d.addr ?? 0)} oracle=${d.a} idiomatic=${d.b}`);

  const o = entry.clone(); boundaryHarness(o); oracle(o);
  const c = entry.clone(); boundaryHarness(c); idiomatic(c);
  assert.equal(R(c, TRANSITION_TIMER), 0, "the countdown should have drained to zero on expiry");
  assert.notEqual(R(c, MARKER), 0, "the boundary chain should have reached a leaf");
  assert.equal(R(c, MARKER), R(o, MARKER), "idiomatic and oracle reached different boundary leaves");
  console.log(`  EQUAL/expiry->advanceToNextLevel: identical RAM; countdown -> 0, chain reached leaf ${hx(R(c, MARKER) === (SETUP_LEAF & 0xff) ? SETUP_LEAF : RESET_LEAF)}`);
});

// -- 5. TEETH: a twin that skips the countdown decrement ---------------------

/** Broken twin: the real gate, but it never writes the decremented countdown back. On a tick entry
 *  the oracle leaves count-1 and the twin leaves count, so the countdown byte is the divergence. */
function twinSkipDecrement(m) {
  const { mem8 } = m;
  if (mem8[TRANSITION_TIMER] === 0) return advanceTrackedObject(m);
  const remaining = mem8[TRANSITION_TIMER] - 1;
  // BUG: the decremented countdown is never stored back.
  if (remaining !== 0) return;
  if (mem8[POST_TIMER_MODE] === 0) return loc_0278Ref(m);
  return advanceToNextLevel(m);
}

test("TEETH (skip the decrement): a twin that never decrements the countdown is CAUGHT", () => {
  const [entry] = capture(1, 3000, (mm) => R(mm, TRANSITION_TIMER) > 1);
  assert.ok(entry, "need a running-countdown entry to seed the teeth check");
  const start = R(entry, TRANSITION_TIMER);

  const d = stateDiff(entry, twinSkipDecrement);
  assert.notEqual(d, null, "the gate FAILED to catch the skipped-decrement twin — it proves nothing");
  assert.equal(d.addr, TRANSITION_TIMER, `teeth caught the wrong address ${hx(d.addr)} (expected ${hx(TRANSITION_TIMER)})`);
  assert.equal(stateDiff(entry, idiomatic), null, "idiomatic must pass the entry the twin fails");
  console.log(`  TEETH/decrement: skipped-decrement twin caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b}, start=${start})`);
});

// -- 6. TEETH: a twin that drops the object dispatch -------------------------

/** Broken twin: on the countdown-idle arm it returns instead of advancing the object, so every
 *  write the real dispatch would make is missing. */
function twinDropDispatch(m) {
  const { mem8 } = m;
  if (mem8[TRANSITION_TIMER] === 0) return; // BUG: dropped advanceTrackedObject
  const remaining = mem8[TRANSITION_TIMER] - 1;
  mem8[TRANSITION_TIMER] = remaining;
  if (remaining !== 0) return;
  if (mem8[POST_TIMER_MODE] === 0) return loc_0278Ref(m);
  return advanceToNextLevel(m);
}

/** Broken twin: swaps the two expiry destinations — mode 0 advances the level, mode nonzero runs
 *  the round/state-boundary dispatcher. On a live-game entry the two handlers write different RAM,
 *  so a swap is observable. */
function twinSwapExpiry(m) {
  const { mem8 } = m;
  if (mem8[TRANSITION_TIMER] === 0) return advanceTrackedObject(m);
  const remaining = mem8[TRANSITION_TIMER] - 1;
  mem8[TRANSITION_TIMER] = remaining;
  if (remaining !== 0) return;
  if (mem8[POST_TIMER_MODE] === 0) return advanceToNextLevel(m); // BUG: mode 0 should run dockManAndDispatchRoundBoundary
  return loc_0278Ref(m); // BUG: mode nonzero should advance the level
}

test("TEETH (drop the dispatch): returning instead of advancing the object is CAUGHT", () => {
  // Find a countdown-idle entry whose dispatch actually writes RAM (many attract frames just
  // return with no live object; those cannot expose a dropped dispatch).
  const caps = capture(2000, 3000, (mm) => R(mm, TRANSITION_TIMER) === 0);
  let entry = null;
  for (const cap of caps) {
    const o = cap.clone(); oracle(o);
    if (stateDiffOutsideStack(cap, o) !== null) { entry = cap; break; } // the dispatch wrote something
  }
  assert.ok(entry, "expected a countdown-idle dispatch that writes RAM to seed the teeth check");

  const d = stateDiff(entry, twinDropDispatch);
  assert.notEqual(d, null, "the gate FAILED to catch the dropped-dispatch twin — it proves nothing");
  assert.equal(stateDiff(entry, idiomatic), null, "idiomatic must pass the entry the twin fails");
  console.log(`  TEETH/dispatch: dropped-dispatch twin caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

// -- 7. TEETH: a twin that swaps the two expiry destinations -----------------

test("TEETH (swap expiry routing): sending mode-nonzero to dockManAndDispatchRoundBoundary instead of advanceToNextLevel is CAUGHT", () => {
  const [base] = capture(1, 3000, (mm) => R(mm, TRANSITION_TIMER) === 0);
  assert.ok(base, "need a real entry to craft the expiry arm from");
  const entry = craftLiveExpiry(base, 1); // mode nonzero -> should advance the level

  const d = stateDiff(entry, twinSwapExpiry, boundaryHarness);
  assert.notEqual(d, null, "the gate FAILED to catch the swapped-routing twin — it proves nothing");
  assert.equal(stateDiff(entry, idiomatic, boundaryHarness), null, "idiomatic must pass the entry the twin fails");
  console.log(`  TEETH/routing: swapped-expiry twin caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});
