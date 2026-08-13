// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for startGame (ROM 0x022d) — the credit-registered
 * start-of-game setup that seeds a fresh game and falls into the main round loop.
 *
 * WHY A CRAFTED ENTRY. A credit is never banked in a plain no-coin attract run, so
 * 0x022d is never dispatched — the capture/replay harness cannot hook it directly. Per
 * the crafted-entry method the gate instead runs the routine from a REAL captured
 * attract state: the sound-request stub 0x4c57 IS reached during attract, and its entry
 * is a faithful, self-consistent machine state (valid stack, coherent work/colour/video
 * RAM). Because 0x4c57 is never in startGame's own call subtree, cloning that entry
 * introduces no registry recursion into the routine under test.
 *
 * WHY THE FULL CHAIN NOW RUNS. startGame falls into the round loop at 0x0278, which is
 * idiomatic now, so startGame calls it DIRECTLY — a registry stub at 0x0278 would no
 * longer intercept. So both sides run the REAL round-boundary chain: the idiomatic side
 * via its direct imports (startGame -> dockManAndDispatchRoundBoundary -> stepRoundSubPhaseAndBranch / setUpRoundAndHoldIntro / ...), the oracle
 * side via m.call through the frozen registry. Both chains converge at the TRUE oracle
 * leaves — 0x031a (round-loop setup) and 0x01f9 (reset/entry handler) — neither of which
 * has an idiomatic form yet and both of which never return on hardware. For this captured
 * attract state (player/mode byte 0) the chain reaches the setup leaf 0x031a.
 *
 * HARNESS PIECES both sides share, so neither can fork the result:
 *   - STUBBED LEAVES. 0x031a and 0x01f9 are stubbed identically on both sides with a spy
 *     that stamps a sentinel into a dead work-RAM marker and returns, so the never-returning
 *     chain terminates and the reached leaf is observable. Stubbed per-run, NOT at capture:
 *     0x01f9 is the boot reset handler and stubbing it during the capture would break boot.
 *   - FRAME-TICK. The chain busy-waits on the per-frame countdown 0x8009 the interrupt
 *     drains once a frame (the round-start intro hold). Run in isolation no interrupt fires,
 *     so one identical hook on both clones models the tick.
 *   - THE STACK SCRATCH. The oracle wraps its calls in stack pushes and the round-boundary
 *     chain may reset SP to the stack top (0x83ff); the stack-free idiomatic calls do not.
 *     The two therefore leave DIFFERENT dead bytes in the top-of-work-RAM stack window. No
 *     real cell lives in [0x83e0, 0x8400) (every named cell this routine and its callees
 *     write lands at 0x8057 or below in work RAM, or in colour RAM 0x8800+), so the RAM diff
 *     EXCLUDES that window and compares everything else byte-for-byte. Fail-safe: a real byte
 *     landing there would surface, not pass silently.
 *
 * Value registers, flags, pc and SP are excluded (the idiomatic layer preserves none of
 * the Z80 register/pc/stack trace) — the diff is RAM-only, per the memory-equivalence
 * contract.
 *
 * Checks:
 *   0. HARNESS — capture a real 0x4c57 entry and confirm the oracle run of the whole chain
 *      is deterministic (oracle vs oracle -> identical RAM).
 *   1. EQUAL — startGame == oracle over RAM outside the stack scratch; both sides reach the
 *      same leaf; startGame's surviving headline seeds hold (round-variant cleared, starting
 *      level 1). (Men-left and the player selector are reloaded by the round-boundary chain
 *      from the freshly-primed player record, so they are not asserted here — the equivalence
 *      diff still covers them, and the teeth prove the diff sees those cells.)
 *   2. TEETH (wrong level) — a twin whose starting level is corrupted is CAUGHT at LEVEL.
 *   3. TEETH (wrong men-left) — a twin whose men-left count is corrupted is CAUGHT at 0x802b.
 *      Both prove the diff sees the routine's real output cells, i.e. the stack exclusion did
 *      not swallow them.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-022d.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_022d as oracle } from "../../translated/loc_022d.js";
import { startGame as idiomatic } from "../startGame.js";
import { loc_4c57 as siblingStub } from "../../translated/loc_4c57.js";
import { makeMachineFactory } from "../../machine.js";
import { LEVEL, VARIANT } from "../names.js";

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

const CAPTURE_AT = 0x4c57; // sound-request stub reached in attract; outside startGame's subtree
const SETUP_LEAF = 0x031a; // round-loop setup leaf (never returns)
const RESET_LEAF = 0x01f9; // reset/entry handler leaf (never returns)
const MARK_SETUP = SETUP_LEAF & 0xff; // 0x1a
const MARK_RESET = RESET_LEAF & 0xff; // 0xf9
const MARKER = 0x8700; // dead work-RAM byte the leaf stubs stamp with the reached leaf's low byte
const MEN_LEFT = 0x802b; // live men-left / lives counter (no names.js name yet)
const WATCHDOG = 0xb800; // reading it kicks the watchdog (once per frame-wait pass)
const COUNTDOWN = 0x8009; // the per-frame countdown the frame-waits drain to 0
// Top-of-work-RAM Z80 stack scratch the oracle leaves (and the round-boundary chain's SP
// reset reaches) and the stack-free idiomatic JS does not; nothing real lives here.
const STACK_FLOOR = 0x83e0;
const STACK_TOP = 0x8400;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is async,
// so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/**
 * Hook the sound stub 0x4c57 in a real attract run and clone the machine at its first
 * dispatch — a genuine, self-consistent attract state. Boot proceeds undisturbed (no leaf
 * stubs installed here — 0x01f9 is the boot reset handler).
 */
function captureRealEntry(maxFrames) {
  let entry = null;
  const overrides = new Map([
    [CAPTURE_AT, (mm) => { if (entry === null) entry = mm.clone(); return siblingStub(mm); }],
  ]);
  makeMachine(overrides).runFrames(maxFrames);
  return entry;
}

/**
 * Model the once-per-frame interrupt tick that drives the round-boundary chain's frame-waits
 * to completion: each watchdog read decrements the countdown, floored at 0. Installed
 * identically on both clones, so it can only expose a difference, never create one.
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

/** Stub the two true leaves so the never-returning chain terminates AND the reached leaf is
 *  observable. Identical on both sides. */
function installLeafStubs(m) {
  m.routines.set(SETUP_LEAF, (mm) => mm.mem.write8(MARKER, MARK_SETUP));
  m.routines.set(RESET_LEAF, (mm) => mm.mem.write8(MARKER, MARK_RESET));
}

/** Clone the captured entry, clear the marker, install the frame-tick + leaf stubs, run `fn`. */
function runStart(entry, fn) {
  const c = entry.clone();
  c.mem.write8(MARKER, 0);
  installFrameTick(c);
  installLeafStubs(c);
  fn(c);
  return c;
}

/**
 * First differing RAM byte between two machines, EXCLUDING the dead top-of-work-RAM Z80
 * stack scratch. Null when otherwise identical.
 */
function ramDiffOutsideStack(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= STACK_FLOOR && addr <= STACK_TOP) continue; // dead Z80 stack scratch
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

// -- 0. HARNESS (reachability + determinism) ---------------------------------

test("HARNESS: a real 0x4c57 entry is captured and the oracle chain run of 0x022d is deterministic", () => {
  const entry = captureRealEntry(1500);
  assert.ok(entry, "expected the sound stub 0x4c57 to be dispatched during attract");

  const a = runStart(entry, oracle);
  const b = runStart(entry, oracle);
  const d = ramDiffOutsideStack(a, b);
  assert.equal(d, null, d && `oracle run not deterministic: diff at ${hx(d.addr ?? 0)}`);
  assert.equal(a.mem.read8(MARKER), MARK_SETUP, "this attract state should drive the chain to the setup leaf");
  console.log(`  HARNESS: captured a real 0x4c57 entry (SP=${hx(entry.regs.sp)}); oracle chain of 0x022d deterministic, reaches ${hx(SETUP_LEAF)}`);
});

// -- 1. EQUAL on the real captured entry -------------------------------------

test("EQUAL (real entry): startGame == oracle over RAM outside the stack scratch", () => {
  const entry = captureRealEntry(1500);
  assert.ok(entry, "need a captured 0x4c57 entry");

  const o = runStart(entry, oracle);
  const c = runStart(entry, idiomatic);

  const diff = ramDiffOutsideStack(o, c);
  assert.equal(
    diff,
    null,
    diff && `RAM diff at ${hx(diff.addr)} oracle=${diff.a} cand=${diff.b}`,
  );

  // Both sides ran the whole chain to the same leaf.
  assert.equal(c.mem.read8(MARKER), o.mem.read8(MARKER), "startGame and oracle reached different leaves");
  assert.equal(c.mem.read8(MARKER), MARK_SETUP, "the chain did not reach the setup leaf");

  // Surviving headline seeds: startGame's fresh-game state that the round-boundary chain
  // does not overwrite. (Men-left and the player selector ARE reloaded by the chain from the
  // freshly-primed player record, so they are covered by the equivalence diff, not asserted.)
  const { mem8 } = c;
  assert.equal(mem8[VARIANT], 0, "round-variant selector not cleared");
  assert.equal(mem8[LEVEL], 1, "starting level not set to 1");
  console.log(
    `  EQUAL/real: identical over RAM (minus stack scratch); variant=0, level=1, chain reached ${hx(SETUP_LEAF)}`,
  );
});

// -- 2. TEETH: a wrong starting level is caught ------------------------------

/** Broken twin: the real routine (full chain), then the starting level corrupted. */
function twinWrongLevel(m) {
  oracle(m);
  const { mem8 } = m;
  mem8[LEVEL] = mem8[LEVEL] ^ 0xff; // BUG: starting level no longer 1
}

test("TEETH (wrong level): a corrupted starting level is CAUGHT at LEVEL", () => {
  const entry = captureRealEntry(1500);
  assert.ok(entry, "need a captured 0x4c57 entry to seed the teeth check");

  const o = runStart(entry, oracle);
  const t = runStart(entry, twinWrongLevel);

  const diff = ramDiffOutsideStack(o, t);
  assert.ok(diff, "the gate FAILED to catch the wrong-level twin — it proves nothing");
  assert.equal(diff.addr, LEVEL, `teeth caught the wrong address ${hx(diff.addr)} (expected ${hx(LEVEL)})`);
  console.log(`  TEETH/level: wrong-level twin caught at ${hx(diff.addr)} (oracle=${diff.a} broken=${diff.b})`);
});

// -- 3. TEETH: a wrong men-left count is caught ------------------------------

/** Broken twin: the real routine (full chain), then the men-left count corrupted. */
function twinWrongMenLeft(m) {
  oracle(m);
  const { mem8 } = m;
  mem8[MEN_LEFT] = mem8[MEN_LEFT] ^ 0xff; // BUG: men-left count wrong
}

test("TEETH (wrong men-left): a corrupted men-left count is CAUGHT at 0x802b", () => {
  const entry = captureRealEntry(1500);
  assert.ok(entry, "need a captured 0x4c57 entry to seed the teeth check");

  const o = runStart(entry, oracle);
  const t = runStart(entry, twinWrongMenLeft);

  const diff = ramDiffOutsideStack(o, t);
  assert.ok(diff, "the gate FAILED to catch the wrong-men-left twin — it proves nothing");
  assert.equal(diff.addr, MEN_LEFT, `teeth caught the wrong address ${hx(diff.addr)} (expected ${hx(MEN_LEFT)})`);
  console.log(`  TEETH/menLeft: wrong-men-left twin caught at ${hx(diff.addr)} (oracle=${diff.a} broken=${diff.b})`);
});
