// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence test for perFrame (ROM 0x00B5) — the per-frame service + game-state
 * dispatch tail of the vblank NMI: decrement FRAME, run the three once-per-frame service
 * routines (PRNG stir, coin service, sound tick), dispatch the current GAME_STATE through
 * the 4-entry ROM table at 0x00CA, then the interrupt-return epilogue.
 *
 * This is the CYCLE-FREE / memory-equivalence gate (docs/decompiler-pipeline), not the retired strict
 * whole-machine one. perFrame WRITES RAM everywhere (frame counter, PRNG, coin/credit and
 * sound/task state, and whatever the GAME_STATE handler dispatches), so every case uses a
 * FRESH clone per side. The contract compared is:
 *
 *     RAM (dumpState, minus STACK_SCRATCH)  +  SP  +  pc.
 *
 * Like serviceVblankNmi's gate, SP and pc ARE faithful and part of the contract here:
 * perFrame's epilogue restores the interrupted SP (entry SP + 14) and pops the interrupted
 * PC (from entry SP + 12). Only the register FILE is excluded — the oracle's saved-register
 * VALUES are the interrupt ABI the direct-call layer drops, and every push/pop lands in the
 * excluded STACK_SCRATCH region (the DK NMI stack never dips below 0x6be0).
 *
 * CAPTURE — 0x00b5 is NOT reached through the m.call registry (entry_0066 falls straight
 * into perFrame with a direct call), so it cannot be hooked via the override map. Instead
 * we wrap the host's fireNmi and MIRROR entry_0066's prologue exactly up to perFrame's
 * entry — accept the NMI (push PC, +11t), then ack / watchdog / sprite-DMA blit / read
 * controls when a game is in play / reserve the 12-byte register frame — clone at that
 * instant (the precise state perFrame is entered with), then run the ORACLE perFrame so the
 * host run proceeds undisturbed. That inlined prologue IS serviceVblankNmi's body minus
 * perFrame (proven equivalent to entry_0066), so the host advances faithfully. Two host
 * runs feed the gate: a plain attract run (GAME_STATE 0/1) and a driven coin+start run
 * (GAME_STATE 2/3), so all four dispatch arms are covered by REAL captured entries.
 *
 * Jobs:
 *   1. EQUAL (captured perFrame entries) — over attract + driven captures spanning all
 *      four GAME_STATE arms, oracle vs perFrame leave identical RAM(−stack) + SP + pc. The
 *      FULL oracle GAME_STATE handler runs on both sides, so a wrong dispatch target or a
 *      live register/flag handoff would surface as divergent RAM.
 *   2. TEETH A (the frame decrement) — a twin that OMITS `dec (FRAME)` MUST be caught
 *      (at FRAME 0x601A, the routine's headline side effect).
 *   3. TEETH B (the epilogue unwind) — a twin that discards one register too few (SP set
 *      to frameBase+10, not +12, before `ret`) MUST be caught at SP/pc.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-00b5.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_00b5 as oraclePerFrame } from "../../translated/loc_00b5.js";
import { perFrame } from "../perFrame.js";
import { blitSpritesViaDma } from "../blitSpritesViaDma.js";
import { loc_0087 } from "../../translated/loc_0087.js";
import { Machine } from "../../machine.js";
import { NotImplemented } from "../../../../boards/dkong/io.js";
import { STACK_SCRATCH, ATTRACT, GAME_STATE, FRAME } from "../ram.js";

// The four GAME_STATE handlers (same references perFrame folds the 0x00CA table into),
// re-imported here so the teeth twins can reproduce perFrame's structure with one bug.
import { stirRandomSeed } from "../stirRandomSeed.js";
import { serviceCoinInput } from "../serviceCoinInput.js";
import { soundDriverTick } from "../soundDriverTick.js";
import { runAttractState } from "../runAttractState.js";
import { dispatchInGameSubstate } from "../dispatchInGameSubstate.js";
import { loc_01c3 } from "../../translated/loc_01c3.js";
import { loc_08b2 } from "../../translated/loc_08b2.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const hx = (v) => "0x" + (v & 0xffff).toString(16);

const NMI_ENABLE = 0x7d84; // NMI-enable latch (io); write 1 re-arms
const IN2_WATCHDOG = 0x7d00; // IN2 read = watchdog kick; bit 0 = SERVICE
const DMA_SETUP_BLOCK = 0x0138;

const NMI_GAME_STATE = [loc_01c3, runAttractState, loc_08b2, dispatchInGameSubstate];

// The 06fe test's coin+start tape: coin on IN2 bit7 @f10, start1 on IN2 bit2 @f30 — credits
// and starts a game so GAME_STATE walks 0 -> 1 -> 2 -> 3.
const COIN_START_TAPE = [
  { port: 0x7d00, bits: 0x80, frame: 10, dur: 6 }, // coin  (IN2 bit7)
  { port: 0x7d00, bits: 0x04, frame: 30, dur: 6 }, // start (IN2 bit2)
];

const inDeadStack = (addr) => addr != null && addr >= STACK_SCRATCH.lo && addr < STACK_SCRATCH.hi;

/**
 * First divergence on the go-forward contract, or null: RAM (dumpState, minus the dead
 * STACK_SCRATCH region), then SP, then pc. One masked forward scan (the oracle leaves many
 * benign dead-stack diffs — the register-save frame it writes and this layer does not).
 */
function contractDiff(ma, mb) {
  const a = ma.dumpState();
  const b = mb.dumpState();
  const n = Math.min(a.length, b.length);
  for (let off = 0; off < n; off++) {
    if (a[off] === b[off]) continue;
    const addr = ma.stateOffsetToAddr(off);
    if (inDeadStack(addr)) continue;
    return { kind: "ram", addr, a: a[off], b: b[off] };
  }
  if (ma.regs.sp !== mb.regs.sp) return { kind: "sp", a: ma.regs.sp, b: mb.regs.sp };
  if (ma.pc !== mb.pc) return { kind: "pc", a: ma.pc, b: mb.pc };
  return null;
}

/**
 * Capture up to `perState` real perFrame-ENTRY states per distinct GAME_STATE over a host
 * run. 0x00b5 is not in the m.call registry (entry_0066 calls perFrame directly), so we
 * wrap fireNmi and MIRROR entry_0066's prologue up to perFrame's entry, clone there, then
 * run the ORACLE perFrame so the host proceeds. Per-state capping guarantees the brief
 * arms (power-on, credited) are not crowded out by the dominant one.
 */
function capturePerFrameEntries({ tape, perState, maxFrames }) {
  const caps = [];
  const perCount = new Map();
  const host = new Machine(ROM);
  if (tape) host.inputTape = tape.map((t) => ({ ...t }));
  const origFire = host.fireNmi.bind(host);
  host.fireNmi = function () {
    if (!this.pcKnown) return origFire(); // let the real guard throw its diagnostic
    // -- entry_0066 prologue, mirrored up to perFrame's entry (0x00b5) --
    this.nmiCount += 1;
    this.push16(this.pc); // NMI accept: push the interrupted PC ...
    this.cycles += 11; //             ... and charge the 11-t accept cost
    // Save the interrupted context — the REAL 12-byte register frame (not a bare SP
    // reserve): this host run spans thousands of frames, and the oracle perFrame epilogue
    // pops these back, so the interrupted main loop must get its true registers restored
    // or it corrupts. (A bare reserve is fine only for the isolated one-shot gate.)
    this.push16(this.regs.af);
    this.push16(this.regs.bc);
    this.push16(this.regs.de);
    this.push16(this.regs.hl);
    this.push16(this.regs.ix);
    this.push16(this.regs.iy);
    this.mem.write8(NMI_ENABLE, 0); // ack / clear the NMI mask
    if (this.mem.read8(IN2_WATCHDOG) & 0x01) {
      // SERVICE switch — never asserted in attract/driven; entry_0066 would jp 0x4000.
      throw new NotImplemented("SERVICE switch held during capture (unexpected)");
    }
    this.regs.hl = DMA_SETUP_BLOCK;
    blitSpritesViaDma(this); // sprite DMA blit
    if (this.mem.read8(ATTRACT) === 0) loc_0087(this); // credited game reads input
    // -- perFrame entry (SP now sits below the 12-byte register frame + return PC) --
    const st = this.mem.read8(GAME_STATE);
    const c = perCount.get(st) || 0;
    if (c < perState) {
      perCount.set(st, c + 1);
      caps.push(this.clone());
    }
    return oraclePerFrame(this); // advance the host to NMI completion
  };
  host.runFrames(maxFrames);
  return caps;
}

const CAPS = ROM_PRESENT
  ? [
      ...capturePerFrameEntries({ perState: 12, maxFrames: 2600 }), //         attract: state 0/1
      ...capturePerFrameEntries({ tape: COIN_START_TAPE, perState: 12, maxFrames: 1500 }), // driven: 2/3
    ]
  : [];

// -- 1. EQUAL (captured perFrame entries) -------------------------------------

test("EQUAL: real captured perFrame entries — perFrame == oracle (RAM −stack, SP, pc)", () => {
  assert.ok(CAPS.length >= 1, "expected at least one real perFrame entry across the runs");

  const states = new Set();
  for (const cap of CAPS) {
    const o = cap.clone();
    const c = cap.clone();
    oraclePerFrame(o);
    perFrame(c);

    const d = contractDiff(o, c);
    assert.equal(
      d,
      null,
      d &&
        (d.kind === "ram"
          ? `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b} ` +
            `(GAME_STATE ${hx(cap.mem.read8(GAME_STATE))})`
          : `${d.kind} diff: oracle=${hx(d.a)} idiomatic=${hx(d.b)}`),
    );
    states.add(cap.mem.read8(GAME_STATE));
  }

  // Non-vacuous coverage: attract exercises the idiomatic attract handler (state 1), the
  // driven run the idiomatic in-game dispatcher (state 3); both idiomatic dispatch arms
  // plus at least one oracle arm must have been reached.
  assert.ok(states.has(1), "expected a GAME_STATE 1 (attract) capture");
  assert.ok(states.has(3), "expected a GAME_STATE 3 (in-game) capture from the driven run");
  console.log(
    `  EQUAL: ${CAPS.length} perFrame entries identical (RAM −stack, SP, pc); ` +
      `GAME_STATE seen={${[...states].sort().join(",")}}`,
  );
});

// -- 2. TEETH A (the frame decrement) -----------------------------------------

// Broken twin: identical to perFrame but OMITS `dec (FRAME)`. Everything else — services,
// dispatch, epilogue — is faithful, so the divergence is the un-advanced frame clock.
function brokenNoFrameDec(m) {
  const { regs, mem } = m;
  const frameBase = regs.sp;
  // BUG: no `mem.write8(FRAME, (mem.read8(FRAME) - 1) & 0xff)`.
  stirRandomSeed(m);
  serviceCoinInput(m);
  soundDriverTick(m);
  NMI_GAME_STATE[mem.read8(GAME_STATE)](m);
  mem.write8(NMI_ENABLE, 1);
  regs.sp = (frameBase + 12) & 0xffff;
  m.ret();
}

test("TEETH A: omitting the frame decrement is CAUGHT", () => {
  const base = CAPS[0];
  perFrame(base.clone()); // the correct routine runs clean on this state
  const o = base.clone();
  const c = base.clone();
  oraclePerFrame(o);
  brokenNoFrameDec(c);
  const d = contractDiff(o, c);
  assert.notEqual(d, null, "the gate FAILED to catch an omitted frame decrement — it is worthless");
  console.log(`  TEETH A: omitted dec (FRAME) caught (${d.kind} @ ${hx(d.addr ?? d.a)})`);
});

// -- 3. TEETH B (the epilogue unwind) -----------------------------------------

// Broken twin: identical to perFrame but discards one register too few in the epilogue —
// SP set to frameBase+10 (not +12) before `ret`, so `ret` pops the wrong PC and SP lands
// two low. Everything else is faithful, so it must be caught at SP/pc.
function brokenEpilogueOffByOne(m) {
  const { regs, mem } = m;
  const frameBase = regs.sp;
  mem.write8(FRAME, (mem.read8(FRAME) - 1) & 0xff);
  stirRandomSeed(m);
  serviceCoinInput(m);
  soundDriverTick(m);
  NMI_GAME_STATE[mem.read8(GAME_STATE)](m);
  mem.write8(NMI_ENABLE, 1);
  regs.sp = (frameBase + 10) & 0xffff; // BUG: should be +12
  m.ret();
}

test("TEETH B: an off-by-one epilogue unwind is CAUGHT at SP/pc", () => {
  const base = CAPS[0];
  const o = base.clone();
  const c = base.clone();
  oraclePerFrame(o);
  brokenEpilogueOffByOne(c);
  const d = contractDiff(o, c);
  assert.notEqual(d, null, "the gate FAILED to catch an off-by-one epilogue unwind — it is worthless");
  assert.ok(d.kind === "sp" || d.kind === "pc", `expected an SP/pc catch, got ${d.kind}`);
  console.log(`  TEETH B: off-by-one epilogue caught (${d.kind}: oracle=${hx(d.a)} broken=${hx(d.b)})`);
});
