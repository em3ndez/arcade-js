// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for showCreditScreen (ROM 0x021c) — the warm-restart state entry:
 * arm game mode 3, reset the work stack, enable the frame interrupt, run the
 * blank-screen display setup, then tail-hand to the fixed-screen painter (0x3ba8),
 * which paints a canned screen and spins forever displaying it.
 *
 * WHY A CRAFTED ENTRY (not the stock unitEquivalence capture). showCreditScreen is reached
 * only from the boot fork rearmMachineAndBranchOnCredits when the restart flag (0x8000) is nonzero, which a
 * plain boot/attract run never is — 0 dispatches in 1500 frames. So there is no real
 * dispatch of showCreditScreen to snapshot. Per the crafted-entry method this gate instead
 * captures a real attract machine state (realistic full RAM, the oracle registry, a
 * live stack) by hooking a routine attract DOES reach (loc_3dae, entered within the
 * first ~100 frames) and cloning the machine the first time it fires, then runs oracle
 * vs idiomatic on independent clones of that state. showCreditScreen takes no register inputs,
 * so one real captured state exercises its whole straight-line path.
 *
 * WHY 0x3ba8 RUNS FOR REAL, BOUNDED. showCreditScreen's exit is a tail hand-off to the
 * fixed-screen painter 0x3ba8, now the idiomatic holdFixedScreen — a DIRECT call, no longer
 * an oracle boundary. Its display loop never returns (it spins forever on hardware, escaped
 * only by the watchdog), so running either arm to completion would hang. Rather than stub it
 * (the idiomatic direct call can no longer be intercepted by a registry stub), the gate runs
 * the REAL painter on BOTH arms under one SHARED bounding hook — the very harness
 * holdFixedScreen's own gate (equivalence-3ba8) uses: each watchdog read (the painter's
 * frame-waits do exactly one per pass) drains the per-frame countdown so the busy-waits
 * terminate, and after a fixed number of reads (THROW_AT) it throws to unwind the never-
 * returning loop at the identical point on both sides. THROW_AT = 20 = the painter's setup
 * frame-wait (1) + one full display pass's 15-frame wait (15) + partway into the next (4),
 * so the compared state covers the whole paint plus one complete display pass. blankScreen
 * (this routine's only other callee) reads the watchdog nowhere, so the count is the
 * painter's alone. Being the same hook on both arms it can only reveal a difference.
 *
 * THE CONTRACT is OBSERVABLE-RAM equivalence: the work/colour/video/attr+sprite RAM
 * the routine leaves. pc, SP, and the value registers/flags are EXCLUDED — the
 * idiomatic layer does not preserve the Z80 pc/register trace, and this routine has no
 * genuine register live-out (it exits into a forever loop; the caller's frame was
 * discarded by the stack reset, so nothing reads a register back). ONE WRINKLE: the
 * oracle threads its callee returns (enableNmi 0x4b14, and the painter's own nested setup
 * calls) through the work stack, while the idiomatic arm calls its already-decompiled
 * leaves directly, so the two park DIFFERENT dead return-address ghosts in the handful of
 * bytes straddling the SP reset (measured span 0x83fb..0x8400). Those are dead top-of-stack
 * scratch — the routine hard-resets SP to 0x83ff and nothing reads them back, and no game-
 * observable cell lives there (all the painter's real output sits far below, at
 * 0x8800..0x8bff colour RAM and 0x9000..0x93ff video RAM) — so the RAM diff EXCLUDES that
 * window and compares every real cell byte-for-byte. The teeth confirm the window hides no
 * real output.
 *
 * Three checks, the gate's two directions:
 *   1. EQUAL (real captured entry) — idiomatic leaves RAM byte-identical to the oracle
 *      through the full paint + one display pass, and the observable effects hold: game
 *      mode armed to 3, the frame interrupt enabled, the canned image + flooded colour laid.
 *   2. TEETH (wrong game mode) — a twin that arms mode 2 instead of 3 is CAUGHT at the
 *      game-mode cell.
 *   3. TEETH (dropped stack reset) — a twin that skips the stack reset lands the callee
 *      return addresses at the wrong place and is CAUGHT in the stack RAM, proving the
 *      reset is load-bearing.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-021c.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_021c as oracle } from "../../translated/loc_021c.js";
import { showCreditScreen as idiomatic } from "../showCreditScreen.js";
import { loc_3dae as reachableOracle } from "../../translated/loc_3dae.js";
import { makeMachineFactory } from "../../machine.js";
import { GAME_STATE } from "../names.js";

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

const WATCHDOG = 0xb800; // reading it kicks the watchdog (once per painter frame-wait pass)
const COUNTDOWN = 0x8009; // the per-frame countdown the painter's frame-waits drain to 0
// 20 watchdog reads = the painter's setup wait (1) + one full display pass's wait (15) + into
// the next pass's wait (4); blankScreen reads the watchdog nowhere, so this is the painter's count.
const THROW_AT = 20;
const STACK_RESET = 0x83ff; // showCreditScreen hard-resets SP here (`ld sp,0x83ff`)
// Dead return-slot ghosts straddling the SP reset the two call styles differ in (measured
// span 0x83fb..0x8400): the oracle threads enableNmi + the painter's nested setup calls
// through the stack; the dissolved idiomatic calls do not. Excluded.
const STACK_SCRATCH_LO = 0x83fb;
const STACK_SCRATCH_HI = 0x8400;
const COLOR_CELL = 0x8800; // first colour-RAM cell the painter's flat-colour flood writes
const VIDEO_LAST = 0x93ff; // last tilemap cell the painter's image copy writes
const IMAGE_SOURCE = 0x4232; // ROM address of the canned full-screen image the copy reads
const BACKGROUND = 2; // the flat background colour the painter floods
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// A unique token thrown to bound the painter's never-returning display loop.
const BOUND = Symbol("showCreditScreen-bound");

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture one real attract machine state to seed crafted entries. showCreditScreen itself is
 * never dispatched in attract, so hook a routine that IS (loc_3dae, entered within the
 * first ~100 frames) and clone the machine the first time it fires — that gives
 * realistic full RAM, the oracle registry, and a live stack. The never-returning painter
 * 0x3ba8 is not stubbed: it is never dispatched in attract, and both comparison arms run it
 * for real under the shared bounding hook.
 */
function captureSeed() {
  let seed = null;
  const snapshot = new Map([
    [0x3dae, (mm) => {
      if (seed === null) seed = mm.clone();
      return reachableOracle(mm);
    }],
  ]);
  makeMachine(snapshot).runFrames(240);
  assert.ok(seed !== null, "expected loc_3dae to be dispatched during attract to seed crafted entries");
  return seed;
}

/**
 * Install the once-per-frame countdown tick AND the run bound on a clone, both keyed on the
 * watchdog read the painter's frame-waits do exactly once per pass. Every read drains the
 * countdown (floored at 0) so the busy-waits terminate; on the THROW_AT-th read it throws to
 * unwind the never-returning display loop. The same hook on both arms can only reveal a
 * difference, never manufacture one.
 */
function installBoundedFrameTick(m) {
  const mem = m.mem;
  const origRead8 = mem.read8.bind(mem);
  let reads = 0;
  mem.read8 = (addr) => {
    if (addr === WATCHDOG) {
      reads += 1;
      if (reads >= THROW_AT) throw BOUND;
      const c = origRead8(COUNTDOWN);
      if (c !== 0) mem.write8(COUNTDOWN, c - 1);
    }
    return origRead8(addr);
  };
}

/**
 * Run `fn` on a fresh clone of `seed` with the frame-tick/bound harness. Returns the bounded
 * machine; asserts the run actually hit the bound rather than returning or hanging.
 */
function runBounded(seed, fn) {
  const m = seed.clone();
  installBoundedFrameTick(m);
  let bounded = false;
  try {
    fn(m);
  } catch (e) {
    if (e !== BOUND) throw e;
    bounded = true;
  }
  assert.ok(bounded, "run did not reach the display loop's bound — the harness never engaged");
  return m;
}

/**
 * First differing state byte between two machines, EXCLUDING the dead top-of-stack
 * scratch straddling the SP reset (the window 0x83fb..0x8400). The oracle threads its
 * callee returns through the stack (push + m.call), parking return-address ghosts there;
 * the dissolved idiomatic direct calls do not, so those bytes legitimately differ. They
 * are dead scratch — SP was reset to 0x83ff, nothing reads them back, and no game-
 * observable cell lives in the window — so every real cell is compared byte-for-byte.
 * Null when otherwise identical.
 */
function stateDiffOutsideStack(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= STACK_SCRATCH_LO && addr <= STACK_SCRATCH_HI) continue; // dead top-of-stack scratch
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/**
 * Run oracle and candidate on two independent clones of one entry — the real painter bounded
 * on both — and diff the observable-RAM contract, EXCLUDING the dead top-of-stack scratch.
 * pc/SP/value registers are the routine's dead-ABI residual and are not compared.
 * Returns { diffs, ram } (diffs empty == EQUAL).
 */
function contractDiffs(entry, fn) {
  const a = runBounded(entry, oracle);
  const b = runBounded(entry, fn);

  const diffs = [];
  const ram = stateDiffOutsideStack(a, b);
  if (ram) diffs.push(`RAM@${hx(ram.addr ?? 0)} oracle=${ram.a} cand=${ram.b}`);
  return { diffs, ram };
}

// -- 1. EQUAL on a real captured attract entry --------------------------------

test("EQUAL (real entry): showCreditScreen == oracle over observable RAM", () => {
  const seed = captureSeed();

  const { diffs } = contractDiffs(seed, idiomatic);
  assert.equal(diffs.length, 0, diffs.join("; "));

  // Positive checks: the observable effects really happened (through the bounded painter).
  const c = runBounded(seed, idiomatic);
  assert.equal(c.mem.read8(GAME_STATE), 3, "game mode not armed to 3");
  assert.equal(c.io.nmiMask, true, "frame interrupt not enabled");
  assert.equal(c.mem.read8(COLOR_CELL), BACKGROUND, "the painter's background flood did not land");
  assert.equal(
    c.mem.read8(VIDEO_LAST),
    c.mem.read8(IMAGE_SOURCE + (VIDEO_LAST - 0x9000)),
    "the painter's canned image copy did not land",
  );
  console.log(`  EQUAL/real: idiomatic matches oracle over full RAM; GAME_STATE=3, frame interrupt enabled, screen painted`);
});

// -- 2. TEETH: a wrong game-mode twin is caught -------------------------------

/** Broken twin: arms game mode 2 instead of 3; everything else identical (real painter runs). */
function twinWrongMode(m) {
  const { mem8, regs } = m;
  mem8[GAME_STATE] = 2; // BUG: wrong game mode
  regs.sp = 0x83ff;
  m.push16(0x0227);
  m.call(0x4b14);
  m.push16(0x022a);
  m.call(0x4b44);
  return m.call(0x3ba8);
}

test("TEETH (wrong game mode): arming mode 2 instead of 3 is CAUGHT at the game-mode cell", () => {
  const seed = captureSeed();

  const { diffs, ram } = contractDiffs(seed, twinWrongMode);
  assert.ok(diffs.length > 0, "the gate FAILED to catch the wrong-game-mode twin — it proves nothing");
  assert.equal(
    ram && ram.addr,
    GAME_STATE,
    `teeth caught the wrong address ${ram ? hx(ram.addr) : "(none)"} (expected ${hx(GAME_STATE)})`,
  );
  console.log(`  TEETH/mode: wrong-mode twin caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

// -- 3. TEETH: a dropped-stack-reset twin is caught ---------------------------

/** Broken twin: skips the stack reset, so the callee return addresses land at the
 *  captured stack top instead of 0x83ff — the reset is load-bearing. */
function twinNoStackReset(m) {
  const { mem8 } = m;
  mem8[GAME_STATE] = 3;
  // BUG: no `regs.sp = 0x83ff` — pushes land wherever the captured SP happens to be.
  m.push16(0x0227);
  m.call(0x4b14);
  m.push16(0x022a);
  m.call(0x4b44);
  return m.call(0x3ba8);
}

test("TEETH (dropped stack reset): skipping the stack reset is CAUGHT in the stack RAM", () => {
  const seed = captureSeed();

  const { diffs, ram } = contractDiffs(seed, twinNoStackReset);
  assert.ok(diffs.length > 0, "the gate FAILED to catch the dropped-stack-reset twin — it proves nothing");
  // The captured SP is below 0x83ff, so the mis-placed pushes diff inside work RAM's stack region.
  assert.ok(ram.addr >= 0x8000 && ram.addr <= 0x87ff, `expected a work-RAM diff, got ${hx(ram.addr)}`);
  console.log(`  TEETH/stack: dropped-reset twin caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});
