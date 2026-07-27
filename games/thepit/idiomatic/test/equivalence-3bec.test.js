// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for showBonusScreen (ROM 0x3bec, The Pit) — the tier-selected status
 * screen: two gameplay config bytes choose a tier count (5 / 10 / 15), the routine paints
 * the shared fixed panel plus three text rows (the top two picked by tier), then holds the
 * screen for `count` passes, each playing a sound, adding to the score, cycling a colour
 * band, and waiting fifteen frames.
 *
 * TWO WRINKLES this routine forces (both shared with the sibling showSetupScreen 0x3a6f):
 *
 *   1. WHY A CRAFTED ENTRY. 0x3bec is reached only from the round/mode transition (0x02fd),
 *      never during idle attract — confirmed: 0 dispatches in a 6000-frame boot run. So the
 *      gate runs it from a REAL captured round-setup state: its sibling painter 0x3a6f (the
 *      round-setup screen) DOES dispatch at boot, and the state captured there is a faithful
 *      in-play round-setup machine (valid stack, board set up, HUD staged). The two config
 *      bytes are then poked identically on both sides to reach all three tiers (5/10/15) —
 *      the lever that selects each text strip and each hold length — and the game-mode byte
 *      is poked to reach the active-player score path the setup state does not carry.
 *
 *   2. THE FRAME WAITS. Each hold pass calls the frame wait, which busy-loops on the
 *      per-frame countdown (0x8009) reaching 0 — driven in the live game by the per-frame
 *      interrupt, which does not fire on an isolated clone. So the harness models that
 *      once-per-frame tick with ONE hook installed IDENTICALLY on both clones: reading the
 *      watchdog (which each wait pass does once) decrements the countdown, floored at 0.
 *      Same hook on both sides -> it can only reveal a difference, never manufacture one.
 *
 * THE CONTRACT IS OBSERVABLE-RAM EQUIVALENCE, STACK SCRATCH EXCLUDED. The oracle wraps every
 * callee in a stack push + return, while the idiomatic routine calls its already-decompiled
 * leaves directly (only the frame wait, which models its own return, is handed a return
 * slot), so the two leave DIFFERENT dead bytes in the work stack just below the entry stack
 * pointer. Measured, the entire divergence is six bytes in [0x83f5, 0x83fa]; every video /
 * colour / work RAM cell the screen produces is byte-identical. So the diff compares the
 * whole state EXCEPT a stack-scratch window at the top of work RAM, and excludes pc + SP +
 * the dead register file (the honest-signature live-out is memory-only; the oracle's tail
 * return is not modelled here because pc/SP are out of contract).
 *
 * CHECKS:
 *   0. HARNESS   — the real 0x3a6f entry is captured; oracle vs oracle is deterministic and
 *      the hold drains the tier counter to 0.
 *   1. EQUAL     — over the tier sweep {5,10,15}, idiomatic == oracle outside the stack
 *      scratch, the tier counter drains to 0, and the paint changed the same nonzero set of
 *      cells the oracle did.
 *   2. EQUAL (active score) — with the mode byte forced to an in-play player, idiomatic ==
 *      oracle across the same tiers, and the score really moved (the loop's add fired).
 *   3. MIRROR    — a parameterised twin at default options reproduces the idiomatic routine
 *      exactly, so each teeth twin's only divergence is its injected bug.
 *   4. TEETH (wrong tier strip) — a twin that always paints the tier-5 strip for row one is
 *      CAUGHT in video RAM at tier 15, and is INVISIBLE at tier 5 (where that strip is
 *      correct) — proving the crafted tier is load-bearing.
 *   5. TEETH (short hold) — a twin that stops the hold one pass short is CAUGHT at the tier
 *      counter 0x800a (left non-zero).
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3bec.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3bec as oracle } from "../../translated/loc_3bec.js";
import { loc_3a6f as oracle3a6f } from "../../translated/loc_3a6f.js";
import { showBonusScreen as idiomatic } from "../showBonusScreen.js";
import { makeMachineFactory } from "../../machine.js";

// The teeth mirror drives the same idiomatic leaves, so its only divergence is its bug.
import { rowColToTileOffset } from "../rowColToTileOffset.js";
import { deriveTileWriteCursors } from "../deriveTileWriteCursors.js";
import { copyTileColumn } from "../copyTileColumn.js";
import { fillColourColumnAt } from "../fillColourColumnAt.js";
import { requestSound8 } from "../requestSound8.js";
import { addScore } from "../addScore.js";
import { cycleColumnColour } from "../cycleColumnColour.js";
import { waitFrames } from "../waitFrames.js";
import { drawSharedPanel } from "../drawSharedPanel.js";
import { TILE_COL, TILE_ROW, PLOT_RUN_LENGTH } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const CAPTURE_AT = 0x3a6f; // a sibling round-setup painter, reached at boot — a faithful entry
const CAP_FRAMES = 2500; // 0x3a6f fires at round setup during a boot run
const WATCHDOG = 0xb800; // reading it kicks the watchdog + (in the harness) ticks the countdown
const COUNTDOWN = 0x8009; // the per-frame countdown each frame-wait drains to 0
const TIER_COUNTER = 0x800a; // the tier count, drained to 0 by the hold loop
const CONFIG_A = 0x8081; // first config byte (== 4 adds a tier)
const CONFIG_B = 0x8082; // second config byte (== 3 adds a tier)
const GAME_MODE = 0x8001; // active-player gate the score add tests
const SCORE_LO = 0x8031; // low packed-BCD score byte the hold's add moves
const STACK_SCRATCH = 32; // dead-scratch headroom below the entry SP (measured reach: 6 bytes)
const RETURN_SLOT = 2; // the two return-slot bytes at/just above entry SP
const VIDEO_LO = 0x9000; // tilemap (glyph) RAM base
const VIDEO_HI = 0x9400; // one past the tilemap RAM top

// (0x8081, 0x8082) -> the tier the two +5 conditions select.
const TIERS = [
  { a: 0, b: 0, tier: 5 },
  { a: 4, b: 0, tier: 10 },
  { a: 0, b: 3, tier: 10 },
  { a: 4, b: 3, tier: 15 },
];
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- capture ------------------------------------------------------------------

/**
 * Capture the pristine machine at the first real 0x3a6f round-setup dispatch during a boot
 * run. The hook clones the entry, then runs the oracle so the host run proceeds (its
 * interrupt fires, so the frame waits terminate and the round continues).
 */
function captureRoundSetupEntry() {
  let entry = null;
  const overrides = new Map([[CAPTURE_AT, (mm) => {
    if (entry === null) entry = mm.clone();
    return oracle3a6f(mm);
  }]]);
  makeMachine(overrides).runFrames(CAP_FRAMES);
  return entry;
}

const ENTRY = ROM_PRESENT ? captureRoundSetupEntry() : null;

// -- the frame-tick harness + observable-RAM contract -------------------------

/**
 * Model the once-per-frame interrupt tick that drives each frame-wait to completion: every
 * watchdog read (a frame-wait does exactly one per pass) ticks the countdown down by one,
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

/**
 * First differing RAM byte between two machines, EXCLUDING the dead stack-scratch window
 * just below (and the two return-slot bytes at) the entry stack pointer, where the oracle's
 * per-call pushes and the idiomatic direct calls legitimately differ. Null when otherwise
 * identical.
 */
function ramDiffOutsideStack(a, b, entrySP) {
  const da = a.dumpState();
  const db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= entrySP - STACK_SCRATCH && addr < entrySP + RETURN_SLOT) continue; // dead scratch
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/** Count observable (non-stack) state cells a run changes from `entry`. */
function observableWriteCount(entry, fn, pokes) {
  const before = entry.dumpState();
  const c = entry.clone();
  applyPokes(c, pokes);
  installFrameTick(c);
  fn(c);
  const after = c.dumpState();
  const stackLo = entry.regs.sp - STACK_SCRATCH;
  const stackHi = entry.regs.sp + RETURN_SLOT;
  let n = 0;
  for (let i = 0; i < before.length; i++) {
    if (before[i] === after[i]) continue;
    const addr = c.stateOffsetToAddr(i);
    if (addr >= stackLo && addr < stackHi) continue;
    n += 1;
  }
  return n;
}

function applyPokes(m, pokes) {
  if (!pokes) return;
  if (pokes.a !== undefined) m.mem.write8(CONFIG_A, pokes.a);
  if (pokes.b !== undefined) m.mem.write8(CONFIG_B, pokes.b);
  if (pokes.mode !== undefined) m.mem.write8(GAME_MODE, pokes.mode);
}

/**
 * Run the oracle and `candidate` on two independent clones of the captured entry, with the
 * frame-tick harness on both and `pokes` (config bytes + mode) forced identically on both.
 * Returns the first RAM diff outside the stack scratch, plus both clones.
 */
function runPair(candidate, pokes) {
  const a = ENTRY.clone();
  const b = ENTRY.clone();
  applyPokes(a, pokes);
  applyPokes(b, pokes);
  installFrameTick(a);
  installFrameTick(b);
  oracle(a);
  candidate(b);
  return { ram: ramDiffOutsideStack(a, b, ENTRY.regs.sp), oracleM: a, candM: b };
}

// -- the routine body, parameterised for the teeth twins ----------------------
// Mirrors the idiomatic routine at its default options; each twin flips ONE knob so its
// only divergence from the real routine is its injected bug. A MIRROR check ties this to
// the real idiomatic routine.

const ROW1 = { hi: 0x4a2e, mid: 0x4a21, lo: 0x4a14 };
const ROW2 = { hi: 0x4a55, mid: 0x4a48, lo: 0x4a3b };

function stripForTier(count, strip) {
  if (count === 15) return strip.hi;
  if (count === 10) return strip.mid;
  return strip.lo;
}
function seatCell(m, column, row) {
  m.mem8[TILE_COL] = column;
  m.mem8[TILE_ROW] = row;
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);
}

function paintTierScreen(m, opts = {}) {
  const { mem8 } = m;
  let count = 5;
  if (mem8[CONFIG_A] === 4) count += 5;
  if (mem8[CONFIG_B] === 3) count += 5;
  mem8[TIER_COUNTER] = count;

  drawSharedPanel(m);

  seatCell(m, 15, 11);
  mem8[PLOT_RUN_LENGTH] = 12;
  copyTileColumn(m, opts.wrongRow1 ? ROW1.lo : stripForTier(count, ROW1)); // BUG hook: always the tier-5 strip

  seatCell(m, 17, 11);
  mem8[PLOT_RUN_LENGTH] = 12;
  copyTileColumn(m, stripForTier(count, ROW2));
  fillColourColumnAt(m, 17, 0xa3);

  seatCell(m, 21, 9);
  mem8[PLOT_RUN_LENGTH] = 15;
  copyTileColumn(m, 0x4a07);
  fillColourColumnAt(m, 21, 0xa6);

  let remaining;
  do {
    requestSound8(m);
    addScore(m, 16);
    cycleColumnColour(m, 15);
    m.push16(0x3cb7);
    waitFrames(m, 15);
    remaining = mem8[TIER_COUNTER] - 1;
    mem8[TIER_COUNTER] = remaining;
    if (opts.shortHold && remaining === 1) break; // BUG hook: stop one pass short
  } while (remaining !== 0);

  return m.ret();
}

// -- 0. HARNESS ---------------------------------------------------------------

test("HARNESS: a real 0x3a6f round-setup entry is captured and the oracle run of 0x3bec is deterministic", () => {
  assert.ok(ENTRY, "expected 0x3a6f to be dispatched at round setup during the boot run");

  const { ram, oracleM } = runPair(oracle, { a: 4, b: 3 }); // idiomatic arm = the oracle itself
  assert.equal(ram, null, ram && `oracle run not deterministic: diff at ${hx(ram.addr ?? 0)}`);
  assert.equal(oracleM.mem.read8(TIER_COUNTER), 0, "the hold must drain the tier counter to 0");
  console.log(`  HARNESS: captured a real 0x3a6f entry (SP=${hx(ENTRY.regs.sp)}); oracle run of 0x3bec deterministic, hold drained`);
});

// -- 1. EQUAL over the tier sweep ---------------------------------------------

test("EQUAL (tier sweep 5/10/15): idiomatic == oracle over RAM outside the stack scratch", () => {
  for (const { a, b, tier } of TIERS) {
    const { ram, candM } = runPair(idiomatic, { a, b });
    assert.equal(ram, null, ram && `tier ${tier} (0x8081=${a},0x8082=${b}): RAM diverged at ${hx(ram.addr ?? 0)} (oracle=${ram.a} idiomatic=${ram.b})`);
    assert.equal(candM.mem.read8(TIER_COUNTER), 0, `tier ${tier}: hold must drain the tier counter to 0`);

    const writes = observableWriteCount(ENTRY, idiomatic, { a, b });
    assert.ok(writes > 40, `tier ${tier}: expected the paint to change many display cells, got ${writes}`);
    assert.equal(observableWriteCount(ENTRY, oracle, { a, b }), writes, `tier ${tier}: idiomatic changed a different number of cells than the oracle`);
  }
  console.log("  EQUAL/sweep: all three tiers identical to the oracle (each text strip + hold length), tier counter drained");
});

// -- 2. EQUAL with the active-player score path exercised ---------------------

test("EQUAL (active score): with an in-play player the score add fires and idiomatic == oracle", () => {
  for (const { a, b, tier } of TIERS) {
    const { ram } = runPair(idiomatic, { a, b, mode: 1 });
    assert.equal(ram, null, ram && `tier ${tier}, player 1: RAM diverged at ${hx(ram.addr ?? 0)} (oracle=${ram.a} idiomatic=${ram.b})`);
  }

  // Prove the loop's score add actually moved the score in the in-play mode (and did not in
  // the idle mode), so the active-score path was genuinely exercised above.
  const active = ENTRY.clone(); applyPokes(active, { a: 0, b: 0, mode: 1 }); installFrameTick(active);
  const idle = ENTRY.clone(); applyPokes(idle, { a: 0, b: 0, mode: 0 }); installFrameTick(idle);
  const scoreBefore = ENTRY.mem.read8(SCORE_LO);
  idiomatic(active);
  idiomatic(idle);
  assert.notEqual(active.mem.read8(SCORE_LO), scoreBefore, "the in-play hold must add to the score");
  assert.equal(idle.mem.read8(SCORE_LO), scoreBefore, "the idle-mode hold must leave the score untouched");
  console.log("  EQUAL/score: active-player hold adds score, idle hold does not — idiomatic == oracle in both");
});

// -- base fidelity: the teeth mirror IS the routine at default options --------

test("MIRROR: paintTierScreen() at default options == idiomatic showBonusScreen (so each twin's only diff is its bug)", () => {
  for (const { a, b, tier } of TIERS) {
    const { ram } = runPair((m) => paintTierScreen(m), { a, b });
    assert.equal(ram, null, ram && `tier ${tier}: mirror diverges from idiomatic at ${hx(ram.addr ?? 0)} (oracle=${ram.a} mirror=${ram.b})`);
  }
  console.log("  MIRROR: the parameterised twin base reproduces the routine exactly across all tiers");
});

// -- 3. TEETH: a wrong tier text strip ----------------------------------------

test("TEETH (wrong tier strip): the tier-5 strip forced at tier 15 is CAUGHT in video RAM, invisible at tier 5", () => {
  // At tier 15 the correct row-1 strip is the 15-strip; forcing the 5-strip paints wrong glyphs.
  const caught = runPair((m) => paintTierScreen(m, { wrongRow1: true }), { a: 4, b: 3 });
  assert.ok(caught.ram, "the gate FAILED to catch a wrong tier strip — it is worthless");
  assert.ok(
    caught.ram.addr >= VIDEO_LO && caught.ram.addr < VIDEO_HI,
    `expected a video-RAM diff, got ${hx(caught.ram.addr)}`,
  );

  // At tier 5 the row-1 strip IS the 5-strip, so the same twin is byte-identical — the
  // crafted tier is what makes this teeth bite.
  const hidden = runPair((m) => paintTierScreen(m, { wrongRow1: true }), { a: 0, b: 0 });
  assert.equal(hidden.ram, null, "the wrong-strip twin must be invisible at tier 5 (where that strip is correct)");
  console.log(`  TEETH/strip: caught at tier 15 in video RAM ${hx(caught.ram.addr)} (oracle=${caught.ram.a} broken=${caught.ram.b}), hidden at tier 5`);
});

// -- 4. TEETH: a hold that stops one pass short -------------------------------

test("TEETH (short hold): a hold that stops one pass short is CAUGHT at the tier counter", () => {
  const { ram } = runPair((m) => paintTierScreen(m, { shortHold: true }), { a: 0, b: 0 });
  assert.ok(ram, "the gate FAILED to catch a short hold — it is worthless");
  assert.equal(ram.addr, TIER_COUNTER, `expected the short hold caught at ${hx(TIER_COUNTER)}, got ${hx(ram.addr ?? 0)}`);
  assert.equal(ram.a, 0, "the oracle drains the tier counter to 0");
  assert.notEqual(ram.b, 0, "the short-hold twin leaves it non-zero");
  console.log(`  TEETH/hold: short hold caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});
