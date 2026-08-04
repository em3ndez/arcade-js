// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for holdRoundIntroLoop (ROM 0x02e1, The Pit) — the round-start intro-hold
 * loop: for a caller-armed number of passes, repaint the "PLAYERS" HUD label and one
 * playfield strip and hold with two short frame-waits, then tail-jump into the round-loop
 * setup (initRoundAndEnterMainLoop), which never returns.
 *
 * WHY A CRAFTED ENTRY. holdRoundIntroLoop is the loop the round-start setup flows into, on the
 * boot/round path that a plain attract run never takes, so it is never dispatched in
 * attract (nothing to snapshot). Per the crafted-entry method the gate captures a real
 * attract machine state — realistic full RAM, the oracle registry, a live stack — by
 * hooking a routine attract DOES reach (loc_3dae, the tile-offset calc entered within the
 * first ~100 frames) and cloning the machine the first time it fires. holdRoundIntroLoop takes no
 * register inputs; the one thing it reads that shapes the run is the pass count in the loop
 * counter, which the caller arms — so the entry is poked to a small pass count (identically
 * on both arms) to make the run short and deterministic while exercising the multi-pass
 * loop, the decrement/store, and the do/while termination.
 *
 * HOW THE NEVER-RETURNING TAIL IS BOUNDED. holdRoundIntroLoop's tail is now the DIRECT idiomatic
 * initRoundAndEnterMainLoop (no longer a registry boundary), which restores the player record, PAINTS THE
 * WHOLE BOARD, and falls into the main game loop that spins forever. Its board paint would
 * overwrite the very HUD label + playfield strip this routine's intro produces — so the gate
 * stops both arms at the hand-off, the instant initRoundAndEnterMainLoop's board paint is about to begin,
 * BEFORE it repaints. paintScreen (inside initRoundAndEnterMainLoop) waits one frame before its first copy, and
 * that frame-wait is the first watchdog read that happens once this routine's intro loop has
 * drained the shared loop counter to 0 (every intro frame-wait runs with the counter still
 * >= 1). So the shared watchdog hook drains the intro's per-frame countdown (modelling the
 * interrupt, so the intro's frame-waits terminate) and, on the first watchdog read it sees
 * with the loop counter already at 0, throws — freezing both arms at initRoundAndEnterMainLoop's paint boundary
 * with this routine's intro output intact. Both arms reach it identically (oracle via m.call to
 * the registered translated initRoundAndEnterMainLoop, idiomatic via its import), so the hook can only reveal a
 * difference. initRoundAndEnterMainLoop's own correctness is separately gated (equivalence-031a).
 *
 * THE CONTRACT is observable-RAM equivalence: the work / colour / video / sprite RAM the
 * routine leaves. pc, SP and the value registers/flags are EXCLUDED — the idiomatic layer
 * does not preserve the Z80 register trace, and this routine has no genuine register live-out
 * (it tail-jumps into the round loop and the caller's return is carried by initRoundAndEnterMainLoop). ONE
 * WRINKLE: the dissolved painter/wait calls no longer push their return addresses onto the
 * work stack, so the oracle parks a few return-address ghosts in the dead scratch just below
 * the entry stack pointer that the stack-free idiomatic calls do not. No game-observable cell
 * lives in the stack area (0x83xx) — every named work cell sits at/below 0x823f and colour RAM
 * starts at 0x8800 — so the RAM diff EXCLUDES a small window just below entry SP and compares
 * every real cell byte-for-byte.
 *
 * Three checks, the gate's two directions:
 *   1. EQUAL (real captured entry, small pass count) — idiomatic leaves RAM byte-identical to
 *      the oracle outside the dead stack window, and the observable effect holds: the intro
 *      loop drains the pass counter to 0.
 *   2. TEETH (corrupted painted cell) — a twin that flips one colour cell the playfield-strip
 *      paint leaves behind is CAUGHT in colour RAM, well outside the stack window (the intro
 *      output is intact at the paint boundary, so the corruption shows). (Dropping a painter is
 *      NOT a valid twin here: the label and the strip paint the same column, the strip last, so
 *      the strip overwrites the label every pass — the label's output is dead, and an equivalent
 *      twin must not be "caught". The strip's own output is what survives.)
 *   3. TEETH (intro loop left un-drained) — a twin that leaves the pass counter non-zero is
 *      CAUGHT at the loop-counter cell.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-02e1.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_02e1 as oracle } from "../../translated/loc_02e1.js";
import { holdRoundIntroLoop as idiomatic } from "../holdRoundIntroLoop.js";
import { loc_031a as oracleRoundInit } from "../../translated/loc_031a.js";
import { loc_3dae as reachableOracle } from "../../translated/loc_3dae.js";

import { makeMachineFactory } from "../../machine.js";
import { LOOP_COUNTER, COLOUR_RAM_CURSOR } from "../names.js";

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

const PROXY = 0x3dae; // a routine attract DOES reach; hooked to capture a real machine state
const TAIL = 0x031a; // the round-loop setup holdRoundIntroLoop tail-jumps to (now a direct idiomatic call)
const COUNTDOWN = 0x8009; // the per-frame countdown cell the frame-waits drain to 0
const WATCHDOG = 0xb800; // reading it kicks the watchdog (once per busy-wait pass)
const PASSES = 3; // small caller-armed pass count so the crafted run is short + deterministic
const STACK_WINDOW = 16; // dead stack-scratch just below entry SP
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// A unique token thrown to bound execution at initRoundAndEnterMainLoop's board-paint boundary (see above).
const BOUND = Symbol("round-init-paint-bound");

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture one real attract machine state to seed crafted entries. holdRoundIntroLoop itself is never
 * dispatched in attract, so hook a routine that IS (loc_3dae, entered within the first ~100
 * frames) and clone the machine the first time it fires. The never-returning round-loop setup
 * 0x031a is stubbed on the host during capture so the boot run does not hang; the comparison
 * clones re-register the REAL translated round init (see runBounded).
 */
function captureSeed() {
  let seed = null;
  const overrides = new Map([
    [PROXY, (mm) => {
      if (seed === null) seed = mm.clone();
      return reachableOracle(mm);
    }],
    [TAIL, () => {}], // no-op stub during capture only
  ]);
  makeMachine(overrides).runFrames(240);
  assert.ok(seed !== null, "expected loc_3dae to be dispatched during attract to seed the crafted entry");
  return seed;
}

const SEED = ROM_PRESENT ? captureSeed() : null;

/** A crafted entry: the real captured state with the caller-armed pass count set small. */
function preparedEntry() {
  const e = SEED.clone();
  e.mem.write8(LOOP_COUNTER, PASSES);
  return e;
}

/**
 * Run `fn` on a fresh clone of `entry`, bounded at initRoundAndEnterMainLoop's board-paint boundary. Register
 * the REAL translated round init at 0x031a (so the oracle arm reaches it for real). The
 * watchdog hook drains the per-frame countdown while the intro loop is still running (its loop
 * counter >= 1, so the intro frame-waits terminate); the first watchdog read it sees with the
 * loop counter already at 0 is initRoundAndEnterMainLoop's paintScreen settle-wait, taken BEFORE the board is
 * repainted, so it applies `atBound` (a teeth mutation, if any) and throws there. Restores
 * read8 before `atBound` so it cannot re-enter the hook. Asserts the run reached the bound.
 */
function runBounded(entry, fn, atBound) {
  const m = entry.clone();
  m.routines.set(TAIL, oracleRoundInit);
  const mem = m.mem;
  const origRead8 = mem.read8.bind(mem);
  mem.read8 = (addr) => {
    if (addr === WATCHDOG) {
      if (origRead8(LOOP_COUNTER) === 0) {
        mem.read8 = origRead8;
        if (atBound) atBound(m);
        throw BOUND;
      }
      const c = origRead8(COUNTDOWN);
      if (c !== 0) mem.write8(COUNTDOWN, c - 1);
    }
    return origRead8(addr);
  };
  let bounded = false;
  try {
    fn(m);
  } catch (e) {
    if (e !== BOUND) throw e;
    bounded = true;
  }
  assert.ok(bounded, "run did not reach initRoundAndEnterMainLoop's paint boundary — the harness never engaged");
  return m;
}

/**
 * First differing state byte between two machines, EXCLUDING the dead stack-scratch window
 * just below the entry stack pointer (the dissolved calls no longer push their return
 * addresses there). That window is pure stack (0x83xx); no game-observable cell lives in it,
 * so every real cell is compared byte-for-byte. Null when otherwise identical.
 */
function stateDiffOutsideStack(a, b, entrySP) {
  const da = a.dumpState();
  const db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= entrySP - STACK_WINDOW && addr < entrySP) continue; // dead stack scratch
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/**
 * Run the oracle and a candidate on two independent clones of the crafted entry — both bounded
 * at initRoundAndEnterMainLoop's paint boundary — and diff the observable-RAM contract, excluding the dead stack
 * scratch. `atBound` is applied only to the candidate (for the teeth). Returns { diffs, ram }
 * (diffs empty == EQUAL).
 */
function contractDiffs(entry, fn, atBound) {
  const entrySP = entry.regs.sp;
  const a = runBounded(entry, oracle);
  const b = runBounded(entry, fn, atBound);

  const diffs = [];
  const ram = stateDiffOutsideStack(a, b, entrySP);
  if (ram) diffs.push(`RAM@${hx(ram.addr ?? 0)} oracle=${ram.a} cand=${ram.b}`);
  return { diffs, ram };
}

// -- 1. EQUAL on a real captured attract entry --------------------------------

test("EQUAL (real entry): holdRoundIntroLoop == oracle over observable RAM", () => {
  const { diffs } = contractDiffs(preparedEntry(), idiomatic);
  assert.equal(diffs.length, 0, diffs.join("; "));

  // Positive check: the intro loop really drained the caller-armed pass counter to 0.
  const c = runBounded(preparedEntry(), idiomatic);
  assert.equal(c.mem.read8(LOOP_COUNTER), 0, "the intro loop must drain the pass counter to 0");
  console.log(
    `  EQUAL/real: idiomatic matches oracle over full RAM (outside ${STACK_WINDOW}-byte stack scratch); ` +
      `${PASSES}-pass intro loop drained the counter to 0`,
  );
});

// -- 2. TEETH: a corrupted painted cell is caught -----------------------------

test("TEETH (corrupted painted cell): a flipped colour cell is CAUGHT in colour RAM", () => {
  // At the paint boundary the playfield-strip's colour cell is intact (initRoundAndEnterMainLoop has not
  // recopied the colour map yet); flip the top cell of the final strip's colour column there.
  const { diffs, ram } = contractDiffs(preparedEntry(), idiomatic, (m) => {
    const cell = m.mem16[COLOUR_RAM_CURSOR]; // top colour cell the last strip paint wrote (colour 0)
    m.mem8[cell] = m.mem8[cell] ^ 0xff; // BUG: corrupt a painted colour cell
  });
  assert.ok(diffs.length > 0, "the gate FAILED to catch the corrupted-cell twin — it proves nothing");
  const inColourRam = ram.addr >= 0x8800 && ram.addr <= 0x8bff;
  assert.ok(inColourRam, `expected the diff in colour RAM, got ${hx(ram.addr)}`);
  console.log(`  TEETH/cell: corrupted painted colour cell caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

// -- 3. TEETH: an un-drained intro loop is caught -----------------------------

test("TEETH (loop not drained): a non-zero pass counter is CAUGHT at the loop-counter cell", () => {
  // The intro drains the pass counter to 0 (which the correct routine does, triggering the
  // bound); a twin that left it re-armed is modelled by re-dirtying it at the bound.
  const { diffs, ram } = contractDiffs(preparedEntry(), idiomatic, (m) => { m.mem8[LOOP_COUNTER] = PASSES; });
  assert.ok(diffs.length > 0, "the gate FAILED to catch the un-drained loop twin — it proves nothing");
  assert.equal(
    ram && ram.addr,
    LOOP_COUNTER,
    `teeth caught the wrong address ${ram ? hx(ram.addr) : "(none)"} (expected ${hx(LOOP_COUNTER)})`,
  );
  console.log(`  TEETH/loop: un-drained pass counter caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});
