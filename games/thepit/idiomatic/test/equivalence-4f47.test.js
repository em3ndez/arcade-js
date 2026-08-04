// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for showColourTestScreen (ROM 0x4f47, The Pit) — the
 * DIP-selected colour/tile test screen. It marks the game mode as the test screen
 * (0x8001 = 9), blanks the display, then reads the debounced input byte (0x8018): unless
 * BOTH trigger bits (3 and 4) are held it re-decodes the DIP switches (tail-jump to
 * 0x4b55); with both held it runs a 128-pass colour sweep (each pass paints the tilemap
 * with a 0..255 tile ramp and floods the colour map with a stepping colour 128..255) then
 * restarts the attract cycle (tail-jump to 0x03ac).
 *
 * TWO WRINKLES this routine forces:
 *
 *   1. Never reached in plain attract. The DIP decode only hands here when the top DIP
 *      switch is set, so a boot/attract run never dispatches 0x4f47 — the capture/replay
 *      harness cannot hook it directly. Per the crafted-entry method the gate captures a
 *      REAL state at the sibling DIP-decode dispatch (0x4b55, reached at boot), which is
 *      the exact context this routine is entered from, and pokes the two levers this
 *      routine actually reads — the trigger-input byte (0x8018) and the DIP byte — to
 *      drive each branch. The idle/bail path is run to completion with the top DIP bit
 *      clear so the DIP decode returns instead of handing straight back here.
 *
 *   2. The sweep repaints over itself, then the epilogue repaints again. The sweep's
 *      product (the flooded video + colour RAM) is what the routine is FOR, but its tail-
 *      jump into the reset epilogue (0x03ac) immediately repaints the whole screen — so a
 *      run to completion would compare the epilogue's output, not the sweep's, and a sweep
 *      bug would wash out. The gate instead STOPS both arms at the exact hand-off, keyed on
 *      the epilogue's first act (clearing the mode byte to 0): a write hook installed
 *      IDENTICALLY on both clones throws the moment 0x8001 is written 0, which is the first
 *      such write after entry (this routine writes 9; the blank/flood/frame-wait never
 *      write it), freezing the sweep's output intact for the diff. The sweep's frame waits
 *      (the frame-hold between passes) are driven by one identical per-frame countdown tick
 *      hook on both clones — reading the watchdog decrements the countdown, floored at 0 —
 *      the same device the resetStateAndShowSetup / coldBootInit gates use.
 *
 * The stack scratch: the oracle wraps its callees in stack pushes + returns while the
 * idiomatic routine calls its already-decompiled leaves directly, so the two leave
 * DIFFERENT dead bytes in the work stack below the entry stack pointer. Both are classic
 * dead scratch (no routine reads work RAM in the stack-only region), so the RAM diff
 * EXCLUDES a window below the entry SP and compares everything else — all the work / colour
 * / video RAM the blank + sweep produce — byte for byte. pc / SP / value registers are
 * excluded per the memory-equivalence contract.
 *
 * CHECKS:
 *   0. HARNESS — capture the real 0x4b55 dispatch; oracle vs oracle is deterministic on
 *      both the idle branch and the sweep branch.
 *   1. EQUAL (idle branch) — with a trigger released, showColourTestScreen == oracle over
 *      RAM; the mode byte holds 9 and the screen is blanked.
 *   2. EQUAL (idle branch, input sweep) — every trigger combination that bails stays equal.
 *   3. EQUAL (sweep branch) — with both triggers held, the flooded video + colour RAM match
 *      the oracle at the epilogue hand-off; colour = 255 everywhere, the tilemap ramps
 *      0..255, the mode byte holds 9, the pass-colour scratch holds 255.
 *   4. TEETH (dropped mode store) — with 0x8001 pre-poked non-zero, a twin that SKIPS the
 *      mode=9 store is CAUGHT at 0x8001 (the store is load-bearing on the idle branch).
 *   5. TEETH (wrong sweep colour) — a twin whose sweep floods the colour map off by one bit
 *      is CAUGHT in colour RAM (the exact sweep output is inside the diff).
 *   6. TEETH (dropped sweep) — a twin that bails even with both triggers held is CAUGHT
 *      (the trigger gate + the whole sweep are load-bearing).
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4f47.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4f47 as oracle } from "../../translated/loc_4f47.js";
import { showColourTestScreen as idiomatic } from "../showColourTestScreen.js";
import { loc_4b55 as oracleDipDecode } from "../../translated/loc_4b55.js";
import { makeMachineFactory } from "../../machine.js";
import { GAME_STATE, IN0_DEBOUNCED } from "../names.js";

// Idiomatic callees for the faithful teeth twins.
import { blankScreen } from "../blankScreen.js";
import { applyDipSwitches } from "../applyDipSwitches.js";
import { waitFrames } from "../waitFrames.js";
import { resetStateAndShowSetup } from "../resetStateAndShowSetup.js";

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

const CAPTURE_AT = 0x4b55; // the DIP decode — the real dispatch this routine is entered from
const CAPTURE_FRAMES = 1500; // 0x4b55 fires early in boot
const PASS_COLOUR = 0x8012; // the pass-colour scratch the sweep steps
const VIDEO_BASE = 0x9000; // start of the tilemap
const COLOUR_BASE = 0x8800; // start of the per-cell colour map
const WATCHDOG = 0xb800; // reading it kicks the watchdog + (in the harness) ticks the countdown
const COUNTDOWN = 0x8009; // the per-frame countdown each frame-wait drains to 0
const TRIGGERS_HELD = 0x18; // input with both trigger bits (3 and 4) set -> runs the sweep
const STACK_SCRATCH_BELOW = 96; // dead scratch below the entry SP (all stack-only region)
const STACK_SCRATCH_ABOVE = 4;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/** Thrown to freeze both arms at the reset-epilogue hand-off, so the sweep's painted
 *  output is observable before the epilogue repaints over it. */
class EpilogueReached extends Error {}

/**
 * Capture the machine state at the FIRST real 0x4b55 (DIP decode) dispatch during boot.
 * The hook clones the entry, then runs the oracle DIP decode so boot proceeds (with the
 * default DIP byte 0 it does not divert here, so the run completes normally).
 */
function captureEntry() {
  let entry = null;
  const overrides = new Map([
    [CAPTURE_AT, (mm) => {
      if (entry === null) entry = mm.clone();
      return oracleDipDecode(mm);
    }],
  ]);
  makeMachine(overrides).runFrames(CAPTURE_FRAMES);
  return entry;
}

const ENTRY = ROM_PRESENT ? captureEntry() : null;

/**
 * Model the once-per-frame interrupt tick that drives each frame-wait to completion: every
 * watchdog read (a wait does exactly one per pass) ticks the countdown down by one, floored
 * at 0. Installed identically on both clones, so it can only expose a difference.
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
 * Stop both arms at the reset-epilogue hand-off, keyed on the epilogue's first act — the
 * clear of the mode byte to 0. This routine writes the mode byte 9 at entry and the blank /
 * sweep / frame-wait never write it, so the first write of 0 to 0x8001 is unambiguously the
 * hand-off. The throw fires BEFORE the store, so the frozen state keeps the mode byte at 9
 * and the full sweep output intact.
 */
function installEpilogueStop(m) {
  const mem = m.mem;
  const origWrite8 = mem.write8.bind(mem);
  mem.write8 = (addr, val) => {
    if (addr === GAME_STATE && val === 0) throw new EpilogueReached();
    origWrite8(addr, val);
  };
}

function runToEpilogue(fn, m) {
  try {
    fn(m);
  } catch (e) {
    if (!(e instanceof EpilogueReached)) throw e;
  }
}

/**
 * First differing RAM byte between two machines, EXCLUDING the dead stack-scratch window
 * below the entry stack pointer (where the oracle's per-call pushes and the idiomatic direct
 * calls legitimately differ — all in the stack-only region, no named RAM). Null otherwise.
 */
function ramDiffOutsideStack(a, b, entrySP) {
  const da = a.dumpState();
  const db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= entrySP - STACK_SCRATCH_BELOW && addr < entrySP + STACK_SCRATCH_ABOVE) continue;
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/**
 * Run the oracle and `candidate` on two clones of the captured entry, poking the trigger
 * input byte (opts.in0) and the DIP byte (opts.dsw) identically on both. On the idle branch
 * both run to completion; on the sweep branch (opts.sweep) both get the frame-tick + the
 * epilogue-stop harness and are unwound at the hand-off. opts.poke forces a work-RAM byte on
 * both sides. Returns the first RAM diff outside the stack scratch plus both clones.
 */
function runPair(candidate, opts = {}) {
  const a = ENTRY.clone();
  const b = ENTRY.clone();
  for (const c of [a, b]) {
    if (opts.in0 !== undefined) c.mem.write8(IN0_DEBOUNCED, opts.in0);
    if (opts.dsw !== undefined) c.io.dsw = opts.dsw;
    if (opts.poke) c.mem.write8(opts.poke.addr, opts.poke.val);
  }
  if (opts.sweep) {
    for (const c of [a, b]) {
      installFrameTick(c);
      installEpilogueStop(c);
    }
    runToEpilogue(oracle, a);
    runToEpilogue(candidate, b);
  } else {
    oracle(a);
    candidate(b);
  }
  return { ram: ramDiffOutsideStack(a, b, ENTRY.regs.sp), oracleM: a, candM: b };
}

// -- 0. HARNESS (reachability + determinism) ----------------------------------

test("HARNESS: the real 0x4b55 entry is captured and the oracle run is deterministic", () => {
  assert.ok(ENTRY, "expected 0x4b55 to be dispatched during boot");

  // Idle branch: a released trigger, DIP top bit clear so the decode returns.
  const idle = runPair(oracle, { in0: 0x00, dsw: 0x00 });
  assert.equal(idle.ram, null, idle.ram && `oracle idle run not deterministic: diff at ${hx(idle.ram.addr ?? 0)}`);
  assert.equal(idle.oracleM.mem.read8(GAME_STATE), 9, "the routine marks the mode byte as the test screen (9)");

  // Sweep branch: both triggers held.
  const sweep = runPair(oracle, { in0: TRIGGERS_HELD, sweep: true });
  assert.equal(sweep.ram, null, sweep.ram && `oracle sweep run not deterministic: diff at ${hx(sweep.ram.addr ?? 0)}`);
  assert.equal(sweep.oracleM.mem.read8(COLOUR_BASE), 255, "the sweep floods the colour map with its final colour (255)");
  console.log(
    `  HARNESS: captured a real 0x4b55 entry (SP=${hx(ENTRY.regs.sp)}); oracle deterministic on both branches`,
  );
});

// -- 1. EQUAL on the idle branch ----------------------------------------------

test("EQUAL (idle branch): showColourTestScreen == oracle over RAM outside the stack scratch", () => {
  const { ram, candM } = runPair(idiomatic, { in0: 0x00, dsw: 0x00 });
  assert.equal(ram, null, ram && `RAM diverged at ${hx(ram.addr ?? 0)} (oracle=${ram.a} idiomatic=${ram.b})`);

  assert.equal(candM.mem.read8(GAME_STATE), 9, "the mode byte must be marked as the test screen (9)");
  assert.equal(candM.mem.read8(COLOUR_BASE), 0, "the screen must be blanked (colour map flooded with 0)");
  console.log("  EQUAL/idle: identical observable RAM; mode byte 9, screen blanked");
});

// -- 2. EQUAL across every trigger combination that bails ----------------------

test("EQUAL (idle branch, input sweep): every not-both-held input stays equal", () => {
  const inputs = [0x00, 0x08, 0x10, 0x0f, 0xe7]; // bit 3 or bit 4 released -> bail
  for (const in0 of inputs) {
    const { ram } = runPair(idiomatic, { in0, dsw: 0x00 });
    assert.equal(ram, null, ram && `in0=${hx(in0)}: RAM diverged at ${hx(ram.addr ?? 0)} (oracle=${ram.a} idiomatic=${ram.b})`);
  }
  console.log(`  EQUAL/inputs: ${inputs.length} not-both-held inputs all RAM-equal (idle path)`);
});

// -- 3. EQUAL on the sweep branch (the flooded screen matches at the hand-off) --

test("EQUAL (sweep branch): the flooded video + colour RAM match the oracle at the epilogue hand-off", () => {
  const { ram, candM } = runPair(idiomatic, { in0: TRIGGERS_HELD, sweep: true });
  assert.equal(ram, null, ram && `RAM diverged at ${hx(ram.addr ?? 0)} (oracle=${ram.a} idiomatic=${ram.b})`);

  // Positive checks: the whole colour map holds the final colour, the tilemap ramps 0..255,
  // and the mode byte + pass-colour scratch hold their sweep-final values.
  assert.equal(candM.mem.read8(COLOUR_BASE), 255, "colour map must be flooded with the final colour (255)");
  assert.equal(candM.mem.read8(COLOUR_BASE + 1023), 255, "the whole colour map must be flooded, to the last cell");
  assert.equal(candM.mem.read8(VIDEO_BASE + 5), 5, "the tilemap ramp: cell 5 holds tile index 5");
  assert.equal(candM.mem.read8(VIDEO_BASE + 256), 0, "the tilemap ramp repeats every 256 cells (cell 256 -> 0)");
  assert.equal(candM.mem.read8(GAME_STATE), 9, "the mode byte holds the test-screen value (9) at the hand-off");
  assert.equal(candM.mem.read8(PASS_COLOUR), 255, "the pass-colour scratch holds the final pass value (255)");
  console.log("  EQUAL/sweep: identical flooded screen at the hand-off; colour=255, tile ramp 0..255, mode 9");
});

// -- 4. TEETH: a dropped mode store is caught (the store is load-bearing) -------

/** Faithful idle-branch twin with the mode=9 store OMITTED. */
function twinDropModeStore(m) {
  const { mem8 } = m;
  // BUG: the mem8[GAME_STATE] = 9 store is dropped.
  blankScreen(m);
  const input = mem8[IN0_DEBOUNCED];
  if ((input & 0x08) === 0 || (input & 0x10) === 0) return applyDipSwitches(m);
  // (unreached on the idle branch)
}

test("TEETH (dropped mode store): with 0x8001 pre-poked non-zero, skipping the mode store is CAUGHT at 0x8001", () => {
  // Sanity: with the entry pre-poked non-zero, the CORRECT routine still sets it to 9.
  const clean = runPair(idiomatic, { in0: 0x00, dsw: 0x00, poke: { addr: GAME_STATE, val: 0x55 } });
  assert.equal(clean.ram, null, clean.ram && `pre-poked entry must stay equal for the correct routine (diff at ${hx(clean.ram?.addr ?? 0)})`);
  assert.equal(clean.candM.mem.read8(GAME_STATE), 9, "the correct routine must set the pre-poked byte to 9");

  const { ram } = runPair(twinDropModeStore, { in0: 0x00, dsw: 0x00, poke: { addr: GAME_STATE, val: 0x55 } });
  assert.notEqual(ram, null, "the gate FAILED to catch the dropped mode store — the store looks dead");
  assert.equal(ram.addr, GAME_STATE, `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected ${hx(GAME_STATE)})`);
  assert.equal(ram.a, 9, "oracle sets the mode byte to 9");
  assert.equal(ram.b, 0x55, "the drop-twin leaves the pre-poked value");
  console.log(`  TEETH/mode: caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b}) — the mode store is load-bearing`);
});

// -- 5. TEETH: a wrong sweep colour is caught (the exact output is diffed) ------

/** Faithful sweep-branch twin that floods the colour map off by one bit. */
function twinWrongSweepColour(m) {
  const { mem8 } = m;
  mem8[GAME_STATE] = 9;
  blankScreen(m);
  const input = mem8[IN0_DEBOUNCED];
  if ((input & 0x08) === 0 || (input & 0x10) === 0) return applyDipSwitches(m);
  m.push16(0x4f61);
  waitFrames(m, 1);
  for (let fill = 128; fill <= 255; fill++) {
    mem8[PASS_COLOUR] = fill;
    for (let cell = 0; cell < 1024; cell++) {
      mem8[VIDEO_BASE + cell] = cell;
      mem8[COLOUR_BASE + cell] = fill ^ 1; // BUG: colour off by one bit
    }
    m.push16(0x4f7e);
    waitFrames(m, 120);
  }
  return resetStateAndShowSetup(m);
}

test("TEETH (wrong sweep colour): a colour off by one bit is CAUGHT in the colour map", () => {
  const { ram } = runPair(twinWrongSweepColour, { in0: TRIGGERS_HELD, sweep: true });
  assert.notEqual(ram, null, "the gate FAILED to catch a wrong sweep colour — the sweep output is outside the diff");
  assert.equal(ram.addr, COLOUR_BASE, `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected ${hx(COLOUR_BASE)})`);
  assert.equal(ram.a, 255, "oracle floods with 255");
  assert.equal(ram.b, 254, "the twin floods with 254 (255 ^ 1)");
  console.log(`  TEETH/colour: caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

// -- 6. TEETH: a dropped sweep is caught (the trigger gate + sweep are load-bearing) --

/** Twin that bails even with both triggers held — never runs the sweep. */
function twinDropSweep(m) {
  const { mem8 } = m;
  mem8[GAME_STATE] = 9;
  blankScreen(m);
  return applyDipSwitches(m); // BUG: ignores the triggers, never sweeps
}

test("TEETH (dropped sweep): a twin that never sweeps despite both triggers held is CAUGHT", () => {
  const { ram } = runPair(twinDropSweep, { in0: TRIGGERS_HELD, dsw: 0x00, sweep: true });
  assert.notEqual(ram, null, "the gate FAILED to catch the dropped sweep — the trigger gate looks dead");
  // The correct routine runs the sweep, whose lowest-address output is the pass-colour
  // scratch it steps to its final value (255); the twin never sweeps, so that scratch keeps
  // its entry value — the first byte the diff catches.
  assert.equal(ram.addr, PASS_COLOUR, `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected ${hx(PASS_COLOUR)})`);
  assert.equal(ram.a, 255, "oracle steps the pass-colour scratch to its final value (255)");
  assert.notEqual(ram.b, 255, "the drop-twin leaves the pass-colour scratch untouched");
  console.log(`  TEETH/sweep: caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b}) — the sweep is load-bearing`);
});
