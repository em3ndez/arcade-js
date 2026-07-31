// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for holdFixedScreen (ROM 0x3ba8, The Pit) — the routine that
 * paints a canned full-screen tile image from ROM, floods a flat background colour with
 * three accent strips over it, draws the setup panel, then holds the screen on display
 * FOREVER (a per-pass colour shimmer + DIP re-decode), never returning.
 *
 * WHY A CRAFTED ENTRY. holdFixedScreen is reached only when showCreditScreen (0x021c)
 * tail-hands to it, which happens only on the warm-restart flag a plain boot/attract run
 * never sets — so it is never dispatched in attract and there is no real snapshot to
 * capture. Per the crafted-entry method the gate captures a real attract machine state
 * (realistic full RAM, the oracle registry, a live stack) by hooking a routine attract DOES
 * reach (loc_3dae, entered within the first ~100 frames) and cloning the machine the first
 * time it fires, then runs oracle vs idiomatic on independent clones of that state. The
 * routine takes no register inputs, so one real captured state exercises its whole path.
 *
 * TWO WRINKLES this routine forces:
 *
 *  (a) THE FRAME WAITS busy-wait on the per-frame countdown cell (0x8009) reaching 0, which
 *      only the per-frame interrupt drives in the live game. Run in isolation on a clone
 *      (frame machinery neutralised) those loops would never terminate. So the harness models
 *      that once-per-frame tick with ONE hook installed IDENTICALLY on both clones: reading
 *      the watchdog (which each busy-wait pass does exactly once, and which NOTHING else in
 *      this routine's call tree reads) ticks the countdown down by one. Being the same hook on
 *      both sides it can only reveal a difference, never manufacture one.
 *
 *  (b) THE DISPLAY LOOP NEVER RETURNS (it spins forever on hardware, escaped only by the
 *      watchdog). Running either arm to completion would hang. So the same watchdog hook BOUNDS
 *      the run: after a fixed number of frame ticks it throws a sentinel, unwinding both arms at
 *      the identical point. The count — 20 watchdog reads = the setup 1-frame wait (1) + one
 *      full display pass's 15-frame wait (15) + partway into the next pass's wait (4) — is chosen
 *      so the compared state includes the ENTIRE setup AND one complete display-loop pass
 *      (shimmer + wait-drain + DIP decode). Because both arms run the identical busy-wait, the
 *      throw fires at the same logical instant on each; a rewrite that read the watchdog a
 *      different number of times would fork the compared state and be caught.
 *
 * THE CONTRACT is OBSERVABLE-RAM equivalence: the work / colour / video / sprite RAM the
 * routine leaves. pc, SP, and the value registers/flags are EXCLUDED — the idiomatic layer
 * does not preserve the Z80 pc/register trace, and this routine has no register live-out (it
 * never returns). ONE STACK WRINKLE: the oracle threads its callee returns through the work
 * stack (0x83ff down), so its nested setup/loop calls park dead return-address ghosts in the
 * bytes just below the entry stack pointer; the idiomatic arm calls those callees directly and
 * never writes them (only the still-stack-threaded waitFrames pushes a return marker, and that
 * one matches). Those are classic dead top-of-stack scratch — overwritten before anything reads
 * them, and no game-observable cell lives there (all this routine's real output sits far below,
 * at 0x804c..0x8057, 0x8800..0x8bff, 0x9000..0x93ff). So the RAM diff EXCLUDES that dead window
 * just below the entry SP and compares every real cell byte-for-byte — the teeth confirm the
 * window hides no real output.
 *
 * CHECKS:
 *   0. HARNESS — capture a real attract state; confirm entry SP sits high in the stack so the
 *      excluded window cannot reach real output, and that the bounded oracle run terminates.
 *   1. EQUAL — idiomatic == oracle on the captured entry, over RAM outside the dead stack
 *      scratch, with the frame-tick/bound harness on both sides; plus the observable effects
 *      (the canned image copied, the background flooded).
 *   2. TEETH — a twin that corrupts one flooded colour cell is CAUGHT at a REAL colour-RAM cell;
 *      a twin that corrupts one copied image cell is CAUGHT at a REAL video-RAM cell.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3ba8.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3ba8 as oracle } from "../../translated/loc_3ba8.js";
import { holdFixedScreen as idiomatic } from "../holdFixedScreen.js";
import { loc_3dae as reachableOracle } from "../../translated/loc_3dae.js";
import { makeMachineFactory } from "../../machine.js";

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

const CAPTURE_HOOK = 0x3dae; // a routine attract DOES reach, hooked to snapshot a real state
const WATCHDOG = 0xb800; // reading it kicks the watchdog (once per busy-wait pass); the only reader here
const COUNTDOWN = 0x8009; // the per-frame countdown the two frame-waits drain to 0
// 20 watchdog reads = setup wait (1) + one full display pass's wait (15) + into the next wait (4),
// so the compared state covers the whole setup and one complete display-loop pass.
const THROW_AT = 20;
const COLOR_CELL = 0x8800; // first colour-RAM cell the flat-colour flood writes (never re-touched)
const VIDEO_LAST = 0x93ff; // last tilemap cell the image copy writes (never re-touched)
const IMAGE_SOURCE = 0x4232; // ROM address of the canned full-screen image the copy reads
const BACKGROUND = 2; // the flat background colour the flood lays down
const STACK_SCRATCH = 8; // dead top-of-stack window below the entry SP the oracle's nested setup calls park a
//                          return-address ghost in (measured span entrySP-4..entrySP-3); the still-stack-threaded
//                          waitFrames pushes the same return marker on both arms, so the live top-of-stack matches.
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// A unique token thrown to bound the never-returning display loop (see wrinkle (b)).
const BOUND = Symbol("holdFixedScreen-bound");

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture one real attract machine state to seed the crafted entry. holdFixedScreen itself is
 * never dispatched in attract, so hook a routine that IS (loc_3dae, entered within the first
 * ~100 frames) and clone the machine the first time it fires — realistic full RAM, the oracle
 * registry, and a live stack.
 */
function captureEntry() {
  let entry = null;
  const overrides = new Map([
    [CAPTURE_HOOK, (mm) => {
      if (entry === null) entry = mm.clone();
      return reachableOracle(mm);
    }],
  ]);
  makeMachine(overrides).runFrames(240);
  return entry;
}

const ENTRY = ROM_PRESENT ? captureEntry() : null;

/**
 * Install the once-per-frame countdown tick AND the run bound on a clone, both keyed on the
 * watchdog read the frame-wait does exactly once per pass. Every read ticks the countdown down
 * by one (floored at 0) so the busy-waits terminate; on the THROW_AT-th read it (optionally
 * corrupts one cell, for the teeth twins, then) throws to unwind the never-returning loop. The
 * same hook on both sides can only reveal a difference, never create one.
 */
function installBoundedFrameTick(m, corrupt) {
  const mem = m.mem;
  const origRead8 = mem.read8.bind(mem);
  let reads = 0;
  mem.read8 = (addr) => {
    if (addr === WATCHDOG) {
      reads += 1;
      if (reads >= THROW_AT) {
        if (corrupt !== undefined) mem.write8(corrupt, origRead8(corrupt) ^ 0xff);
        throw BOUND;
      }
      const c = origRead8(COUNTDOWN);
      if (c !== 0) mem.write8(COUNTDOWN, c - 1);
    }
    return origRead8(addr);
  };
}

/**
 * Run `fn` on a fresh clone of the captured entry with the frame-tick/bound harness (and an
 * optional one-cell corruption applied at the bound, for the teeth twins). Returns the bounded
 * machine; asserts the run actually hit the bound rather than returning or hanging.
 */
function runBounded(fn, corrupt) {
  const m = ENTRY.clone();
  installBoundedFrameTick(m, corrupt);
  let bounded = false;
  try {
    fn(m);
  } catch (e) {
    if (e !== BOUND) throw e;
    bounded = true;
  }
  assert.ok(bounded, "run did not reach the display loop's bound — the harness never engaged");
  return m;
}

/**
 * First differing RAM byte between two machines, EXCLUDING the dead top-of-stack scratch just
 * below the entry SP (the window [entrySP - STACK_SCRATCH, entrySP)) where the oracle parks
 * return-address ghosts the stack-free idiomatic never writes. Null when otherwise identical.
 */
function ramDiffOutsideStack(a, b, entrySP) {
  const da = a.dumpState();
  const db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= entrySP - STACK_SCRATCH && addr < entrySP) continue; // dead top-of-stack scratch
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

// -- 0. HARNESS: a real attract entry, high stack, terminating bound -----------

test("HARNESS: a real attract entry is captured, the entry SP is high, and the bounded oracle run terminates", () => {
  assert.ok(ENTRY, "expected loc_3dae to be dispatched during attract to seed the crafted entry");
  const entrySP = ENTRY.regs.sp;
  // The excluded stack window must sit far above every real output cell (0x804c..0x93ff),
  // or it could mask a real bug. A high entry SP (The Pit's stack lives at 0x83ff down) guarantees it.
  assert.ok(entrySP - STACK_SCRATCH > 0x8060, `entry SP ${hx(entrySP)} too low — the stack window could reach real output`);

  const m = runBounded(oracle); // must hit the bound (not hang, not return early)
  // At the bound the second display pass's wait is mid-drain (setup + one full pass + 3 ticks of
  // the next 15-frame wait done), so the countdown sits at 12 — proof the whole setup and a full pass ran.
  assert.equal(m.mem.read8(COUNTDOWN), 12, "the bounded run did not stop mid-way through the second display pass");
  console.log(`  HARNESS: captured a real attract entry (SP=${hx(entrySP)}); bounded oracle run terminates at the display loop`);
});

// -- 1. EQUAL on the real captured attract entry -------------------------------

test("EQUAL (real entry): holdFixedScreen == oracle over RAM outside the dead stack scratch", () => {
  const entrySP = ENTRY.regs.sp;

  const o = runBounded(oracle);
  const c = runBounded(idiomatic);

  const ram = ramDiffOutsideStack(o, c, entrySP);
  assert.equal(ram, null, ram && `RAM diverged at ${hx(ram.addr ?? 0)} (oracle=${ram.a} idiomatic=${ram.b})`);

  // Positive checks: the setup really happened on the idiomatic arm.
  assert.equal(c.mem.read8(COLOR_CELL), BACKGROUND, "the background colour flood did not land");
  assert.equal(
    c.mem.read8(VIDEO_LAST),
    c.mem.read8(IMAGE_SOURCE + (VIDEO_LAST - 0x9000)),
    "the canned image copy did not land",
  );
  console.log("  EQUAL: full paint + one display pass identical to the oracle (RAM outside dead stack scratch)");
});

// -- 2. TEETH: broken twins the gate MUST catch --------------------------------

test("TEETH: a corrupted flooded colour cell is CAUGHT in colour RAM", () => {
  const entrySP = ENTRY.regs.sp;
  const o = runBounded(oracle);
  const c = runBounded(idiomatic, COLOR_CELL); // real routine, then one colour cell flipped at the bound

  const ram = ramDiffOutsideStack(o, c, entrySP);
  assert.notEqual(ram, null, "the gate FAILED to catch a corrupted colour cell — it is worthless");
  assert.equal(ram.addr, COLOR_CELL, `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected ${hx(COLOR_CELL)})`);
  console.log(`  TEETH: corrupted colour caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

test("TEETH: a corrupted copied image cell is CAUGHT in video RAM", () => {
  const entrySP = ENTRY.regs.sp;
  const o = runBounded(oracle);
  const c = runBounded(idiomatic, VIDEO_LAST); // real routine, then one image cell flipped at the bound

  const ram = ramDiffOutsideStack(o, c, entrySP);
  assert.notEqual(ram, null, "the gate FAILED to catch a corrupted image cell — it is worthless");
  assert.equal(ram.addr, VIDEO_LAST, `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected ${hx(VIDEO_LAST)})`);
  console.log(`  TEETH: corrupted image caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});
