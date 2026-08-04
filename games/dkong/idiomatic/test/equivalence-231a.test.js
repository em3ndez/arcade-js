// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_231a (ROM 0x231A) — the difficulty-5 object-velocity arm:
 * seed a record's step code and step delta from the horizontal offset to the player.
 *
 * loc_231a is a LEAF whose entire memory-observable behaviour is a total function of
 * just TWO input bytes — MARIO_X (0x6203) and the record's own X at +0x03 (OBJ_X) —
 * plus the record pointer (IX live-in). Unlike the difficulty-3/4 sibling loc_2303 it
 * reads no random byte: both outputs are pure functions of (playerX, objX). It writes
 * only two cells:
 *
 *   +0x10 (step code)   = (playerX < objX ? 0xFC : 0x00) | (offset >> 6)
 *   +0x11 (step delta)  = rotate-left-2(offset)          , offset = (playerX − objX) & 0xFF
 *
 * It returns nothing a caller consumes (the caller tail-calls it; its two writes ARE the
 * whole job), and it never writes the stack (a leaf that only pops via its terminal
 * return), so the contract is memory-only over the WHOLE dump — no STACK_SCRATCH
 * exclusion is needed. Because the input space is only two bytes, the FULL 256×256
 * (playerX, objX) grid is EXHAUSTIVE — a proof, not a sample. It covers every offset
 * value (so every top-two-bit band and every rotate output), both sign-fill arms, the
 * unsigned-compare boundary (playerX == objX), and the sign-bit seams that separate a
 * signed from an unsigned compare.
 *
 *   1. EQUAL (exhaustive) — loc_231a == oracle on RAM (firstStateDiff over the whole
 *      dump, which neither side writes outside the two record cells) across the full grid.
 *
 *   2. TEETH (exhaustive) — four deliberately-broken twins, each of which the same grid
 *      MUST catch:
 *        (a) dropped delta rotate — writes the raw offset to +0x11 instead of the
 *            rotate-left-2; caught on the delta cell (justifies the rotate).
 *        (b) signed compare — treats the two X bytes as signed for the sign fill, so it
 *            flips the code's fill on the sign-bit seams; caught on the code cell
 *            (justifies the unsigned comparison).
 *        (c) weakened sign fill — fills with 0xFE instead of 0xFC, dropping one bit of the
 *            sign extension; caught on the code cell (justifies the exact fill mask).
 *        (d) swapped output offsets — writes the code to +0x11 and the delta to +0x10;
 *            caught by the grid (pins the two field offsets).
 *
 *   3. FRONTIER + crafted realism — 0x231A is a non-executing frontier in attract
 *      (difficulty is 1 there, so the caller takes the 0x22F6 arm): hooking it over a long
 *      attract run captures no natural dispatches, which this test confirms and reports
 *      (and replays any that do occur). It then crafts a handful of dispatches on a REAL
 *      attract-base machine (realistic surrounding RAM) and checks each against the oracle,
 *      so the exhaustive proof is anchored to an in-distribution state.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-231a.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_231a as oracle } from "../../translated/loc_231a.js";
import { loc_231a } from "../loc_231a.js";
import { MARIO_X, OBJ_X } from "../names.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x231a;

// The object record the caller points at (IX). Base 0x6400 is a real object array
// (OBJ_ARRAY_64, stride 0x20, so +0x10/+0x11 fit inside the record) and all three
// touched cells — objX at +0x03, code at +0x10, delta at +0x11 — land in work RAM
// (0x6000-0x6BFF) and never collide with MARIO_X (0x6203).
const IX_BASE = 0x6400;
const CODE_CELL = (IX_BASE + 0x10) & 0xffff;   // 0x6410
const DELTA_CELL = (IX_BASE + 0x11) & 0xffff;  // 0x6411
const OBJX_CELL = (IX_BASE + OBJ_X) & 0xffff;  // 0x6403

// The oracle's terminal return pops the stack; point SP at work RAM so the pop reads
// valid bytes (never I/O). The oracle writes NO RAM through the stack (a leaf: only
// pops), so this choice never affects the compared memory.
const SAFE_SP = 0x6bf8;

// Distinctive sentinel pre-loaded into both output cells so a twin that SKIPS a write
// (rather than writing a wrong value) still diverges from the oracle's write.
const SENTINEL = 0x55;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * A synthetic entry: a clone of `base` with the two input cells set, the record pointer
 * in IX, both output cells sentinel-filled, and a safe stack. The frame machinery is
 * neutralised (clone() already sets nextNmi/nextBoundary = Infinity; re-asserted here)
 * so the oracle's step machinery cannot fire an NMI or push a frame.
 */
function makeEntry(base, marioX, objX) {
  const e = base.clone();
  e.regs.ix = IX_BASE;
  e.mem.write8(MARIO_X, marioX);
  e.mem.write8(OBJX_CELL, objX);
  e.mem.write8(CODE_CELL, SENTINEL);
  e.mem.write8(DELTA_CELL, SENTINEL);
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and the candidate on two FRESH, byte-identical entries and diff the
 * memory-equivalence contract (RAM over the whole dump). A fresh entry per side because
 * the routine WRITES memory — a reused machine would carry the previous run forward.
 */
function runPair(base, marioX, objX, candidate) {
  const a = makeEntry(base, marioX, objX); // oracle
  const b = makeEntry(base, marioX, objX); // candidate
  oracle(a);
  candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { ram };
}

/**
 * The full 256×256 (playerX, objX) grid. Returns the first mismatch (or null) and the
 * total combos compared. This grid is the whole input space, so it is exhaustive.
 */
function fullSweep(base, candidate) {
  let count = 0;
  for (let px = 0; px < 256; px++) {
    for (let ox = 0; ox < 256; ox++) {
      const { ram } = runPair(base, px, ox, candidate);
      count++;
      if (ram) return { mismatch: { marioX: px, objX: ox, ram }, count };
    }
  }
  return { mismatch: null, count };
}

const describeMismatch = (mm) =>
  mm &&
  `at marioX=${hx(mm.marioX)} objX=${hx(mm.objX)}: ` +
    `RAM diverges at 0x${(mm.ram.addr ?? 0).toString(16)} (${mm.ram.a}->${mm.ram.b})`;

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): loc_231a == oracle across the full (playerX, objX) grid", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, loc_231a);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  assert.equal(count, 256 * 256, "must have compared the full two-byte input space");
  console.log(`  EQUAL/exhaustive: ${count} (playerX, objX) combos — RAM identical to the oracle`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/** BUG (a): writes the raw offset to +0x11 instead of the rotate-left-2. Caught wherever
 *  the rotate changes the byte (any offset whose low six bits are non-trivial). */
function brokenNoDeltaRotate(m) {
  const { regs, mem } = m;
  const objBase = regs.ix;
  const offset = (mem.read8(MARIO_X) - mem.read8((objBase + OBJ_X) & 0xffff)) & 0xff;
  const topTwoBits = offset >> 6;
  mem.write8((objBase + 0x10) & 0xffff, (mem.read8(MARIO_X) < mem.read8((objBase + OBJ_X) & 0xffff) ? 0xfc : 0x00) | topTwoBits);
  mem.write8((objBase + 0x11) & 0xffff, offset); // BUG: no rotate
}

/** BUG (b): treats the two X bytes as SIGNED for the sign fill. On the sign-bit seams
 *  (exactly one X has bit 7 set) this flips the fill the oracle's unsigned compare
 *  produces. Caught on the code cell. */
function brokenSignedCompare(m) {
  const { regs, mem } = m;
  const objBase = regs.ix;
  const playerRaw = mem.read8(MARIO_X);
  const objRaw = mem.read8((objBase + OBJ_X) & 0xffff);
  const offset = (playerRaw - objRaw) & 0xff;
  const topTwoBits = offset >> 6;
  const playerS = (playerRaw << 24) >> 24; // BUG: sign-extended
  const objS = (objRaw << 24) >> 24;       // BUG: sign-extended
  mem.write8((objBase + 0x10) & 0xffff, (playerS < objS ? 0xfc : 0x00) | topTwoBits);
  mem.write8((objBase + 0x11) & 0xffff, (offset << 2) | topTwoBits);
}

/** BUG (c): fills with 0xFE instead of 0xFC — drops one bit of the sign extension. Caught
 *  on the code cell wherever the missing bit shows through the top-two-bits value. */
function brokenWeakSignFill(m) {
  const { regs, mem } = m;
  const objBase = regs.ix;
  const offset = (mem.read8(MARIO_X) - mem.read8((objBase + OBJ_X) & 0xffff)) & 0xff;
  const topTwoBits = offset >> 6;
  mem.write8((objBase + 0x10) & 0xffff, (mem.read8(MARIO_X) < mem.read8((objBase + OBJ_X) & 0xffff) ? 0xfe : 0x00) | topTwoBits); // BUG: 0xFE
  mem.write8((objBase + 0x11) & 0xffff, (offset << 2) | topTwoBits);
}

/** BUG (d): swaps the two output offsets — code to +0x11, delta to +0x10. */
function brokenSwappedOffsets(m) {
  const { regs, mem } = m;
  const objBase = regs.ix;
  const offset = (mem.read8(MARIO_X) - mem.read8((objBase + OBJ_X) & 0xffff)) & 0xff;
  const topTwoBits = offset >> 6;
  const code = (mem.read8(MARIO_X) < mem.read8((objBase + OBJ_X) & 0xffff) ? 0xfc : 0x00) | topTwoBits;
  mem.write8((objBase + 0x10) & 0xffff, (offset << 2) | topTwoBits); // BUG: delta at the code offset
  mem.write8((objBase + 0x11) & 0xffff, code);                       // BUG: code at the delta offset
}

test("TEETH (exhaustive): the dropped-delta-rotate twin is CAUGHT (delta byte diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenNoDeltaRotate);
  assert.notEqual(mismatch, null, "the grid FAILED to catch a dropped delta rotate — the RAM check is worthless");
  assert.equal(mismatch.ram.addr, DELTA_CELL, "the no-rotate twin must diverge on the delta cell");
  console.log(`  TEETH/rotate: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the signed-compare twin is CAUGHT (code byte diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenSignedCompare);
  assert.notEqual(mismatch, null, "the grid FAILED to catch a signed comparison — worthless");
  assert.equal(mismatch.ram.addr, CODE_CELL, "the signed-compare twin must diverge on the code cell");
  console.log(`  TEETH/signed: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the weakened-sign-fill twin is CAUGHT (code byte diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenWeakSignFill);
  assert.notEqual(mismatch, null, "the grid FAILED to catch a weakened sign fill — worthless");
  assert.equal(mismatch.ram.addr, CODE_CELL, "the weak-fill twin must diverge on the code cell");
  console.log(`  TEETH/fill: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the swapped-output-offsets twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenSwappedOffsets);
  assert.notEqual(mismatch, null, "the grid FAILED to catch swapped output offsets — worthless");
  console.log(`  TEETH/swapped: caught — ${describeMismatch(mismatch)}`);
});

// -- 3. FRONTIER + crafted realism --------------------------------------------

/**
 * Hook 0x231A in a real attract run and clone the machine at up to K real dispatches.
 * Attract runs at difficulty 1, so the object-velocity dispatcher takes the 0x22F6 arm
 * and 0x231A is a non-executing frontier — we expect zero here, and confirm it.
 */
function captureDispatches(K, maxFrames) {
  const caps = [];
  const snapshot = new Map([[TARGET, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snapshot });
  host.runFrames(maxFrames);
  return caps;
}

test("FRONTIER: 0x231A is a non-executing frontier in attract; any real dispatch matches the oracle", () => {
  const caps = captureDispatches(64, 2000);
  // Replay any that DO occur against the oracle (belt-and-braces if the frontier moves).
  for (const cap of caps) {
    const a = cap.clone(); a.nextNmi = Infinity; a.nextBoundary = Infinity;
    const b = cap.clone(); b.nextNmi = Infinity; b.nextBoundary = Infinity;
    oracle(a);
    loc_231a(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(ram, null, ram && `real dispatch diverges at 0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`);
  }
  console.log(`  FRONTIER: ${caps.length} natural 0x231A dispatches over 2000 attract frames (expected 0 — difficulty-1 attract takes the 0x22F6 arm)`);
});

test("CRAFTED REALISM: crafted dispatches on a real attract-base machine match the oracle", () => {
  // A real, self-consistent machine: boot + a stretch of attract so work RAM holds
  // realistic surrounding values. 0x231A's body is never reached naturally; craft it.
  const host = new Machine(ROM);
  host.runFrames(180);
  const attractBase = host.clone();

  // Representative crafted dispatches: the boundary (player == obj), both sign-fill arms,
  // the sign-bit seams, and offsets that exercise every top-two-bit band of the rotate.
  const cases = [
    { marioX: 0x40, objX: 0x40 }, // boundary -> not-left -> fill 0x00, offset 0x00
    { marioX: 0x3f, objX: 0x40 }, // player left -> fill 0xFC, offset 0xFF (top bits 11)
    { marioX: 0x41, objX: 0x40 }, // player right -> fill 0x00, offset 0x01
    { marioX: 0x80, objX: 0x00 }, // seam: unsigned 0x80 >= 0x00 -> fill 0x00, offset 0x80
    { marioX: 0x00, objX: 0x80 }, // seam: unsigned 0x00 < 0x80 -> fill 0xFC, offset 0x80
    { marioX: 0x00, objX: 0xc1 }, // far-left: offset 0x3F (top bits 00) -> exercises 0xFC|0
    { marioX: 0xff, objX: 0x7f }, // player right (unsigned) -> fill 0x00, offset 0x80
  ];

  for (const { marioX, objX } of cases) {
    const { ram } = runPair(attractBase, marioX, objX, loc_231a);
    assert.equal(
      ram,
      null,
      ram &&
        `crafted dispatch (marioX=${hx(marioX)} objX=${hx(objX)}) ` +
          `diverges at 0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`,
    );
  }
  console.log(`  CRAFTED REALISM: ${cases.length} crafted dispatches on a real attract base — RAM == oracle`);
});
