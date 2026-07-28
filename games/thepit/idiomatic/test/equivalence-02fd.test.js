// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for advanceToNextLevel (ROM 0x02fd) — the round-boundary arm
 * that clears the current level and sets up the next one (bumps the level counter,
 * persists the player record, rebuilds the board, shows the between-levels bonus screen,
 * then falls into the round (re)init).
 *
 * The routine's whole observable effect is MEMORY — the bumped LEVEL, the persisted
 * player-record backups, the rebuilt board display + bonus screen — plus WHICH successor
 * it hands off to (round setup vs the reset epilogue). So the gate diffs observable RAM
 * only (via dumpState); pc / SP / value registers are excluded per the honest-signature
 * contract (the idiomatic layer keeps no Z80 pc/step/register trace).
 *
 * WHY A CRAFTED ENTRY. 0x02fd never dispatches in a boot/attract run (the demo never
 * clears a level), so the capture/replay harness cannot hook it directly. Its sibling
 * 0x0278 (the lost-a-life arm of the same timer-expiry gate dispatchObjectFrameByStateTimer) IS reached at boot,
 * and both are tail-jumped from that gate with the same call convention, so 0x0278's
 * captured entry — a genuine round-boundary state with a valid return on the stack — is a
 * faithful entry for 0x02fd too. GAME_MODE is then poked to force each branch, identically
 * on both sides (the crafted-entry method).
 *
 * WHY THE FULL SUCCESSOR CHAIN RUNS, AND HOW IT IS BOUNDED. Every callee below
 * advanceToNextLevel is idiomatic now — the advance body's callees (saveActivePlayerRecord,
 * setupBoardDisplay, showBonusScreen), the round (re)init initRoundAndEnterMainLoop it advances into, and the
 * reset epilogue resetStateAndShowSetup it bails to — so the idiomatic routine calls them DIRECTLY; a
 * registry stub at those addresses would no longer intercept. So both sides run the REAL
 * successor chain to the end: the advance branch through initRoundAndEnterMainLoop, the bail branch through
 * resetStateAndShowSetup's reset cascade (resetStateAndShowSetup -> the reset/entry handler -> re-enter play), and BOTH
 * land in the never-returning main game loop (the captured entry has the restart flag clear,
 * so the bail cascade re-enters play rather than the credit screen). The main loop reads the
 * watchdog once at the top of every pass, before any per-frame work; the many setup / bonus /
 * paint frame-waits only read the watchdog while the per-frame countdown is still draining. So
 * ONE shared watchdog hook drains that countdown (modelling the per-frame interrupt, so the
 * frame-waits terminate) and, on the first watchdog read it sees with the countdown already at
 * 0 — the main loop's pass top — throws, stopping both arms at the loop's entry, before it does
 * any work. Both arms reach it identically (oracle via m.call through the frozen registry,
 * idiomatic via its imports), so the hook can only reveal a difference. initRoundAndEnterMainLoop / resetStateAndShowSetup /
 * rearmMachineAndBranchOnCredits are each separately gated.
 *
 * TWO HARNESS PIECES both sides share, so neither can fork the result:
 *   - THE SHARED WATCHDOG BOUND (above): drains the frame-waits and stops both arms at the
 *     main loop's entry.
 *   - EXCLUDED STACK SCRATCH. The oracle brackets every callee with a stack push; the
 *     stack-free idiomatic calls do not, and the reset cascade re-seats SP. The two therefore
 *     leave different dead bytes in the top-of-stack scratch just below the stack top. No
 *     real cell lives there, so the RAM diff EXCLUDES that window and compares every real
 *     cell byte-for-byte; the teeth prove the window hides nothing real.
 *
 * Checks:
 *   0. HARNESS — capture the real 0x0278 entry and confirm the oracle run of the whole
 *      chain is deterministic (oracle vs oracle -> identical RAM) on both branches.
 *   1. EQUAL — advanceToNextLevel == oracle over observable RAM on both branches (advance +
 *      bail); the advance branch bumps LEVEL, the bail branch does not, and the two branches
 *      reach visibly different machine states (game mode 1 vs 4 at the main-loop entry).
 *   2. TEETH (skip the level bump) — a twin that forgets to increment LEVEL is CAUGHT at
 *      0x8028 (the dropped bump survives into the persisted backup initRoundAndEnterMainLoop reloads).
 *   3. TEETH (wrong destination) — a twin that always bails to reset where it should advance
 *      is CAUGHT: the bail chain leaves a different machine state than the advance chain.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-02fd.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_02fd as oracle } from "../../translated/loc_02fd.js";
import { loc_0278 as siblingOracle } from "../../translated/loc_0278.js";
import { advanceToNextLevel as idiomatic } from "../advanceToNextLevel.js";
// The idiomatic successors the broken twins hand off to directly (mirroring the routine).
import { resetStateAndShowSetup } from "../resetStateAndShowSetup.js";
import { saveActivePlayerRecord } from "../saveActivePlayerRecord.js";
import { setupBoardDisplay } from "../setupBoardDisplay.js";
import { showBonusScreen } from "../showBonusScreen.js";
import { makeMachineFactory } from "../../machine.js";
import { GAME_MODE, LEVEL } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x02fd;
const CAPTURE_AT = 0x0278; // sibling round-boundary arm — reached at boot, same call convention
const SETUP_LEAF = 0x031a; // round-loop setup — the advance destination (never returns)
const WATCHDOG = 0xb800; // reading it kicks the watchdog (once per frame-wait / main-loop pass)
const COUNTDOWN = 0x8009; // the per-frame countdown cell the frame-waits drain to 0
// Dead top-of-stack scratch: the oracle's per-call pushes and the idiomatic direct calls
// (plus the reset cascade's SP re-seat) legitimately differ here. Measured span across both
// branches is 0x83f3..0x83fe (entry SP 0x83fd, stack top 0x8400); no real cell lives in this
// window (the highest named work RAM is far below it) and the teeth, which catch real cells
// at 0x8028 / 0x8001, prove the window hides nothing.
const STACK_SCRATCH_LO = 0x83f0;
const STACK_SCRATCH_HI = 0x8400;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// A unique token thrown to bound the never-returning main loop at its entry.
const BOUND = Symbol("mainLoop-entry-bound");

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/**
 * Hook the sibling 0x0278 in a real attract run and clone the machine at its first
 * dispatch — a genuine round-boundary state. The wrapper snapshots, then runs the oracle
 * of the sibling so boot proceeds undisturbed.
 */
function captureEntry(maxFrames) {
  let entry = null;
  const hook = new Map([[CAPTURE_AT, (mm) => {
    if (entry === null) entry = mm.clone();
    return siblingOracle(mm);
  }]]);
  const host = makeMachine(hook);
  host.runFrames(maxFrames);
  return entry;
}

/**
 * Clone the captured entry, poke the branch's condition byte, and run `fn` bounded at the
 * main loop's entry: the watchdog hook drains the per-frame countdown (so the setup / bonus /
 * paint frame-waits terminate) and throws on the first watchdog read the countdown is already
 * drained for — the main loop's pass top. `atBound` (a teeth mutation, if any) is applied
 * there, after read8 is restored so it cannot re-enter the hook. Asserts the run reached the
 * bound. Returns the machine.
 */
function runArm(entry, fn, pokes, atBound) {
  const c = entry.clone();
  for (const [addr, val] of pokes) c.mem.write8(addr, val);
  const mem = c.mem;
  const origRead8 = mem.read8.bind(mem);
  mem.read8 = (addr) => {
    if (addr === WATCHDOG) {
      const cd = origRead8(COUNTDOWN);
      if (cd !== 0) {
        mem.write8(COUNTDOWN, cd - 1);
      } else {
        mem.read8 = origRead8;
        if (atBound) atBound(c);
        throw BOUND;
      }
    }
    return origRead8(addr);
  };
  let bounded = false;
  try {
    fn(c);
  } catch (e) {
    if (e !== BOUND) throw e;
    bounded = true;
  }
  assert.ok(bounded, "run did not reach the main loop's entry bound — the harness never engaged");
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

// The two branches: a name + the poke that forces it + the game-mode it lands in at the
// main-loop entry. GAME_MODE >= 3 bails to reset (which re-enters play, mode 4); a live
// 1-or-2-player game advances the level (real play, mode 1).
function branches() {
  return [
    { name: "advance (mode 1)", pokes: [[GAME_MODE, 1]], endMode: 1 },
    { name: "bail (mode>=3)", pokes: [[GAME_MODE, 4]], endMode: 4 },
  ];
}

// -- 0. HARNESS (reachability + determinism) ---------------------------------

test("HARNESS: the real 0x0278 entry is captured and the oracle chain run is deterministic", () => {
  const entry = captureEntry(2500);
  assert.ok(entry, "expected the sibling 0x0278 to be dispatched during boot/attract");
  assert.equal(entry.mem.read8(0x8000), 0, "the captured entry has the restart flag clear (bail re-enters play)");

  for (const br of branches()) {
    const a = runArm(entry, oracle, br.pokes);
    const b = runArm(entry, oracle, br.pokes);
    const d = ramDiff(a, b);
    assert.equal(d, null, d && `${br.name}: oracle run not deterministic: diff at ${hx(d.addr)}`);
    assert.equal(a.mem.read8(GAME_MODE), br.endMode, `${br.name}: oracle reached the wrong end state`);
  }
  console.log(
    `  HARNESS: captured a real 0x0278 entry (SP=${hx(entry.regs.sp)}, ` +
      `GAME_MODE=${entry.mem.read8(GAME_MODE)}, LEVEL=${entry.mem.read8(LEVEL)}); ` +
      `oracle chain deterministic on both branches (advance -> mode 1, bail -> mode 4 at the main-loop entry)`,
  );
});

// -- 1. EQUAL across both branches -------------------------------------------

test("EQUAL: advanceToNextLevel == oracle over observable RAM on both branches", () => {
  const entry = captureEntry(2500);
  assert.ok(entry, "need a captured 0x0278 entry");

  const seenModes = new Set();
  for (const br of branches()) {
    const o = runArm(entry, oracle, br.pokes);
    const c = runArm(entry, idiomatic, br.pokes);

    const d = ramDiff(o, c);
    assert.equal(d, null, d && `${br.name}: RAM diff at ${hx(d.addr)} oracle=${d.a} cand=${d.b}`);

    // Both sides ran the whole chain to the SAME main-loop entry state.
    assert.equal(
      c.mem.read8(GAME_MODE),
      o.mem.read8(GAME_MODE),
      `${br.name}: idiomatic and oracle reached different end states`,
    );
    assert.equal(c.mem.read8(GAME_MODE), br.endMode, `${br.name}: reached the wrong end state`);
    seenModes.add(br.endMode);
    console.log(`  EQUAL/${br.name}: identical RAM; chain reached game mode ${c.mem.read8(GAME_MODE)} at the main-loop entry`);
  }
  // Positive check for the advance branch: the level counter really was bumped.
  const before = entry.mem.read8(LEVEL);
  const advanced = runArm(entry, idiomatic, [[GAME_MODE, 1]]);
  assert.equal(advanced.mem.read8(LEVEL), (before + 1) & 0xff, "the advance branch did not bump the level counter");

  // The branches land in visibly different states, so the diff really exercises both.
  assert.ok(seenModes.has(1) && seenModes.has(4), "both branches (advance + bail) were exercised");
});

// -- 2. TEETH: a twin that skips the level bump ------------------------------

/** Broken twin: the real logic + direct successor hand-offs, but WITHOUT incrementing the
 *  level counter. The dropped bump leaves the wrong level in the persisted backup that
 *  initRoundAndEnterMainLoop reloads — an observable RAM divergence at LEVEL. */
function twinSkipBump(m) {
  const { mem8 } = m;
  if (mem8[GAME_MODE] >= 3) return resetStateAndShowSetup(m);
  // BUG: the level bump (mem8[LEVEL] = mem8[LEVEL] + 1) is missing here.
  saveActivePlayerRecord(m);
  setupBoardDisplay(m, 160);
  showBonusScreen(m);
  saveActivePlayerRecord(m);
  return m.call(SETUP_LEAF);
}

test("TEETH (skip the level bump): a twin that never increments the level counter is CAUGHT", () => {
  const entry = captureEntry(2500);
  assert.ok(entry, "need a captured 0x0278 entry");
  const pokes = [[GAME_MODE, 1]]; // the advance branch — where the bump happens

  const o = runArm(entry, oracle, pokes);
  const t = runArm(entry, twinSkipBump, pokes);
  const d = ramDiff(o, t);
  assert.ok(d, "the gate FAILED to catch the skipped-bump twin — it proves nothing");
  // The dropped bump leaves the wrong level in the persisted backup initRoundAndEnterMainLoop reloads. It shows
  // both at LEVEL (0x8028) itself and at the pacing delay (0x8011 = base - LEVEL) initRoundAndEnterMainLoop
  // derives from it; the derived cell sits below LEVEL, so the scan reports it first.
  assert.equal(o.mem.read8(LEVEL), (t.mem.read8(LEVEL) + 1) & 0xff, "the dropped bump must leave LEVEL one lower on the twin");
  console.log(`  TEETH/bump: skipped-bump twin caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b}); LEVEL ${t.mem.read8(LEVEL)} vs ${o.mem.read8(LEVEL)}`);
});

// -- 3. TEETH: a twin that hands off to the wrong destination ----------------

/** Broken twin: always bails to the reset epilogue, ignoring the live-game guard. */
function twinWrongDest(m) {
  return resetStateAndShowSetup(m); // BUG: should advance the level (fall into initRoundAndEnterMainLoop) when a game is live
}

test("TEETH (wrong destination): a twin that always bails to reset is CAUGHT", () => {
  const entry = captureEntry(2500);
  assert.ok(entry, "need a captured 0x0278 entry");
  const pokes = [[GAME_MODE, 1]]; // a live game -> oracle advances (mode 1)

  const o = runArm(entry, oracle, pokes);
  const t = runArm(entry, twinWrongDest, pokes);
  const d = ramDiff(o, t);
  assert.ok(d, "the gate FAILED to catch the wrong-destination twin — it proves nothing");
  // The advance chain lands in real play (mode 1); the bail chain re-enters play through the
  // reset cascade (mode 4). The differing destinations leave a different machine state.
  assert.equal(o.mem.read8(GAME_MODE), 1, "oracle should advance into real play (mode 1)");
  assert.equal(t.mem.read8(GAME_MODE), 4, "the wrong-destination twin should re-enter play via reset (mode 4)");
  console.log(
    `  TEETH/dest: wrong-destination twin caught at ${hx(d.addr)}; ` +
      `game mode oracle=1 broken=4 at the main-loop entry`,
  );
});
