// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_021c (ROM 0x021c) — the warm-restart state entry:
 * arm game mode 3, reset the work stack, enable the frame interrupt, run the
 * blank-screen display setup, then tail-hand to the fixed-screen painter (0x3ba8),
 * which paints a canned screen and spins forever displaying it.
 *
 * WHY A CRAFTED ENTRY (not the stock unitEquivalence capture). loc_021c is reached
 * only from the boot fork loc_01f9 when the restart flag (0x8000) is nonzero, which a
 * plain boot/attract run never is — 0 dispatches in 1500 frames. So there is no real
 * dispatch of loc_021c to snapshot. Per the crafted-entry method this gate instead
 * captures a real attract machine state (realistic full RAM, the oracle registry, a
 * live stack) by hooking a routine attract DOES reach (loc_3dae, entered within the
 * first ~100 frames) and cloning the machine the first time it fires, then runs oracle
 * vs idiomatic on independent clones of that state. loc_021c takes no register inputs,
 * so one real captured state exercises its whole straight-line path.
 *
 * WHY 0x3ba8 IS STUBBED. loc_021c's exit is a tail hand-off to the fixed-screen
 * painter 0x3ba8, whose own display loop never returns (it spins forever on hardware,
 * escaped only by the watchdog). Running either arm to completion would therefore
 * hang. Both arms tail-call the SAME 0x3ba8 through the registry, so it contributes
 * nothing to any DIFFERENCE between them; the gate replaces it with a no-op stub —
 * identical on both sides — installed at construction so the captured clones inherit
 * it. That lets the gate compare everything loc_021c does up to the hand-off, which is
 * the entire behaviour that distinguishes the idiomatic rewrite from the oracle.
 *
 * THE CONTRACT is OBSERVABLE-RAM equivalence: the work/colour/video/attr+sprite RAM
 * the routine leaves. pc, SP, and the value registers/flags are EXCLUDED — the
 * idiomatic layer does not preserve the Z80 pc/register trace, and this routine has no
 * genuine register live-out (it exits into a forever loop; the caller's frame was
 * discarded by the stack reset, so nothing reads a register back). The two still-
 * oracle callees (0x4b14, 0x4b44) are handed the return address each pops, exactly as
 * the oracle leaves it, so the stack RAM is byte-identical between the arms and is
 * compared in full — there is no dead stack-scratch window to carve out here.
 *
 * Three checks, the gate's two directions:
 *   1. EQUAL (real captured entry) — idiomatic leaves RAM byte-identical to the oracle,
 *      and the observable effects hold: game mode armed to 3, the frame interrupt
 *      enabled.
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
import { loc_021c as idiomatic } from "../loc_021c.js";
import { loc_3dae as reachableOracle } from "../../translated/loc_3dae.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { GAME_MODE } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const PAINTER = 0x3ba8; // the fixed-screen painter loc_021c tail-hands to; stubbed (never returns)
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture one real attract machine state to seed crafted entries. loc_021c itself is
 * never dispatched in attract, so hook a routine that IS (loc_3dae, entered within the
 * first ~100 frames) and clone the machine the first time it fires — that gives
 * realistic full RAM, the oracle registry, and a live stack. The never-returning
 * painter 0x3ba8 is stubbed on the host so the captured clones inherit the stub and
 * loc_021c's tail hand-off returns instead of spinning forever.
 */
function captureSeed() {
  let seed = null;
  const snapshot = new Map([
    [0x3dae, (mm) => {
      if (seed === null) seed = mm.clone();
      return reachableOracle(mm);
    }],
    [PAINTER, () => {}], // no-op stub: identical on both arms, so it cannot fork them
  ]);
  makeMachine(snapshot).runFrames(240);
  assert.ok(seed !== null, "expected loc_3dae to be dispatched during attract to seed crafted entries");
  return seed;
}

/**
 * Run oracle and candidate on two independent clones of one entry and diff the
 * observable-RAM contract. Both arms tail-call the stubbed painter identically, so pc
 * and SP line up on their own and RAM is compared in full (no stack-scratch window to
 * exclude). Value registers/flags are the routine's dead-ABI residual and are not
 * compared. Returns { diffs, ram } (diffs empty == EQUAL).
 */
function contractDiffs(entry, fn) {
  const a = entry.clone();
  oracle(a);
  const b = entry.clone();
  fn(b);

  const diffs = [];
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  if (ram) diffs.push(`RAM@${hx(ram.addr ?? 0)} oracle=${ram.a} cand=${ram.b}`);
  return { diffs, ram };
}

// -- 1. EQUAL on a real captured attract entry --------------------------------

test("EQUAL (real entry): loc_021c == oracle over observable RAM", () => {
  const seed = captureSeed();

  const { diffs } = contractDiffs(seed, idiomatic);
  assert.equal(diffs.length, 0, diffs.join("; "));

  // Positive checks: the observable effects really happened.
  const c = seed.clone();
  idiomatic(c);
  assert.equal(c.mem.read8(GAME_MODE), 3, "game mode not armed to 3");
  assert.equal(c.io.nmiMask, true, "frame interrupt not enabled");
  console.log(`  EQUAL/real: idiomatic matches oracle over full RAM; GAME_MODE=3, frame interrupt enabled`);
});

// -- 2. TEETH: a wrong game-mode twin is caught -------------------------------

/** Broken twin: arms game mode 2 instead of 3; everything else identical. */
function twinWrongMode(m) {
  const { mem8, regs } = m;
  mem8[GAME_MODE] = 2; // BUG: wrong game mode
  regs.sp = 0x83ff;
  m.push16(0x0227);
  m.call(0x4b14);
  m.push16(0x022a);
  m.call(0x4b44);
  return m.call(PAINTER);
}

test("TEETH (wrong game mode): arming mode 2 instead of 3 is CAUGHT at the game-mode cell", () => {
  const seed = captureSeed();

  const { diffs, ram } = contractDiffs(seed, twinWrongMode);
  assert.ok(diffs.length > 0, "the gate FAILED to catch the wrong-game-mode twin — it proves nothing");
  assert.equal(
    ram && ram.addr,
    GAME_MODE,
    `teeth caught the wrong address ${ram ? hx(ram.addr) : "(none)"} (expected ${hx(GAME_MODE)})`,
  );
  console.log(`  TEETH/mode: wrong-mode twin caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

// -- 3. TEETH: a dropped-stack-reset twin is caught ---------------------------

/** Broken twin: skips the stack reset, so the callee return addresses land at the
 *  captured stack top instead of 0x83ff — the reset is load-bearing. */
function twinNoStackReset(m) {
  const { mem8 } = m;
  mem8[GAME_MODE] = 3;
  // BUG: no `regs.sp = 0x83ff` — pushes land wherever the captured SP happens to be.
  m.push16(0x0227);
  m.call(0x4b14);
  m.push16(0x022a);
  m.call(0x4b44);
  return m.call(PAINTER);
}

test("TEETH (dropped stack reset): skipping the stack reset is CAUGHT in the stack RAM", () => {
  const seed = captureSeed();

  const { diffs, ram } = contractDiffs(seed, twinNoStackReset);
  assert.ok(diffs.length > 0, "the gate FAILED to catch the dropped-stack-reset twin — it proves nothing");
  // The captured SP is below 0x83ff, so the mis-placed pushes diff inside work RAM's stack region.
  assert.ok(ram.addr >= 0x8000 && ram.addr <= 0x87ff, `expected a work-RAM diff, got ${hx(ram.addr)}`);
  console.log(`  TEETH/stack: dropped-reset twin caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});
