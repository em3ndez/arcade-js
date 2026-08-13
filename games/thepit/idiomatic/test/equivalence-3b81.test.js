// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for showFixedScreen (ROM 0x3b81, The Pit) — the routine
 * that paints a canned full-screen tile image from ROM, tints the whole display one
 * flat colour, and holds it for a fixed spell before returning to its caller.
 *
 * THE WRINKLE this routine forces (inherited from waitFrames): it makes two frame
 * waits, each of which busy-waits on the per-frame countdown cell (0x8009) reaching 0.
 * Nothing in the code drives that countdown — in the live game the per-frame interrupt
 * decrements it once a frame. Run in isolation on a clone (whose frame machinery is
 * neutralised, so no interrupt fires) those loops would never terminate. So the harness
 * models that once-per-frame tick with ONE hook installed IDENTICALLY on both clones:
 * reading the watchdog (which each frame-wait pass does exactly once) decrements the
 * countdown by one, floored at 0. Being the same hook on both sides, it can only ever
 * reveal a difference between oracle and idiomatic, never manufacture one.
 *
 * The memory-observable output is the full tilemap image (video RAM 0x9000..0x93ff),
 * the flooded colour RAM (0x8800..0x8bff), and the countdown left at 0 — all real work /
 * video / colour RAM. The register file the paint leaves is dead, and the idiomatic layer
 * does NOT preserve the Z80 pc/SP (it dissolves the oracle's stack-threaded calls into
 * direct calls), so pc and SP are intentionally not compared — this is the MEMORY-equivalence
 * contract, the same one showSetupScreen (0x3a6f) and collectLootTile (0x18cf) use.
 *
 * THE STACK SCRATCH. This routine HARD-RESETS the stack (it reloads SP), leaving a dead
 * return-slot "ghost" in the top-of-stack bytes AROUND the entry SP (0x83fd) — both just
 * below it and at/above it — that the stack-free idiomatic never writes. Those bytes are
 * classic dead scratch (overwritten by the caller's next push before anything reads them),
 * and no real cell (video, colour, or work RAM) differs. So the RAM diff EXCLUDES exactly
 * that window (0x83f9..0x83fe) and compares every real cell byte-for-byte — the teeth
 * confirm the window hides no real output.
 *
 * CHECKS:
 *   1. EQUAL — idiomatic == oracle on the real captured boot/attract dispatch, over RAM
 *      outside the dead stack scratch, with the frame-tick harness on both sides.
 *   2. TEETH — a twin that floods the wrong flat colour is CAUGHT at a REAL colour-RAM cell;
 *      a twin that corrupts the copied image is CAUGHT at a REAL video-RAM cell.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3b81.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3b81 as oracle } from "../../translated/loc_3b81.js";
import { showFixedScreen as idiomatic } from "../showFixedScreen.js";
import { makeMachineFactory } from "../../machine.js";

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

const TARGET = 0x3b81; // loc_3b81 / showFixedScreen
const COUNTDOWN = 0x8009; // the per-frame countdown the two frame-waits drain to 0
const WATCHDOG = 0xb800; // reading it kicks the watchdog (once per busy-wait pass)
const COLOR_CELL = 0x8800; // first colour-RAM cell the flat-colour flood writes
const VIDEO_LAST = 0x93ff; // last tilemap cell the image copy writes
// The routine reloads SP, so its dead return-slot ghost straddles the entry SP (0x83fd):
// bytes below it AND at/above it. Excluded from the RAM diff — measured span 0x83f9..0x83fe.
const STACK_SCRATCH_LO = 0x83f9; // first dead top-of-stack byte
const STACK_SCRATCH_HI = 0x83fe; // last dead top-of-stack byte
const CAPTURE_FRAMES = 700; // 0x3b81 dispatches once at ~frame 530; the paint holds ~160 more
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture the machine state at the FIRST real 0x3b81 dispatch. The hook clones the
 * pristine entry, then runs the real oracle so the host run proceeds — in the live
 * host the interrupt fires, so both frame waits terminate normally.
 */
function captureEntry() {
  let entry = null;
  const overrides = new Map([
    [TARGET, (mm) => {
      if (entry === null) entry = mm.clone();
      return oracle(mm);
    }],
  ]);
  const host = makeMachine(overrides);
  host.runFrames(CAPTURE_FRAMES);
  return entry;
}

const ENTRY = ROM_PRESENT ? captureEntry() : null;

/**
 * Model the once-per-frame interrupt tick that drives each frame-wait to completion:
 * every watchdog read (a frame-wait does exactly one per pass) ticks the countdown down
 * by one, floored at 0 so the loops are guaranteed to terminate. Installed identically
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

/**
 * First differing RAM byte between two machines, EXCLUDING the dead top-of-stack scratch
 * window (0x83f9..0x83fe) the SP-resetting routine parks around the entry stack pointer and
 * the stack-free idiomatic never writes. Null when otherwise identical.
 */
function ramDiffOutsideStack(a, b) {
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

/**
 * Run the oracle and a candidate on two independent clones of the real captured entry,
 * with the frame-tick harness on both, and diff the MEMORY-equivalence contract: RAM
 * outside the dead top-of-stack scratch. (The dead register file, pc, and SP are not
 * compared — the idiomatic layer does not preserve the Z80 pc/SP.)
 */
function runPair(candidate) {
  const a = ENTRY.clone();
  const b = ENTRY.clone();
  installFrameTick(a);
  installFrameTick(b);

  oracle(a);
  candidate(b);

  return {
    ram: ramDiffOutsideStack(a, b),
    countdownLanded: a.mem.read8(COUNTDOWN),
  };
}

// -- 1. EQUAL: idiomatic == oracle on the real captured dispatch ---------------

test("EQUAL: idiomatic == oracle on the captured 0x3b81 dispatch (RAM outside dead stack scratch)", () => {
  assert.ok(ENTRY, "captured the real boot/attract 0x3b81 dispatch");
  assert.equal(ENTRY.regs.a, 0x00, "the routine has no register live-in (entry A is incidental 0)");

  const r = runPair(idiomatic);
  assert.equal(r.ram, null, r.ram && `RAM diverged at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} idiomatic=${r.ram.b})`);
  assert.equal(r.countdownLanded, 0, "both frame waits must drain the countdown to 0");
  console.log("  EQUAL: full paint + hold identical to the oracle (RAM outside dead stack scratch)");
});

// -- 2. TEETH: broken twins the gate MUST catch -------------------------------

/** Broken twin A: paints correctly, then floods the wrong flat colour into one cell. */
function brokenFloodColour(m) {
  idiomatic(m);
  m.mem.write8(COLOR_CELL, m.mem.read8(COLOR_CELL) ^ 0xff); // BUG: wrong flat-colour attribute
}

/** Broken twin B: paints correctly, then corrupts a copied image cell. */
function brokenCopyImage(m) {
  idiomatic(m);
  m.mem.write8(VIDEO_LAST, m.mem.read8(VIDEO_LAST) ^ 0xff); // BUG: wrong tile in the copied image
}

test("TEETH: a wrong flat colour is CAUGHT in colour RAM", () => {
  const r = runPair(brokenFloodColour);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a wrong colour flood — it is worthless");
  assert.equal(r.ram.addr, COLOR_CELL, `teeth caught the wrong address ${hx(r.ram.addr ?? 0)} (expected ${hx(COLOR_CELL)})`);
  console.log(`  TEETH: wrong colour caught at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

test("TEETH: a corrupted image cell is CAUGHT in video RAM", () => {
  const r = runPair(brokenCopyImage);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a corrupted image — it is worthless");
  assert.equal(r.ram.addr, VIDEO_LAST, `teeth caught the wrong address ${hx(r.ram.addr ?? 0)} (expected ${hx(VIDEO_LAST)})`);
  console.log(`  TEETH: corrupted image caught at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});
