// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for showSetupScreen (ROM 0x3a6f, The Pit) — the round-setup screen
 * painter: it lays the fixed playfield furniture, stamps four HUD records (two of them
 * count fields showing the DSW-derived values 0x804c / 0x804d, with a plural/singular
 * label rule and a singular-glyph patch), then holds the finished screen for thirty
 * colour-cycle + frame-wait passes.
 *
 * TWO WRINKLES this routine forces:
 *
 *   1. The frame waits. Each of the thirty hold passes calls the frame wait, which
 *      busy-loops on the per-frame countdown cell (0x8009) reaching 0 — driven in the
 *      live game by the per-frame interrupt, which does not fire on an isolated clone.
 *      So the harness models that once-per-frame tick with ONE hook installed
 *      IDENTICALLY on both clones: reading the watchdog (which each wait pass does once)
 *      decrements the countdown, floored at 0. Same hook on both sides -> it can only
 *      reveal a difference, never manufacture one. (Same device as showFixedScreen.)
 *
 *   2. The stack scratch. The oracle wraps every callee in a stack push + return, while
 *      the idiomatic routine calls its already-decompiled leaves directly (no push), so
 *      the two leave DIFFERENT dead bytes in the work stack just below the entry stack
 *      pointer. And once a callee (0x4b44) is DISSOLVED — its m.call(0x4b44) becomes a
 *      direct blankScreen(m) — the oracle's push/return also parks a two-byte return-frame
 *      ghost AT/just above the SP it resets to (entry SP=0x83fd, so 0x83fd/0x83fe) that
 *      the stack-free idiomatic never writes. Both are classic dead scratch (overwritten
 *      by the caller's next push before anything reads them), so the RAM diff EXCLUDES
 *      that window — [entrySP - 32, entrySP + 2) — and compares everything else, all of
 *      the video / colour / work RAM the screen paint actually produces, byte for byte.
 *      pc / SP / value registers are excluded per the memory-equivalence contract (the
 *      idiomatic layer does not preserve the register/pc trace; the whole-machine pixel
 *      gate backstops it, and this contract survives a callee later being dissolved).
 *
 * showSetupScreen is reached at round setup (the reset epilogue resetStateAndShowSetup and the per-player
 * teardown loc_0371), NOT during idle attract, so the real dispatch is captured from a
 * boot run. The real dispatch runs it with 0x804c == 1 and 0x804d == 2 (the plural arm
 * for both, and the singular patch, since 0x804c == 1); a crafted sweep pokes those two
 * counts to reach the zero-count singular label arm and the no-patch case too.
 *
 * CHECKS:
 *   0. HARNESS — capture the real boot dispatch; oracle vs oracle is deterministic and
 *      both drain the hold counter to 0.
 *   1. EQUAL (real dispatch) — idiomatic == oracle over RAM outside the stack scratch,
 *      and the count records / singular patch / drained counter hold their values.
 *   2. EQUAL (crafted sweep) — 0x804c in {0,1,2} x 0x804d in {0,2}, poked identically on
 *      both sides, stays equal across both label arms and the patch/no-patch cases.
 *   3. TEETH (wrong count digit) — a twin that corrupts the first count record is CAUGHT
 *      at that record cell.
 *   4. TEETH (singular patch) — a twin that patches the wrong singular glyph is INVISIBLE
 *      when the count is not one (the patch never fires) and CAUGHT at the patched cell
 *      when the count is one, proving the crafted count is load-bearing.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3a6f.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3a6f as oracle } from "../../translated/loc_3a6f.js";
import { showSetupScreen as idiomatic } from "../showSetupScreen.js";
import { makeMachineFactory } from "../../machine.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) =>
      nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x3a6f;
const CAPTURE_FRAMES = 2500; // 0x3a6f fires at round setup during a boot run
const WATCHDOG = 0xb800; // reading it kicks the watchdog + (in the harness) ticks the countdown
const COUNTDOWN = 0x8009; // the per-frame countdown each frame-wait drains to 0
const HOLD_COUNTER = 0x800a; // the thirty-pass hold counter, drained to 0
const COUNT_A = 0x804c; // first DSW-derived HUD count
const COUNT_B = 0x804d; // second DSW-derived HUD count
const REC_A = 0x928e; // first count record cell (shows COUNT_A)
const REC_B = 0x9294; // second count record cell (shows COUNT_B)
const SINGULAR_CELL = 0x918e; // patched to the singular glyph when COUNT_A == 1
const SINGULAR_GLYPH = 0x24;
const STACK_SCRATCH = 32; // bytes below the entry SP the two call styles differ in
const RETURN_SLOT = 2; // the two return-slot bytes AT/just above entry SP the dissolved callee no longer writes
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture the pristine machine state at the FIRST real 0x3a6f dispatch during a boot
 * run. The hook clones the entry, then runs the oracle so the host run proceeds (its
 * interrupt fires, so the frame waits terminate and the round continues).
 */
function captureEntry() {
  let entry = null;
  const overrides = new Map([
    [TARGET, (mm) => {
      if (entry === null) entry = mm.clone();
      return oracle(mm);
    }],
  ]);
  makeMachine(overrides).runFrames(CAPTURE_FRAMES);
  return entry;
}

const ENTRY = ROM_PRESENT ? captureEntry() : null;

/**
 * Model the once-per-frame interrupt tick that drives each frame-wait to completion:
 * every watchdog read (a frame-wait does exactly one per pass) ticks the countdown down
 * by one, floored at 0. Installed identically on both clones, so it can only expose a
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
 * First differing RAM byte between two machines, EXCLUDING the dead stack-scratch window
 * just below the entry stack pointer (where the oracle's per-call pushes and the
 * idiomatic direct calls legitimately differ). Null when otherwise identical.
 */
function ramDiffOutsideStack(a, b, entrySP) {
  const da = a.dumpState();
  const db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    // Dead stack scratch [entrySP - 32, entrySP) PLUS the two return-slot bytes
    // [entrySP, entrySP + 2): the oracle's push/return leaves a return-frame ghost at/just
    // above the SP it resets to, which the stack-free idiomatic (dissolved callee, direct
    // call) never writes. Both windows are overwritten by the caller's next push before
    // anything reads them, so neither can hide a real output cell.
    if (addr >= entrySP - STACK_SCRATCH && addr < entrySP + RETURN_SLOT) continue;
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/**
 * Run the oracle and `candidate` on two independent clones of the real captured entry,
 * with the frame-tick harness on both. `pokes` (optional {a,b}) forces the two counts
 * identically on both sides — the crafted lever for the arms the real dispatch misses.
 * Returns the first RAM diff outside the stack scratch (or null) plus the candidate clone.
 */
function runPair(candidate, pokes) {
  const a = ENTRY.clone();
  const b = ENTRY.clone();
  if (pokes) {
    for (const c of [a, b]) {
      if (pokes.a !== undefined) c.mem.write8(COUNT_A, pokes.a);
      if (pokes.b !== undefined) c.mem.write8(COUNT_B, pokes.b);
    }
  }
  installFrameTick(a);
  installFrameTick(b);
  oracle(a);
  candidate(b);
  return { ram: ramDiffOutsideStack(a, b, ENTRY.regs.sp), oracleM: a, candM: b };
}

// -- 0. HARNESS (reachability + determinism) ----------------------------------

test("HARNESS: the real boot 0x3a6f dispatch is captured and the oracle run is deterministic", () => {
  assert.ok(ENTRY, "expected 0x3a6f to be dispatched at round setup during the boot run");
  assert.equal(ENTRY.mem.read8(COUNT_A), 1, "the real dispatch runs with 0x804c == 1 (singular patch + plural arm)");
  assert.equal(ENTRY.mem.read8(COUNT_B), 2, "the real dispatch runs with 0x804d == 2");

  const { ram, oracleM } = runPair(oracle); // idiomatic arm = the oracle itself
  assert.equal(ram, null, ram && `oracle run not deterministic: diff at ${hx(ram.addr ?? 0)}`);
  assert.equal(oracleM.mem.read8(HOLD_COUNTER), 0, "the thirty-pass hold must drain the counter to 0");
  console.log(`  HARNESS: captured a real 0x3a6f entry (SP=${hx(ENTRY.regs.sp)}); oracle deterministic, hold drained`);
});

// -- 1. EQUAL on the real captured dispatch -----------------------------------

test("EQUAL (real dispatch): showSetupScreen == oracle over RAM outside the stack scratch", () => {
  const { ram, candM } = runPair(idiomatic);
  assert.equal(ram, null, ram && `RAM diverged at ${hx(ram.addr ?? 0)} (oracle=${ram.a} idiomatic=${ram.b})`);

  // Positive checks: the records really carry the counts, the singular patch fired
  // (0x804c == 1 here), and the hold counter drained.
  assert.equal(candM.mem.read8(REC_A), 1, "first count record must show 0x804c");
  assert.equal(candM.mem.read8(REC_B), 2, "second count record must show 0x804d");
  assert.equal(candM.mem.read8(SINGULAR_CELL), SINGULAR_GLYPH, "singular patch must fire when 0x804c == 1");
  assert.equal(candM.mem.read8(HOLD_COUNTER), 0, "hold counter must drain to 0");
  console.log("  EQUAL/real: full setup screen identical to the oracle (records, patch, hold)");
});

// -- 2. EQUAL across a crafted sweep of both counts ----------------------------

test("EQUAL (crafted sweep): 0x804c in {0,1,2} x 0x804d in {0,2} stays equal (both label arms + patch cases)", () => {
  for (const a of [0, 1, 2]) {
    for (const b of [0, 2]) {
      const { ram, candM } = runPair(idiomatic, { a, b });
      assert.equal(ram, null, ram && `sweep 0x804c=${a} 0x804d=${b}: RAM diverged at ${hx(ram.addr ?? 0)} (oracle=${ram.a} idiomatic=${ram.b})`);
      // A nonzero count uses the shorter plural label, which stops above the digit cell,
      // so the digit survives and shows the count. The zero count uses the longer
      // singular label, whose last glyph lands ON the digit cell and overwrites it — a
      // faithful oracle behaviour that the RAM diff above already checks, so the digit
      // value is only asserted where it survives.
      if (a !== 0) assert.equal(candM.mem.read8(REC_A), a, `0x804c=${a}: first record wrong`);
      if (b !== 0) assert.equal(candM.mem.read8(REC_B), b, `0x804d=${b}: second record wrong`);
    }
  }
  console.log("  EQUAL/sweep: 6 count combinations — idiomatic == oracle across both label arms and the patch/no-patch cases");
});

// -- 3. TEETH: a wrong count digit is caught ----------------------------------

/** Broken twin: paints correctly, then corrupts the first count record cell. */
function brokenCountDigit(m) {
  idiomatic(m);
  m.mem.write8(REC_A, m.mem.read8(REC_A) ^ 0xff); // BUG: wrong count digit
}

test("TEETH (wrong count digit): a corrupted count record is CAUGHT at that cell", () => {
  const { ram } = runPair(brokenCountDigit);
  assert.notEqual(ram, null, "the gate FAILED to catch a wrong count digit — it is worthless");
  assert.equal(ram.addr, REC_A, `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected ${hx(REC_A)})`);
  console.log(`  TEETH/digit: caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

// -- 4. TEETH: the singular-glyph patch (crafted count is load-bearing) --------

/** Broken twin: paints correctly, then patches the WRONG singular glyph — but ONLY when
 *  the count is one, exactly as the routine's own patch condition would. So it is
 *  invisible whenever the count is not one (the patch never fires either way). */
function brokenSingularGlyph(m) {
  const one = m.mem.read8(COUNT_A) === 1;
  idiomatic(m);
  if (one) m.mem.write8(SINGULAR_CELL, SINGULAR_GLYPH ^ 0xff); // BUG: wrong singular glyph
}

test("TEETH (singular patch): invisible when the count is not one, CAUGHT when it is (crafted count is load-bearing)", () => {
  // Count != 1: the patch never fires, so the wrong-glyph twin is byte-identical.
  const hidden = runPair(brokenSingularGlyph, { a: 2 });
  assert.equal(hidden.ram, null, "the wrong-glyph twin must be invisible when 0x804c != 1 (patch never fires)");

  // Count == 1: the patch fires, and the twin's wrong glyph is caught at the patched cell.
  const caught = runPair(brokenSingularGlyph, { a: 1 });
  assert.notEqual(caught.ram, null, "the crafted count=1 sweep FAILED to catch the wrong singular glyph — the crafted entry proves nothing");
  assert.equal(caught.ram.addr, SINGULAR_CELL, `expected the patch caught at ${hx(SINGULAR_CELL)}, got ${hx(caught.ram.addr ?? 0)}`);
  console.log(`  TEETH/patch: hidden at count 2, caught at count 1 — ${hx(caught.ram.addr)} (oracle=${caught.ram.a} broken=${caught.ram.b})`);
});
