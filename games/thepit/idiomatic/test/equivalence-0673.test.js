// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for paintScreen (ROM 0x0673, The Pit) — the routine that
 * lays down a whole screen: it copies a ROM tile image into the tilemap the display
 * reads (one of two images, picked by the low bit of the display-mode byte 0x8028) and
 * a ROM colour image into the colour map, stamps the two fixed edge columns and the
 * score HUD over them, then arms the cell-animation counter (0x805c) to 1.
 *
 * THE CONTRACT — OBSERVABLE RAM. The routine's only observable output is memory: the
 * painted tilemap (0x9000..0x93ff), the colour map (0x8800..0x8bff), the edge columns
 * and HUD its callees paint, and the animation counter left at 1. pc, SP and the value
 * registers are the declared-dead live-out and are EXCLUDED — the idiomatic layer drops
 * the Z80 register/step trace, and this contract must survive a callee later dissolving.
 * (Here the balanced work stack happens to leave pc and SP identical to the oracle, but
 * the gate does not lean on that.)
 *
 * ONE WRINKLE — the two frame-waits. paintScreen pauses one frame before each copy via
 * waitFrames, which busy-waits on the per-frame countdown cell (0x8009) reaching 0.
 * Nothing in the code drives that countdown — in the live game the per-frame interrupt
 * ticks it down once a frame. Run in isolation on a clone (its frame machinery
 * neutralised, so no interrupt fires) those loops would never terminate. So the harness
 * models that once-per-frame tick with ONE hook installed IDENTICALLY on both clones:
 * reading the watchdog (which each frame-wait pass does exactly once) decrements the
 * countdown by one, floored at 0. Being the same hook on both sides, it can only ever
 * reveal a difference between oracle and idiomatic, never manufacture one.
 *
 * ONE MORE WRINKLE — dead stack scratch. The oracle threads its four sub-calls through
 * the Z80 stack (The Pit's stack is real diffed work RAM near 0x83ff); the stack-free
 * idiomatic callees leave different bytes in the handful of scratch cells just below the
 * entry stack pointer. Those cells are dead — overwritten by the next push or never read
 * — exactly the classic stack scratch. The RAM diff therefore excludes that small window
 * [entrySP - STACK_SCRATCH, entrySP) and compares everything else byte-for-byte. The
 * window is asserted to sit entirely in the stack page, far above every observable
 * output, so it can never hide a real difference (video/colour RAM and 0x805c all lie
 * outside it).
 *
 * Checks:
 *   1. HARNESS — the real boot dispatch is captured (0x0673 fires once from round setup
 *      0x031a) and the oracle run is deterministic outside the stack scratch; the entry
 *      is sanity-checked (display-mode bit set = tile image A; stack window is pure stack).
 *   2. EQUAL (captured, tile image A) — paintScreen == oracle outside the stack scratch;
 *      the tilemap and colour map are copied and the animation counter is armed to 1.
 *   3. EQUAL (crafted, tile image B) — clearing the display-mode bit forces the other ROM
 *      tile image; paintScreen == oracle there too, and it really paints image B.
 *   4. TEETH (wrong tile source) — a twin that ignores the mode bit and always paints
 *      image A is CAUGHT on the image-B arm, at the first cell the two images differ.
 *   5. TEETH (wrong colour) — a twin that corrupts a colour cell is CAUGHT in colour RAM.
 *   6. TEETH (wrong animation counter) — a twin that arms 0x805c to the wrong value is
 *      CAUGHT at 0x805c.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-0673.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0673 as oracle } from "../../translated/loc_0673.js";
import { paintScreen as idiomatic } from "../paintScreen.js";
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

const TARGET = 0x0673;
const COUNTDOWN = 0x8009; // per-frame countdown the two frame-waits drain to 0
const WATCHDOG = 0xb800; // reading it kicks the watchdog (once per busy-wait pass)
const DISPLAY_MODE = 0x8028; // its low bit selects which ROM tile image is painted
const ANIMATION_COUNTER = 0x805c; // armed to 1 at the end of the paint
const VIDEO_RAM_BASE = 0x9000; // tilemap the display reads
const COLOR_CELL = 0x8800; // first colour-map cell
const IMAGE_DIFF_CELL = 0x908e; // first tilemap cell where ROM images A and B differ (cell 142)
const STACK_SCRATCH = 16; // scratch cells just below the entry SP the sub-calls leave dead
const CAPTURE_FRAMES = 700; // 0x0673 dispatches once during boot (~frame 530)
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/** Capture the pristine machine state at 0x0673's genuine boot dispatch. */
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
 * First differing RAM byte between two machines, EXCLUDING the dead stack-scratch window
 * just below the entry SP (the sub-calls' balanced pushes leave different bytes there and
 * nothing reads them). Null when otherwise identical.
 */
function ramDiffOutsideStack(a, b, entrySP) {
  const da = a.dumpState();
  const db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= entrySP - STACK_SCRATCH && addr < entrySP) continue; // dead stack scratch
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/**
 * Run the oracle and a candidate on two independent clones of an entry, with the
 * frame-tick harness on both, and return the first RAM difference outside the stack
 * scratch (null == EQUAL on the observable contract).
 */
function observableDiff(entry, candidate) {
  const a = entry.clone();
  const b = entry.clone();
  installFrameTick(a);
  installFrameTick(b);
  oracle(a);
  candidate(b);
  return ramDiffOutsideStack(a, b, entry.regs.sp);
}

// -- 1. HARNESS: real dispatch captured + deterministic + entry sane -----------

test("HARNESS: 0x0673 boot dispatch captured, oracle deterministic, entry sane", () => {
  assert.ok(ENTRY, "expected 0x0673 to be dispatched during boot");
  // The stack window must sit entirely in the stack page, well above every observable
  // output (0x805c, the 0x8800 colour map, the 0x9000 tilemap), so it can hide nothing.
  const sp = ENTRY.regs.sp;
  assert.ok(sp - STACK_SCRATCH > 0x8300 && sp < COLOR_CELL, `entry SP ${hx(sp)} not in the stack page`);
  assert.equal(ENTRY.mem.read8(DISPLAY_MODE) & 1, 1, "captured dispatch has the mode bit set (tile image A)");

  // Oracle vs oracle is identical outside the scratch (proves the plumbing is deterministic).
  assert.equal(observableDiff(ENTRY, oracle), null, "oracle run not deterministic outside the stack scratch");
  console.log(`  HARNESS: captured 0x0673 (SP=${hx(sp)}, mode=${hx(ENTRY.mem.read8(DISPLAY_MODE))}); oracle deterministic`);
});

// -- 2. EQUAL: real captured dispatch (tile image A) --------------------------

test("EQUAL (captured, image A): paintScreen == oracle outside the stack scratch", () => {
  assert.ok(ENTRY, "need the captured 0x0673 entry");
  const ram = observableDiff(ENTRY, idiomatic);
  assert.equal(ram, null, ram && `RAM diverged at ${hx(ram.addr ?? 0)} (oracle=${ram.a} idiomatic=${ram.b})`);

  // Positive checks: the screen really was painted and the animation counter armed.
  const c = ENTRY.clone();
  installFrameTick(c);
  idiomatic(c);
  const o = ENTRY.clone();
  installFrameTick(o);
  oracle(o);
  assert.equal(c.mem.read8(VIDEO_RAM_BASE), o.mem.read8(VIDEO_RAM_BASE), "tilemap not copied to match the oracle");
  assert.equal(c.mem.read8(COLOR_CELL), o.mem.read8(COLOR_CELL), "colour map not copied to match the oracle");
  assert.equal(c.mem.read8(ANIMATION_COUNTER), 1, "animation counter not armed to 1");
  console.log("  EQUAL/captured: identical outside the stack scratch; screen painted + counter armed");
});

// -- 3. EQUAL: crafted entry forces the other tile image (image B) ------------

test("EQUAL (crafted, image B): clearing the mode bit paints ROM image B, still == oracle", () => {
  const seed = ENTRY.clone();
  seed.mem.write8(DISPLAY_MODE, ENTRY.mem.read8(DISPLAY_MODE) & ~1); // clear bit 0 -> tile image B
  const ram = observableDiff(seed, idiomatic);
  assert.equal(ram, null, ram && `RAM diverged at ${hx(ram.addr ?? 0)} (oracle=${ram.a} idiomatic=${ram.b})`);

  // Confirm the crafted arm really painted image B (its diagnostic cell differs from A).
  const o = seed.clone();
  installFrameTick(o);
  oracle(o);
  const c = seed.clone();
  installFrameTick(c);
  idiomatic(c);
  assert.equal(c.mem.read8(IMAGE_DIFF_CELL), o.mem.read8(IMAGE_DIFF_CELL), "image-B diagnostic cell mismatch");
  console.log(`  EQUAL/crafted: image-B arm identical; diagnostic cell ${hx(IMAGE_DIFF_CELL)} = ${hx(c.mem.read8(IMAGE_DIFF_CELL))}`);
});

// -- 4. TEETH: a twin that ignores the mode bit (always image A) --------------

/** Broken twin: paints the screen, then re-stamps the tilemap from image A regardless of
 *  the mode bit — the classic "ignored the selector" bug the mode test must catch. */
function twinWrongTileSource(m) {
  const { mem } = m;
  idiomatic(m);
  for (let cell = 0; cell < 1024; cell++) mem.write8(VIDEO_RAM_BASE + cell, mem.read8(0x0762 + cell));
}

test("TEETH (wrong tile source): always-image-A twin is CAUGHT on the image-B arm", () => {
  const seed = ENTRY.clone();
  seed.mem.write8(DISPLAY_MODE, ENTRY.mem.read8(DISPLAY_MODE) & ~1); // image-B arm
  const ram = observableDiff(seed, twinWrongTileSource);
  assert.notEqual(ram, null, "the gate FAILED to catch a wrong tile source — it is worthless");
  assert.equal(ram.addr, IMAGE_DIFF_CELL, `teeth caught ${hx(ram.addr ?? 0)} (expected the first A/B diff cell ${hx(IMAGE_DIFF_CELL)})`);
  console.log(`  TEETH/source: wrong tile image caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

// -- 5. TEETH: a corrupted colour cell ----------------------------------------

/** Broken twin: paints correctly, then corrupts one colour-map cell. */
function twinWrongColour(m) {
  idiomatic(m);
  m.mem.write8(COLOR_CELL, m.mem.read8(COLOR_CELL) ^ 0xff); // BUG: wrong colour attribute
}

test("TEETH (wrong colour): a corrupted colour cell is CAUGHT in colour RAM", () => {
  const ram = observableDiff(ENTRY, twinWrongColour);
  assert.notEqual(ram, null, "the gate FAILED to catch a wrong colour cell — it is worthless");
  assert.equal(ram.addr, COLOR_CELL, `teeth caught ${hx(ram.addr ?? 0)} (expected ${hx(COLOR_CELL)})`);
  console.log(`  TEETH/colour: wrong colour caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

// -- 6. TEETH: a wrong animation-counter value --------------------------------

/** Broken twin: paints correctly, then arms the animation counter to the wrong value. */
function twinWrongCounter(m) {
  idiomatic(m);
  m.mem.write8(ANIMATION_COUNTER, 2); // BUG: should be armed to 1
}

test("TEETH (wrong animation counter): a wrong 0x805c value is CAUGHT", () => {
  const ram = observableDiff(ENTRY, twinWrongCounter);
  assert.notEqual(ram, null, "the gate FAILED to catch a wrong animation-counter value — it is worthless");
  assert.equal(ram.addr, ANIMATION_COUNTER, `teeth caught ${hx(ram.addr ?? 0)} (expected ${hx(ANIMATION_COUNTER)})`);
  console.log(`  TEETH/counter: wrong counter caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});
