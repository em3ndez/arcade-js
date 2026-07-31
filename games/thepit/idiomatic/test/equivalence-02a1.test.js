// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for stepRoundSubPhaseAndBranch (ROM 0x02a1) — the round sub-phase sequencer: it
 * toggles ACTIVE_PLAYER between 1 and 2 and, on two continuation-select flags (0x802c /
 * 0x802d), hands off to either the round-setup continuation (setUpRoundAndHoldIntro) or the end-of-round
 * teardown continuation (submitHighScoresAndReset / ROM 0x0371).
 *
 * CRAFTED-ENTRY, because attract never dispatches stepRoundSubPhaseAndBranch (it sits on the round-transition
 * path reached only once a game is under way — a 6000-frame attract run hits it zero times).
 * So instead of hooking the target, we capture REAL machine states at a routine attract DOES
 * dispatch — loc_3dae, the shared row/col -> offset calc (first entered ~frame 81) — clone
 * at its entry, and run oracle-vs-idiomatic stepRoundSubPhaseAndBranch on those real, in-distribution states
 * after poking the three inputs stepRoundSubPhaseAndBranch actually reads (the sub-phase byte and the two
 * flags). The capture just supplies a realistic RAM image; the pokes drive every branch.
 *
 * WHY THE FULL CONTINUATION CHAIN NOW RUNS. stepRoundSubPhaseAndBranch's two continuations are idiomatic now
 * (setUpRoundAndHoldIntro setup / submitHighScoresAndReset teardown), so idiomatic stepRoundSubPhaseAndBranch calls them
 * DIRECTLY — a registry stub at 0x02ca / 0x0371 would no longer intercept. So both sides run
 * the REAL continuation chain: the idiomatic side via its direct imports, the oracle side via
 * m.call through the frozen registry. Both chains converge at the two TRUE oracle leaves —
 * 0x031a (round-loop setup, reached by the setup continuation) and 0x01f9 (reset/entry
 * handler, reached by the teardown continuation) — neither of which returns on hardware.
 *
 * HARNESS PIECES both sides share, so neither can fork the result:
 *   - STUBBED LEAVES. 0x031a and 0x01f9 are stubbed identically on both sides with a spy that
 *     stamps a sentinel (0x1a setup / 0xf9 teardown) into an unused work-RAM cell (BRANCH_MARKER)
 *     and returns. That terminates the otherwise-endless chain AND surfaces which continuation
 *     stepRoundSubPhaseAndBranch chose — its real live-out alongside the sub-phase write — as a RAM difference.
 *     The leaves are stubbed per-run (NOT at capture), because 0x01f9 is the boot reset handler
 *     and stubbing it during the capture run would break boot.
 *   - FRAME-TICK. The continuations busy-wait on the per-frame countdown 0x8009 the interrupt
 *     drains once a frame (the round-start intro / the game-over hold). Run in isolation no
 *     interrupt fires, so one identical hook on both clones models the tick.
 *   - EXCLUDED STACK SCRATCH. The oracle brackets every callee with a stack push; the stack-free
 *     idiomatic calls do not, and the teardown continuation resets SP to 0x83ff. The two leave
 *     different dead bytes in the top-of-stack scratch. No real cell lives there (measured
 *     0x83f1..0x83fe across all captured entries), so the RAM diff EXCLUDES that window.
 *
 * OBSERVABLE-EQUIVALENCE CONTRACT: RAM-only, over the full dumpState minus the stack scratch.
 * pc + the dead value registers/flags are excluded (the idiomatic layer preserves no Z80
 * register trace).
 *
 * Jobs:
 *   1. HARNESS — capture a real loc_3dae entry; a stubbed oracle chain run is deterministic, and
 *      a teardown-arm poke really reaches the teardown leaf (proves the marker mechanism).
 *   2. EQUAL   — sweep the sub-phase byte x both flags across every branch; idiomatic and oracle
 *      leave identical RAM (sub-phase byte + whole continuation chain) on every combo, and both
 *      continuations are exercised.
 *   3. TEETH   — a twin that writes the wrong sub-phase value is CAUGHT at ACTIVE_PLAYER, and a twin
 *      that hands off to the wrong continuation is CAUGHT at the destination leaf.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-02a1.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_02a1 as oracle } from "../../translated/loc_02a1.js";
import { stepRoundSubPhaseAndBranch as idiomatic } from "../stepRoundSubPhaseAndBranch.js";
import { loc_3dae as proxyOracle } from "../../translated/loc_3dae.js";
// The idiomatic continuations the broken twins hand off to directly (mirroring stepRoundSubPhaseAndBranch).
import { setUpRoundAndHoldIntro } from "../setUpRoundAndHoldIntro.js";
import { submitHighScoresAndReset } from "../submitHighScoresAndReset.js";
import { makeMachineFactory } from "../../machine.js";
import { ACTIVE_PLAYER } from "../ram.js";

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

const PROXY = 0x3dae; // a shared callee attract dispatches; its entry states are real
const SETUP_LEAF = 0x031a; // round-loop setup, reached by the setup continuation (setUpRoundAndHoldIntro)
const RESET_LEAF = 0x01f9; // reset/entry handler, reached by the teardown continuation (0x0371)
const FLAG_C = 0x802c; // first continuation-select flag
const FLAG_D = 0x802d; // second continuation-select flag
const WATCHDOG = 0xb800; // reading it kicks the watchdog (once per frame-wait pass)
const COUNTDOWN = 0x8009; // the per-frame countdown the frame-waits drain to 0

// An unused work-RAM cell (0x8000-0x87ff) the leaf stubs stamp so the continuation choice is
// observable: above the stack, written by nothing in stepRoundSubPhaseAndBranch or its continuation chain (the
// stub stamps it LAST, so any earlier write is overwritten identically on both sides).
const BRANCH_MARKER = 0x8700;
const MARK_SETUP = SETUP_LEAF & 0xff; // 0x1a: the setup continuation reached the setup leaf
const MARK_TEARDOWN = RESET_LEAF & 0xff; // 0xf9: the teardown continuation reached the reset leaf

// Dead top-of-stack scratch just below the stack pointer (and below the teardown leaf's SP
// reset to 0x83ff): the oracle's per-call pushes and the idiomatic direct calls legitimately
// differ here. Measured 0x83f1..0x83fe across every captured entry; the window has margin and
// no real cell lives in it (every named work cell sits at/below 0x823f).
const STACK_SCRATCH_LO = 0x83e0;
const STACK_SCRATCH_HI = 0x8400;

const hx = (v) => "0x" + (v & 0xffff).toString(16);

const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Model the once-per-frame interrupt tick that drives the continuation chain's frame-waits to
 * completion: each watchdog read decrements the countdown, floored at 0. Installed identically
 * on both clones, so it can only expose a difference, never create one.
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

/** Stub the two true leaves so the never-returning continuation chain terminates AND its
 *  destination (setup vs teardown) is surfaced as a RAM byte. Identical on both sides.
 *  Installed per-run, NOT at capture: 0x01f9 is the boot reset handler and stubbing it during
 *  the capture run would break boot. */
function installLeafStubs(m) {
  m.routines.set(SETUP_LEAF, (mm) => mm.mem.write8(BRANCH_MARKER, MARK_SETUP));
  m.routines.set(RESET_LEAF, (mm) => mm.mem.write8(BRANCH_MARKER, MARK_TEARDOWN));
}

/**
 * Capture up to K real machine states at PROXY's dispatch during a boot/attract run. The
 * capture proceeds through boot undisturbed (no leaf stubs installed here — attract never
 * reaches stepRoundSubPhaseAndBranch's arms anyway).
 */
function captureEntries(K, maxFrames) {
  const caps = [];
  const snap = new Map([
    [PROXY, (mm) => { if (caps.length < K) caps.push(mm.clone()); return proxyOracle(mm); }],
  ]);
  makeMachine(snap).runFrames(maxFrames);
  return caps;
}

const ENTRIES = ROM_PRESENT ? captureEntries(4, 300) : [];

/** A real captured entry with the three inputs poked and the branch marker cleared. */
function pokedEntry(entry, subPhase, flagC, flagD) {
  const m = entry.clone();
  m.mem.write8(ACTIVE_PLAYER, subPhase);
  m.mem.write8(FLAG_C, flagC);
  m.mem.write8(FLAG_D, flagD);
  m.mem.write8(BRANCH_MARKER, 0);
  return m;
}

/** First differing RAM byte between two machines over dumpState, EXCLUDING the dead top-of-
 *  stack scratch window; null if identical. */
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

/** Run oracle and `fn` on identical clones of one poked entry — frame-tick + leaf stubs on
 *  both — and return their RAM diff. */
function armDiff(entry, fn, subPhase, flagC, flagD) {
  const base = pokedEntry(entry, subPhase, flagC, flagD);
  const o = base.clone();
  installFrameTick(o);
  installLeafStubs(o);
  oracle(o);
  const c = base.clone();
  installFrameTick(c);
  installLeafStubs(c);
  fn(c);
  return ramDiff(o, c);
}

/** The leaf the oracle chain reaches for one poked combo (for coverage / teeth expectations). */
function oracleLeaf(entry, subPhase, flagC, flagD) {
  const o = pokedEntry(entry, subPhase, flagC, flagD);
  installFrameTick(o);
  installLeafStubs(o);
  oracle(o);
  return o.mem.read8(BRANCH_MARKER);
}

// The full input space: sub-phase (1 is the special value; others share a path), and each
// flag as clear vs a spread of nonzero bytes.
const SUBPHASES = [0, 1, 2, 3, 255];
const FLAGS = [0, 1, 128, 255];

// -- 1. HARNESS ---------------------------------------------------------------

test("HARNESS: a real loc_3dae entry is captured; the stubbed oracle chain run is deterministic", () => {
  assert.ok(ENTRIES.length >= 1, "expected at least one real loc_3dae dispatch in the run window");

  // Path C (sub-phase != 1, both flags clear) is the one arm that reaches teardown.
  const base = pokedEntry(ENTRIES[0], 2, 0, 0);
  const a = base.clone(); installFrameTick(a); installLeafStubs(a); oracle(a);
  const b = base.clone(); installFrameTick(b); installLeafStubs(b); oracle(b);
  assert.equal(ramDiff(a, b), null, "oracle run not deterministic");
  assert.equal(a.mem.read8(BRANCH_MARKER), MARK_TEARDOWN, "the both-flags-clear arm should reach the teardown leaf");
  // (The teardown continuation re-arms ACTIVE_PLAYER to 1 at its reset epilogue, so stepRoundSubPhaseAndBranch's
  // transient write of 2 is legitimately overwritten by the time the chain reaches the leaf.)
  console.log(`  HARNESS: captured a real ${hx(PROXY)} entry (SP=${hx(ENTRIES[0].regs.sp)}); oracle chain deterministic, teardown arm reaches ${hx(RESET_LEAF)}`);
});

// -- 2. EQUAL over the crafted sweep -----------------------------------------

test("EQUAL (sub-phase x both flags sweep): idiomatic stepRoundSubPhaseAndBranch == oracle over full RAM", () => {
  assert.ok(ENTRIES.length >= 1, "need a captured entry");
  const entry = ENTRIES[0];
  let count = 0;
  const seen = new Set();
  for (const subPhase of SUBPHASES) {
    for (const flagC of FLAGS) {
      for (const flagD of FLAGS) {
        const diff = armDiff(entry, idiomatic, subPhase, flagC, flagD);
        assert.equal(
          diff,
          null,
          diff && `sub-phase=${subPhase} flagC=${flagC} flagD=${flagD}: RAM@${hx(diff.addr)} oracle=${diff.a} cand=${diff.b}`,
        );
        seen.add(oracleLeaf(entry, subPhase, flagC, flagD));
        count++;
      }
    }
  }
  assert.ok(seen.has(MARK_SETUP), "the sweep never exercised the setup continuation");
  assert.ok(seen.has(MARK_TEARDOWN), "the sweep never exercised the teardown continuation");
  console.log(`  EQUAL: ${count} crafted (sub-phase,flagC,flagD) combos identical over full RAM; both continuations covered`);
});

// Also run the sweep across every captured entry, to span real RAM images.
test("EQUAL (across all captured entries): every real base state agrees on a representative branch set", () => {
  assert.ok(ENTRIES.length >= 1, "need captured entries");
  for (const entry of ENTRIES) {
    for (const [subPhase, flagC, flagD] of [
      [1, 0, 1], // sub-phase 1, second flag set -> setup
      [1, 0, 0], // sub-phase 1, second flag clear -> falls through, reset arm
      [2, 1, 0], // reset arm, first flag set -> setup
      [2, 0, 0], // both clear -> teardown
      [2, 0, 1], // advance arm, second flag set -> setup
    ]) {
      const diff = armDiff(entry, idiomatic, subPhase, flagC, flagD);
      assert.equal(diff, null, diff && `entry SP=${hx(entry.regs.sp)} sub-phase=${subPhase} flagC=${flagC} flagD=${flagD}: RAM@${hx(diff.addr)} oracle=${diff.a} cand=${diff.b}`);
    }
  }
  console.log(`  EQUAL: ${ENTRIES.length} real base states each agree across the 5-arm branch set`);
});

// -- 3. TEETH -----------------------------------------------------------------

/** Broken twin: resets the sub-phase to 2 where it should reset to 1 (wrong sub-phase). Hands
 *  off to the real idiomatic continuations, mirroring stepRoundSubPhaseAndBranch. On the reset-arm-to-setup path
 *  the setup continuation does not overwrite ACTIVE_PLAYER, so the wrong value survives. */
function twinWrongPhase(m) {
  const { mem8 } = m;
  if (mem8[ACTIVE_PLAYER] === 1) {
    mem8[ACTIVE_PLAYER] = 2;
    if (mem8[FLAG_D] !== 0) return setUpRoundAndHoldIntro(m);
  }
  mem8[ACTIVE_PLAYER] = 2; // BUG: this arm must reset the sub-phase to 1
  if (mem8[FLAG_C] !== 0) return setUpRoundAndHoldIntro(m);
  mem8[ACTIVE_PLAYER] = 2;
  if (mem8[FLAG_D] === 0) return submitHighScoresAndReset(m);
  return setUpRoundAndHoldIntro(m);
}

/** Broken twin: always hands off to setup, never to teardown (wrong continuation). */
function twinWrongBranch(m) {
  const { mem8 } = m;
  if (mem8[ACTIVE_PLAYER] === 1) {
    mem8[ACTIVE_PLAYER] = 2;
    if (mem8[FLAG_D] !== 0) return setUpRoundAndHoldIntro(m);
  }
  mem8[ACTIVE_PLAYER] = 1;
  if (mem8[FLAG_C] !== 0) return setUpRoundAndHoldIntro(m);
  mem8[ACTIVE_PLAYER] = 2;
  return setUpRoundAndHoldIntro(m); // BUG: both-flags-clear must hand off to teardown (0x0371)
}

test("TEETH (wrong sub-phase): a twin that resets to 2 instead of 1 is CAUGHT at ACTIVE_PLAYER", () => {
  const entry = ENTRIES[0];
  // Reset arm with the first flag set: correct final sub-phase is 1, routing to setup (which
  // does not overwrite the sub-phase), so the wrong value 2 is observable.
  const diff = armDiff(entry, twinWrongPhase, 2, 1, 0);
  assert.ok(diff, "the gate FAILED to catch a wrong sub-phase value — it proves nothing");
  assert.equal(diff.addr, ACTIVE_PLAYER, `teeth caught the wrong address ${hx(diff.addr)} (expected ${hx(ACTIVE_PLAYER)})`);
  console.log(`  TEETH/sub-phase: wrong reset caught at ${hx(diff.addr)} (oracle=${diff.a} twin=${diff.b})`);
});

test("TEETH (wrong continuation): a twin that takes setup instead of teardown is CAUGHT at the leaf", () => {
  const entry = ENTRIES[0];
  // Both-flags-clear arm: correct continuation is teardown (reset leaf 0xf9); twin takes setup.
  const base = pokedEntry(entry, 2, 0, 0);
  const o = base.clone(); installFrameTick(o); installLeafStubs(o); oracle(o);
  const t = base.clone(); installFrameTick(t); installLeafStubs(t); twinWrongBranch(t);
  const diff = ramDiff(o, t);
  assert.ok(diff, "the gate FAILED to catch a wrong continuation — it proves nothing");
  assert.equal(o.mem.read8(BRANCH_MARKER), MARK_TEARDOWN, "oracle should have reached the teardown leaf");
  assert.equal(t.mem.read8(BRANCH_MARKER), MARK_SETUP, "the twin should have reached the setup leaf");
  console.log(`  TEETH/continuation: wrong hand-off caught at ${hx(diff.addr)}; leaf oracle=${hx(RESET_LEAF)} twin=${hx(SETUP_LEAF)}`);
});
