// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for dockManAndDispatchRoundBoundary (ROM 0x0278) — the round/state-boundary
 * dispatcher that docks the active player's man count, saves their record, and hands
 * off to next-round setup or end-of-round teardown.
 *
 * The dispatcher's whole observable effect is MEMORY — the docked man count 0x802b,
 * the player record persisted by saveActivePlayerRecord, and 0x802d / 0x8002 on the
 * mode == 1 arm — plus WHICH successor it tail-jumps to. So the gate diffs observable
 * RAM only (via dumpState); pc / SP / value registers are excluded per the honest-
 * signature contract (the idiomatic layer keeps no Z80 pc/step/register trace).
 *
 * WHY THE FULL SUCCESSOR CHAIN NOW RUNS. dockManAndDispatchRoundBoundary's four tail successors (0x03ac,
 * 0x02a1, 0x02ca, 0x0371) are all idiomatic now, so the idiomatic dockManAndDispatchRoundBoundary calls them
 * DIRECTLY (not through the registry) — a registry stub at those addresses would no
 * longer intercept. So both sides run the REAL successor chain: the idiomatic side via
 * its direct imports, the oracle side via m.call through the frozen registry. Every
 * chain converges at the two TRUE oracle leaves — 0x031a (round-loop setup, the "setup"
 * destination) and 0x01f9 (reset/entry handler, the "reset/teardown" destination) —
 * neither of which has an idiomatic form yet and both of which never return on hardware.
 *
 * TWO HARNESS PIECES both sides share, so neither can fork the result:
 *   - STUBBED LEAVES. 0x031a and 0x01f9 are stubbed identically on both arms with a spy
 *     that stamps a sentinel (0x1a / 0xf9) into a dead work-RAM marker and returns. That
 *     terminates the otherwise-endless chain AND surfaces the eventual destination (setup
 *     vs reset) as a RAM byte, so a wrong dispatch is a RAM diff the gate catches.
 *   - FRAME-TICK. The successor chain busy-waits on the per-frame countdown 0x8009 that
 *     the interrupt drains once a frame (the round-start intro, the setup-screen hold, the
 *     game-over hold). Run in isolation no interrupt fires, so one identical hook on both
 *     clones models the tick — each watchdog read decrements the countdown, floored at 0.
 *   - EXCLUDED STACK SCRATCH. The oracle brackets every callee with a stack push; the
 *     stack-free idiomatic calls do not, and the teardown leaf resets SP to 0x83ff. The
 *     two therefore leave different dead bytes in the top-of-stack scratch just below the
 *     stack top. No real cell lives there (measured 0x83f5..0x8400 across every arm), so
 *     the RAM diff EXCLUDES that window and compares every real cell byte-for-byte.
 *
 * Only one real dispatch occurs in attract (frame 0, mode >= 3 -> the bail arm), so the
 * other arms are crafted: the same captured state with the mode / condition bytes poked
 * identically on both sides (the crafted-entry method).
 *
 * Checks:
 *   0. HARNESS — capture the real 0x0278 entry and confirm the oracle run of the whole
 *      chain is deterministic (oracle vs oracle -> identical RAM).
 *   1. EQUAL — dockManAndDispatchRoundBoundary == oracle over observable RAM on all four arms (real bail arm +
 *      three crafted arms); each arm reaches the same leaf on both sides; both leaves
 *      (setup + reset) are exercised across the arms.
 *   2. TEETH (skip the dock) — a twin that forgets to decrement 0x802b is CAUGHT: the
 *      dropped decrement changes the backup byte the sub-phase sequencer (stepRoundSubPhaseAndBranch)
 *      consults, diverging the whole downstream chain.
 *   3. TEETH (wrong destination) — a twin that tears down where it should set up is CAUGHT
 *      at the destination leaf (reset 0xf9 instead of setup 0x1a).
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-0278.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0278 as oracle } from "../../translated/loc_0278.js";
import { dockManAndDispatchRoundBoundary as idiomatic } from "../dockManAndDispatchRoundBoundary.js";
import { saveActivePlayerRecord } from "../saveActivePlayerRecord.js";
// The idiomatic successors the broken twins hand off to directly (mirroring dockManAndDispatchRoundBoundary).
import { resetStateAndShowSetup } from "../resetStateAndShowSetup.js";
import { stepRoundSubPhaseAndBranch } from "../stepRoundSubPhaseAndBranch.js";
import { setUpRoundAndHoldIntro } from "../setUpRoundAndHoldIntro.js";
import { submitHighScoresAndReset } from "../submitHighScoresAndReset.js";
import { makeMachineFactory } from "../../machine.js";
import { GAME_STATE, ACTIVE_PLAYER } from "../names.js";

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

const TARGET = 0x0278;
const SETUP_LEAF = 0x031a; // round-loop setup — the "setup" destination (never returns)
const RESET_LEAF = 0x01f9; // reset/entry handler — the "reset/teardown" destination (never returns)
const MARK_SETUP = SETUP_LEAF & 0xff; // 0x1a — stamped when the chain reaches the setup leaf
const MARK_RESET = RESET_LEAF & 0xff; // 0xf9 — stamped when the chain reaches the reset leaf
const MARKER = 0x8700; // dead work-RAM byte the leaf stubs stamp with the reached leaf's low byte
const WORKING_MEN = 0x802b; // field-1 working man count (docked here)
const P2_BACKUP_MEN = 0x802d; // the other player's backup man count (cleared on the mode==1 arm)
const P1_BACKUP_MEN = 0x802c; // this player's backup man count (routes setup vs teardown)
const WATCHDOG = 0xb800; // reading it kicks the watchdog (once per frame-wait pass)
const COUNTDOWN = 0x8009; // the per-frame countdown cell the frame-waits drain to 0
// Dead top-of-stack scratch: the oracle's per-call pushes and the idiomatic direct calls
// (plus the teardown leaf's SP reset to 0x83ff) legitimately differ here. Measured span
// 0x83f5..0x8400 across every arm; no real cell lives in it and the teeth prove it.
const STACK_SCRATCH_LO = 0x83f5;
const STACK_SCRATCH_HI = 0x8400;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/**
 * Hook 0x0278 in a real attract run and clone the machine at its first dispatch — a
 * genuine round-boundary state. The wrapper snapshots, then runs the oracle so boot
 * proceeds undisturbed.
 */
function captureEntry(maxFrames) {
  let entry = null;
  const hook = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return oracle(mm);
  }]]);
  const host = makeMachine(hook);
  host.runFrames(maxFrames);
  return entry;
}

/**
 * Model the once-per-frame interrupt tick that drives the successor chain's frame-waits
 * to completion: each watchdog read (a wait does exactly one per pass) decrements the
 * countdown, floored at 0. Installed identically on both clones, so it can only expose a
 * difference, never create one.
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

/** Stub the two true leaves so the never-returning chain terminates AND its destination
 *  (setup vs reset) is surfaced as a RAM byte. Identical on both sides. */
function installLeafStubs(c) {
  c.routines.set(SETUP_LEAF, (mm) => mm.mem.write8(MARKER, MARK_SETUP));
  c.routines.set(RESET_LEAF, (mm) => mm.mem.write8(MARKER, MARK_RESET));
}

/**
 * Clone the captured entry, poke the arm's condition bytes (identically for oracle and
 * candidate), install the frame-tick + leaf stubs, run `fn`, and return the machine.
 */
function runArm(entry, fn, pokes) {
  const c = entry.clone();
  for (const [addr, val] of pokes) c.mem.write8(addr, val);
  c.mem.write8(MARKER, 0);
  installFrameTick(c);
  installLeafStubs(c);
  fn(c);
  return c;
}

/**
 * First differing RAM byte between two machines (full dumpState), EXCLUDING the dead
 * top-of-stack scratch window. Null when otherwise identical.
 */
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

// The four arms, each a name + the pokes that force it + the leaf its chain reaches.
function arms() {
  return [
    // The first-leg / second-leg arms pin the player-index byte 0x8002 to 2 so the record
    // save writes backup column 2 (0x802d); the reserve-man byte 0x802c then routes the
    // first-leg dispatch (men left -> setup 0x02ca, none left -> teardown 0x0371).
    { name: "bail (mode>=3)", pokes: [[GAME_STATE, 4]], leaf: MARK_RESET },
    { name: "second leg (mode 2)", pokes: [[GAME_STATE, 2], [ACTIVE_PLAYER, 2], [P1_BACKUP_MEN, 0]], leaf: MARK_SETUP },
    { name: "first leg, men left", pokes: [[GAME_STATE, 1], [ACTIVE_PLAYER, 2], [P1_BACKUP_MEN, 9]], leaf: MARK_SETUP },
    { name: "first leg, none left", pokes: [[GAME_STATE, 1], [ACTIVE_PLAYER, 2], [P1_BACKUP_MEN, 0]], leaf: MARK_RESET },
  ];
}

// -- 0. HARNESS (reachability + determinism) ---------------------------------

test("HARNESS: the real 0x0278 entry is captured and the oracle chain run is deterministic", () => {
  const entry = captureEntry(2500);
  assert.ok(entry, "expected 0x0278 to be dispatched during boot/attract");

  const a = runArm(entry, oracle, [[GAME_STATE, 4]]);
  const b = runArm(entry, oracle, [[GAME_STATE, 4]]);
  const d = ramDiff(a, b);
  assert.equal(d, null, d && `oracle run not deterministic: diff at ${hx(d.addr)}`);
  assert.equal(a.mem.read8(MARKER), MARK_RESET, "the bail arm should reach the reset leaf");
  console.log(
    `  HARNESS: captured a real 0x0278 entry (SP=${hx(entry.regs.sp)}, ` +
      `GAME_STATE=${entry.mem.read8(GAME_STATE)}); oracle chain run deterministic, bail arm reaches ${hx(RESET_LEAF)}`,
  );
});

// -- 1. EQUAL across all four arms -------------------------------------------

test("EQUAL: dockManAndDispatchRoundBoundary == oracle over observable RAM on every dispatch arm", () => {
  const entry = captureEntry(2500);
  assert.ok(entry, "need a captured 0x0278 entry");

  const seenLeaves = new Set();
  for (const arm of arms()) {
    const o = runArm(entry, oracle, arm.pokes);
    const c = runArm(entry, idiomatic, arm.pokes);

    const d = ramDiff(o, c);
    assert.equal(d, null, d && `${arm.name}: RAM diff at ${hx(d.addr)} oracle=${d.a} cand=${d.b}`);

    // Both sides ran the whole chain to the SAME leaf, and it is the leaf we expect.
    assert.equal(
      c.mem.read8(MARKER),
      o.mem.read8(MARKER),
      `${arm.name}: idiomatic and oracle reached different leaves`,
    );
    assert.equal(c.mem.read8(MARKER), arm.leaf, `${arm.name}: reached the wrong destination leaf`);
    seenLeaves.add(arm.leaf);
    const leafAddr = c.mem.read8(MARKER) === MARK_SETUP ? SETUP_LEAF : RESET_LEAF;
    console.log(`  EQUAL/${arm.name}: identical RAM; chain reached leaf ${hx(leafAddr)}`);
  }
  // The arms span both destinations, so the diff really exercises setup and reset.
  assert.ok(seenLeaves.has(MARK_SETUP), "no arm exercised the setup leaf");
  assert.ok(seenLeaves.has(MARK_RESET), "no arm exercised the reset leaf");
});

// -- 2. TEETH: a twin that skips the man-count dock --------------------------

/** Broken twin: the real logic + direct successor hand-offs, but WITHOUT decrementing the
 *  working man count. The dropped decrement leaves a wrong value in the persisted backup
 *  (saveActivePlayerRecord writes column 2 = 0x802d), which the sub-phase sequencer
 *  stepRoundSubPhaseAndBranch then reads as a continuation flag — so the whole downstream dispatch diverges. */
function twinNoDock(m) {
  const { mem8 } = m;
  if (mem8[GAME_STATE] >= 3) return resetStateAndShowSetup(m);
  // BUG: the man-count dock (mem8[0x802b]--) is missing here.
  saveActivePlayerRecord(m);
  if (mem8[GAME_STATE] !== 1) return stepRoundSubPhaseAndBranch(m);
  mem8[P2_BACKUP_MEN] = 0;
  mem8[ACTIVE_PLAYER] = 1;
  if (mem8[P1_BACKUP_MEN] !== 0) return setUpRoundAndHoldIntro(m);
  return submitHighScoresAndReset(m);
}

test("TEETH (skip the dock): a twin that never decrements the man count is CAUGHT", () => {
  const entry = captureEntry(2500);
  assert.ok(entry, "need a captured 0x0278 entry");
  // The second-leg (mode 2) arm: the dock feeds the backup byte stepRoundSubPhaseAndBranch consults, so
  // dropping it flips the sub-phase dispatch (here setup vs teardown) — observable in RAM.
  const pokes = [[GAME_STATE, 2], [ACTIVE_PLAYER, 2], [P1_BACKUP_MEN, 0]];

  const o = runArm(entry, oracle, pokes);
  const t = runArm(entry, twinNoDock, pokes);
  const d = ramDiff(o, t);
  assert.ok(d, "the gate FAILED to catch the skipped-dock twin — it proves nothing");
  console.log(`  TEETH/dock: skipped-dock twin caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

// -- 3. TEETH: a twin that dispatches to the wrong destination ---------------

/** Broken twin: always tears down, ignoring the reserve-man test at 0x802c. */
function twinWrongDest(m) {
  const { mem8 } = m;
  if (mem8[GAME_STATE] >= 3) return resetStateAndShowSetup(m);
  mem8[WORKING_MEN] = mem8[WORKING_MEN] - 1;
  saveActivePlayerRecord(m);
  if (mem8[GAME_STATE] !== 1) return stepRoundSubPhaseAndBranch(m);
  mem8[P2_BACKUP_MEN] = 0;
  mem8[ACTIVE_PLAYER] = 1;
  return submitHighScoresAndReset(m); // BUG: should set up the next round (0x02ca) when 0x802c != 0
}

test("TEETH (wrong destination): a twin that ignores the reserve-man test is CAUGHT at the leaf", () => {
  const entry = captureEntry(2500);
  assert.ok(entry, "need a captured 0x0278 entry");
  const pokes = [[GAME_STATE, 1], [ACTIVE_PLAYER, 2], [P1_BACKUP_MEN, 9]]; // men left -> oracle sets up (0x1a)

  const o = runArm(entry, oracle, pokes);
  const t = runArm(entry, twinWrongDest, pokes);
  const d = ramDiff(o, t);
  assert.ok(d, "the gate FAILED to catch the wrong-destination twin — it proves nothing");
  // The correct arm reaches the setup leaf; the twin tears down and reaches the reset leaf.
  assert.equal(o.mem.read8(MARKER), MARK_SETUP, "oracle should have reached the setup leaf");
  assert.equal(t.mem.read8(MARKER), MARK_RESET, "the wrong-destination twin should reach the reset leaf");
  console.log(
    `  TEETH/dest: wrong-destination twin caught at ${hx(d.addr)}; ` +
      `leaf oracle=${hx(SETUP_LEAF)} broken=${hx(RESET_LEAF)}`,
  );
});
