// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_02ca (ROM 0x02ca, The Pit) — the one-time round-start
 * setup: make the selected player's saved progress live, decode the dip switches, unmute
 * the audio, build the board screen and play the round-start sound, then hold an intro
 * (repaint the "MEN LEFT" / "PLAYERS" HUD panels and one playfield strip over eight short
 * frame-waits) before tail-jumping into the round-loop setup (0x031a), which never returns.
 *
 * WHY A CRAFTED ENTRY. loc_02ca runs during boot, before attract, and is never dispatched
 * in a plain boot/attract run (0 dispatches in 300 frames — the demo never starts a round),
 * so there is no real dispatch to snapshot. Per the crafted-entry method the gate captures a
 * real attract machine state — realistic full RAM, the oracle registry, a live stack — by
 * hooking a routine attract DOES reach (loc_3dae, the tile-offset calc entered within the
 * first ~100 frames) and cloning the machine the first time it fires. loc_02ca takes no
 * register inputs (it reads its inputs from RAM / the dip switches / constants), so one real
 * captured state exercises its whole straight-line path. The setup body reuses loc_3dae
 * itself (through the strip painters), but after capture the hook just delegates to the
 * oracle, so it adds no divergence between the two arms.
 *
 * TWO HARNESS PIECES both arms share, so neither can fork the result:
 *   - THE FRAME-WAITS busy-wait on the per-frame countdown cell (0x8009) that the interrupt
 *     drains once a frame in the live game; run in isolation no interrupt fires, so the waits
 *     would never terminate. One identical hook on both clones models that tick — each
 *     watchdog read (the wait does exactly one per pass) decrements the countdown, floored at
 *     0 — exactly the discipline the waitFrames gate uses.
 *   - THE TAIL round-loop setup 0x031a runs the round forever (it never returns on hardware),
 *     so running either arm into it would hang. Both arms tail-jump to the SAME 0x031a, so it
 *     contributes nothing to any DIFFERENCE between them; it is stubbed with a no-op, installed
 *     at capture so the cloned entries inherit it.
 *
 * THE CONTRACT is observable-RAM equivalence: the work / colour / video / sprite RAM the
 * routine leaves. pc, SP and the value registers/flags are EXCLUDED — the idiomatic layer
 * does not preserve the Z80 register trace, and this routine has no genuine register live-out
 * (it tail-jumps into the round loop and the caller's return is carried by 0x031a). ONE
 * WRINKLE: the dissolved setup/loop calls no longer push their return addresses onto the work
 * stack, so the oracle parks a few return-address ghosts in the dead scratch just below the
 * entry stack pointer that the stack-free idiomatic calls do not. The oracle's deepest push
 * reaches only six bytes below entry SP (measured), and no game-observable cell lives in the
 * stack area (0x83xx) — every named work cell sits at/below 0x823f and colour RAM starts at
 * 0x8800 — so the RAM diff EXCLUDES a small window just below entry SP and compares every real
 * cell byte-for-byte.
 *
 * Three checks, the gate's two directions:
 *   1. EQUAL (real captured entry) — idiomatic leaves RAM byte-identical to the oracle outside
 *      the dead stack window, and the observable effects hold: the intro loop drains the loop
 *      counter to 0 and the round-start sound (command 4) is queued.
 *   2. TEETH (dropped HUD panel) — a twin that forgets to paint the "MEN LEFT" panel is CAUGHT
 *      in the colour/video RAM those glyph cells occupy, well outside the stack window.
 *   3. TEETH (intro loop left un-drained) — a twin that leaves the loop counter non-zero is
 *      CAUGHT at the loop-counter cell.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-02ca.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_02ca as oracle } from "../../translated/loc_02ca.js";
import { loc_02ca as idiomatic } from "../loc_02ca.js";
import { loc_3dae as reachableOracle } from "../../translated/loc_3dae.js";

// The callees the dropped-HUD-panel teeth twin reuses (everything except drawMenLeftPanel).
import { loadPlayerState } from "../loadPlayerState.js";
import { applyDipSwitches } from "../applyDipSwitches.js";
import { enableSound } from "../enableSound.js";
import { loc_4b40 } from "../loc_4b40.js";
import { requestSound4 } from "../requestSound4.js";
import { drawPlayerLabel } from "../drawPlayerLabel.js";
import { waitFrames } from "../waitFrames.js";
import { loc_4816 } from "../loc_4816.js";

import { makeMachineFactory } from "../../machine.js";
import { LOOP_COUNTER, SOUND_HEAD, SOUND_RING } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const PROXY = 0x3dae; // a routine attract DOES reach; hooked to capture a real machine state
const TAIL = 0x031a; // the round-loop setup loc_02ca tail-jumps to; stubbed (never returns)
const COUNTDOWN = 0x8009; // the per-frame countdown cell the frame-waits drain to 0
const WATCHDOG = 0xb800; // reading it kicks the watchdog (once per busy-wait pass)
const ROUND_START_SOUND = 4 | 0x80; // 0x84 — the pending-marked command requestSound4 queues
const STACK_WINDOW = 16; // dead stack-scratch just below entry SP (oracle's deepest push is -6)
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture one real attract machine state to seed crafted entries. loc_02ca itself is never
 * dispatched in attract, so hook a routine that IS (loc_3dae, entered within the first ~100
 * frames) and clone the machine the first time it fires. The never-returning round-loop setup
 * 0x031a is stubbed on the host so the cloned entries inherit the stub and loc_02ca's tail
 * jump returns instead of running the round forever.
 */
function captureSeed() {
  let seed = null;
  const overrides = new Map([
    [PROXY, (mm) => {
      if (seed === null) seed = mm.clone();
      return reachableOracle(mm);
    }],
    [TAIL, () => {}], // no-op stub: identical on both arms, so it cannot fork them
  ]);
  makeMachine(overrides).runFrames(240);
  assert.ok(seed !== null, "expected loc_3dae to be dispatched during attract to seed the crafted entry");
  return seed;
}

const SEED = ROM_PRESENT ? captureSeed() : null;

/**
 * Model the once-per-frame interrupt tick that drives the frame-waits to completion: each
 * watchdog read (a wait does exactly one per pass) decrements the countdown by one, floored at
 * 0 so every wait terminates. Installed identically on both clones, so it can only expose a
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
 * Run the oracle and a candidate on two independent clones of the captured entry — both with
 * the frame-tick harness so the intro's frame-waits terminate — and diff the observable-RAM
 * contract, excluding the dead stack scratch. Returns { diffs, ram } (diffs empty == EQUAL).
 */
function contractDiffs(entry, fn) {
  const entrySP = entry.regs.sp;

  const a = entry.clone();
  installFrameTick(a);
  oracle(a);

  const b = entry.clone();
  installFrameTick(b);
  fn(b);

  const diffs = [];
  const ram = stateDiffOutsideStack(a, b, entrySP);
  if (ram) diffs.push(`RAM@${hx(ram.addr ?? 0)} oracle=${ram.a} cand=${ram.b}`);
  return { diffs, ram };
}

// -- 1. EQUAL on a real captured attract entry --------------------------------

test("EQUAL (real entry): loc_02ca == oracle over observable RAM", () => {
  const { diffs } = contractDiffs(SEED, idiomatic);
  assert.equal(diffs.length, 0, diffs.join("; "));

  // Positive checks: the observable effects really happened.
  const c = SEED.clone();
  installFrameTick(c);
  const seedHead = c.mem.read8(SOUND_HEAD);
  idiomatic(c);
  assert.equal(c.mem.read8(LOOP_COUNTER), 0, "the intro loop must drain the loop counter to 0");
  assert.equal(
    c.mem.read8(SOUND_RING + seedHead),
    ROUND_START_SOUND,
    "the round-start sound (command 4) must be queued in the ring",
  );
  assert.equal(c.mem.read8(SOUND_HEAD), (seedHead + 1) % 8, "the sound-ring write pointer must advance one slot");
  console.log(
    `  EQUAL/real: idiomatic matches oracle over full RAM (outside ${STACK_WINDOW}-byte stack scratch); ` +
      `loop drained to 0, sound ${hx(ROUND_START_SOUND)} queued at slot ${seedHead}`,
  );
});

// -- 2. TEETH: a dropped-HUD-panel twin is caught -----------------------------

/** Broken twin: the real setup + intro loop, but the "MEN LEFT" panel is never painted, so
 *  the cells it would fill stay the board-build background. Everything else is identical. */
function twinDropMenPanel(m) {
  const { mem8 } = m;
  loadPlayerState(m);
  applyDipSwitches(m);
  enableSound(m);
  m.push16(0x02d6);
  loc_4b40(m);
  requestSound4(m);
  mem8[LOOP_COUNTER] = 8;
  // BUG: drawMenLeftPanel(m) is dropped — the "MEN LEFT" panel is never painted.
  do {
    drawPlayerLabel(m);
    m.push16(0x02e9);
    waitFrames(m, 10);
    loc_4816(m);
    m.push16(0x02f1);
    waitFrames(m, 5);
    mem8[LOOP_COUNTER] = mem8[LOOP_COUNTER] - 1;
  } while (mem8[LOOP_COUNTER] !== 0);
  return m.call(TAIL);
}

test("TEETH (dropped HUD panel): skipping the MEN-LEFT panel is CAUGHT in colour/video RAM", () => {
  const { diffs, ram } = contractDiffs(SEED, twinDropMenPanel);
  assert.ok(diffs.length > 0, "the gate FAILED to catch the dropped-HUD-panel twin — it proves nothing");
  const inScreenRam =
    (ram.addr >= 0x8800 && ram.addr <= 0x8bff) || (ram.addr >= 0x9000 && ram.addr <= 0x93ff);
  assert.ok(inScreenRam, `expected the diff in colour/video RAM, got ${hx(ram.addr)}`);
  console.log(`  TEETH/panel: dropped MEN-LEFT panel caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

// -- 3. TEETH: an un-drained intro loop is caught -----------------------------

/** Broken twin: runs the real routine, then leaves the intro loop counter re-armed instead of
 *  drained to 0 — the routine's own declared observable output is wrong. */
function twinLoopNotDrained(m) {
  idiomatic(m);
  m.mem8[LOOP_COUNTER] = 8; // BUG: the intro loop counter is left non-zero
}

test("TEETH (loop not drained): a non-zero loop counter is CAUGHT at the loop-counter cell", () => {
  const { diffs, ram } = contractDiffs(SEED, twinLoopNotDrained);
  assert.ok(diffs.length > 0, "the gate FAILED to catch the un-drained loop twin — it proves nothing");
  assert.equal(
    ram && ram.addr,
    LOOP_COUNTER,
    `teeth caught the wrong address ${ram ? hx(ram.addr) : "(none)"} (expected ${hx(LOOP_COUNTER)})`,
  );
  console.log(`  TEETH/loop: un-drained loop counter caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});
