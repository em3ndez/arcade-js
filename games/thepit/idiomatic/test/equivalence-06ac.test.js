// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence gate for glitterDiamonds (ROM 0x06ac) — the cell-animation countdown at
 * 0x805c plus the per-frame recolour of the one fixed screen cell it selects.
 *
 * glitterDiamonds READS the countdown 0x805c and the selected cell's video-RAM glyph, and
 * WRITES the countdown and the cell's colour-RAM byte. Its declared LIVE-OUT is
 * memory-only: its only caller (the in-game main loop loc_0348) overwrites every
 * register it leaves before reading it, so the oracle's residual register/pc values
 * are dead ABI. The contract is therefore MEMORY-equivalence — the whole state dump
 * via firstStateDiff — NOT the full register file. This is the same contract stageObjectSpriteRecord
 * and seedActorSpawnState use; comparing registers (as unitEquivalence's `equal`
 * does) would false-fail an honest memory-only rewrite.
 *
 * WHY CRAFTED-ENTRY, NOT unitEquivalence's captured dispatch: 0x06ac is reached ONLY
 * through loc_0348, the in-game main loop, which attract never enters — over 600
 * attract frames it dispatches 0 times (loc_0348 likewise), so no natural dispatch
 * exists to capture. Exactly like the attract-unreachable stageObjectSpriteRecord, the gate builds
 * inputs by cloning real attract machine states and poking the bytes the routine
 * reads, identically on both sides. The output is a pure function of those bytes, so
 * a real state plus a surgical poke is airtight.
 *
 * FOUR checks:
 *   1. EQUAL (real captured attract states) — clone the running attract machine at a
 *      spread of frames (real RAM), run oracle vs idiomatic on independent clones,
 *      and diff the whole state dump; also confirm the idiomatic side leaves SP/pc
 *      untouched (no stack/ret modelling).
 *   2. EQUAL (crafted sweep) — poke every countdown value AND both recolour branches
 *      (all glyphs animating vs all idle), colour seeded at both 0 and 7 to cross the
 *      eight-shade wrap, identically on both sides.
 *   3. NON-VACUOUS — with the selected colour cell pre-set to a sentinel on both
 *      sides, both arms overwrite it and agree, so a no-op twin cannot pass.
 *   4. TEETH — a twin that over-advances the value-7 cell's colour MUST be caught by
 *      the crafted match arm (the colour-cycle branch attract may never put on screen).
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-06ac.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_06ac as oracle } from "../../translated/loc_06ac.js";
import { glitterDiamonds as idiomatic } from "../glitterDiamonds.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const COUNTDOWN = 0x805c;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// Every animated cell: [colour cell (written), tile cell (read), animating glyph].
// Poking all of them at once forces whichever cell the countdown selects into the
// intended branch, independent of which value is under test.
const TILE_GLYPHS = [
  [0x9073, 0x3a],
  [0x915d, 0x3b],
  [0x90d9, 0x3a],
  [0x91fd, 0x3c],
  [0x91b6, 0x3a],
  [0x927d, 0x3d],
  [0x933a, 0x3a],
];
const COLOUR_CELLS = [0x8873, 0x895d, 0x88d9, 0x89fd, 0x89b6, 0x8a7d, 0x8b3a];
const CELL_B_COLOUR = 0x8873; // the value-7 cell's colour byte (countdown starts at 8)

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Real attract machine states: run the game and clone it at a spread of frames. Each
 * clone is a genuine in-play machine (real RAM), independent of the source run, with
 * its frame machinery neutralised (safe to run the oracle's steps/ret on).
 */
function captureStates(count, stride, startFrame) {
  const m = makeMachine();
  m.runFrames(startFrame);
  const caps = [];
  for (let i = 0; i < count; i++) {
    m.runFrames(stride);
    caps.push(m.clone());
  }
  return caps;
}

/** Run oracle and idiomatic on independent clones; return the first differing state byte (or null). */
function stateDiff(entry, fn) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  oracle(a);
  fn(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/** A fresh entry clone with the countdown, all cell glyphs, and all cell colours poked. */
function craft(base, { start, glyphsAnimating, colourSeed }) {
  const e = base.clone();
  e.mem.write8(COUNTDOWN, start);
  for (const [tileCell, glyph] of TILE_GLYPHS) e.mem.write8(tileCell, glyphsAnimating ? glyph : 0x00);
  for (const colourCell of COLOUR_CELLS) e.mem.write8(colourCell, colourSeed);
  return e;
}

// -- 1. EQUAL over real captured attract states -------------------------------

test("EQUAL: glitterDiamonds leaves the same state as the oracle over real captured attract states", () => {
  const caps = captureStates(10, 90, 90);
  assert.ok(caps.length >= 1, "expected at least one captured attract state");
  for (const cap of caps) {
    // Sweep the countdown through all eight values on each real state so every
    // cell-selection arm runs against genuine surrounding RAM.
    for (let start = 1; start <= 8; start++) {
      const e = cap.clone();
      e.mem.write8(COUNTDOWN, start);
      const d = stateDiff(e, idiomatic);
      assert.equal(d, null, d && `start=${start}: RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`);
    }

    // No stack/ret modelling: the idiomatic side leaves SP and pc as it found them.
    const b = cap.clone();
    const sp0 = b.regs.sp, pc0 = b.pc;
    idiomatic(b);
    assert.equal(b.regs.sp, sp0, "idiomatic must leave SP unchanged (no stack modelling)");
    assert.equal(b.pc, pc0, "idiomatic must leave pc unchanged (no ret modelling)");
  }
  console.log(`  EQUAL: ${caps.length} real captured attract states × 8 countdown values — state identical to the oracle`);
});

// -- 2. EQUAL over a crafted sweep (all values × both branches × wrap) ---------

test("EQUAL (crafted): every countdown value and both recolour branches match the oracle", () => {
  const [base] = captureStates(1, 1, 200);
  assert.ok(base, "need a real entry to craft from");

  let n = 0;
  for (let start = 1; start <= 8; start++) {
    for (const glyphsAnimating of [true, false]) {
      for (const colourSeed of [0, 7]) {
        const e = craft(base, { start, glyphsAnimating, colourSeed });
        const d = stateDiff(e, idiomatic);
        assert.equal(
          d,
          null,
          d && `start=${start} animating=${glyphsAnimating} seed=${colourSeed}: ` +
            `diff at ${hx(d.addr ?? 0)} oracle=${d.a} idiomatic=${d.b}`,
        );
        n++;
      }
    }
  }
  console.log(`  EQUAL/crafted: ${n} countdown×branch×wrap combinations identical to the oracle`);
});

// -- 3. NON-VACUOUS: the selected colour cell is genuinely overwritten --------

test("NON-VACUOUS: with the selected colour cell pre-set to a sentinel, both arms overwrite it and agree", () => {
  const [base] = captureStates(1, 1, 220);
  // Countdown 8 selects the value-7 cell (colour 0x8873); glyph animating so it
  // colour-cycles to a value != the sentinel.
  const entry = craft(base, { start: 8, glyphsAnimating: true, colourSeed: 0 });
  const SENTINEL = 0x55;
  entry.mem.write8(CELL_B_COLOUR, SENTINEL);

  const a = entry.clone(), b = entry.clone();
  oracle(a);
  idiomatic(b);
  assert.notEqual(b.mem.read8(CELL_B_COLOUR), SENTINEL, `idiomatic left ${hx(CELL_B_COLOUR)} unwritten`);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`);
  console.log(`  NON-VACUOUS: ${hx(CELL_B_COLOUR)} overwritten from the sentinel, arms agree`);
});

// -- 4. TEETH: an over-advancing twin MUST be caught --------------------------

/** Broken twin: runs the real routine, then advances the value-7 cell's colour once more. */
function brokenLoc06ac(m) {
  idiomatic(m);
  m.mem.write8(CELL_B_COLOUR, (m.mem.read8(CELL_B_COLOUR) + 1) % 8); // BUG: two shades, not one
}

test("TEETH: a twin that over-advances the colour is CAUGHT by the crafted match arm", () => {
  const [base] = captureStates(1, 1, 250);
  // Countdown 8 → value-7 cell; glyphs animating → the colour-cycle branch runs.
  const entry = craft(base, { start: 8, glyphsAnimating: true, colourSeed: 0 });

  const d = stateDiff(entry, brokenLoc06ac);
  assert.notEqual(d, null, "the gate FAILED to catch an over-advancing twin — it proves nothing");
  assert.equal(d.addr, CELL_B_COLOUR, `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(CELL_B_COLOUR)})`);

  // and the correct routine is still EQUAL on the very same entry
  assert.equal(stateDiff(entry, idiomatic), null, "idiomatic must pass the entry the twin fails");
  console.log(`  TEETH: over-advancing twin caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});
