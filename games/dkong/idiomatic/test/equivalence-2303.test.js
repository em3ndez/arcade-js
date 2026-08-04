// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_2303 (ROM 0x2303) — the difficulty-3/4 object-velocity
 * arm: seed a record's step magnitude from the random byte and its step direction
 * toward the player.
 *
 * loc_2303 is a LEAF whose entire memory-observable behaviour is a function of THREE
 * input bytes — RANDOM (0x6018), MARIO_X (0x6203), and the record's own X at +0x03
 * (OBJ_X) — plus the record pointer (IX live-in). It writes only two cells, and they
 * are INDEPENDENT functions of DISJOINT inputs:
 *
 *   +0x11 (step magnitude)  = RANDOM                                — depends on RANDOM only
 *   +0x10 (step direction)  = (MARIO_X < objX) ? 0xFF : 0x01        — depends on (MARIO_X, objX) only
 *
 * It returns nothing a caller consumes (the caller tail-calls it; its two early
 * writes ARE the whole job), and it never writes the stack (a leaf that only pops via
 * its terminal return), so the contract is memory-only over the WHOLE dump — no
 * STACK_SCRATCH exclusion is needed. That factorisation makes an EXHAUSTIVE gate
 * available:
 *
 *   SWEEP A — random-byte copy, BOTH direction arms: all 256 RANDOM values under a
 *             player-right (no-carry) comparison and again under a player-left (carry)
 *             one. Pins +0x11 == RANDOM for every value and that +0x10 stays the arm's
 *             constant while RANDOM varies.
 *   SWEEP B — the full 256×256 (MARIO_X, objX) grid with RANDOM fixed. Pins the +0x10
 *             toward-player sign over every pair (the diagonal, the sign-bit seams that
 *             separate a signed from an unsigned compare, and both extremes) and that
 *             +0x11 stays the fixed RANDOM constant while the comparison varies.
 *
 * Together the two sweeps cover the full (RANDOM, MARIO_X, objX) space by that
 * factorisation, so this is a proof, not a sample.
 *
 *   1. EQUAL (exhaustive) — loc_2303 == oracle on RAM (firstStateDiff over the whole
 *      dump, which neither side writes outside the two record cells) across both sweeps.
 *
 *   2. TEETH (exhaustive) — three deliberately-broken twins, each of which the same
 *      sweeps MUST catch:
 *        (a) signed compare — treats the two X bytes as signed, so it flips the
 *            direction on the sign-bit seams; caught by SWEEP B (justifies the unsigned
 *            comparison).
 *        (b) inverted direction — emits +1 where the oracle emits −1 and vice-versa;
 *            caught wherever the sign matters.
 *        (c) swapped output offsets — writes the magnitude to +0x10 and the direction
 *            to +0x11; caught by either sweep (pins the two field offsets).
 *
 *   3. FRONTIER + crafted realism — 0x2303 is a non-executing frontier in attract
 *      (difficulty is 1 there, so the caller takes the 0x22F6 arm): hooking it over a
 *      long attract run captures no natural dispatches, which this test confirms and
 *      reports (and replays any that do occur). It then crafts a handful of dispatches
 *      on a REAL attract-base machine (realistic surrounding RAM) and checks each
 *      against the oracle, so the exhaustive proof is anchored to an in-distribution state.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2303.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2303 as oracle } from "../../translated/loc_2303.js";
import { loc_2303 } from "../loc_2303.js";
import { RANDOM, MARIO_X, OBJ_X } from "../names.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2303;

// The object record the caller points at (IX). Base 0x6400 is a real object array
// (OBJ_ARRAY_64, stride 0x20, so +0x10/+0x11 fit inside the record) and all three
// touched cells — objX at +0x03, direction at +0x10, magnitude at +0x11 — land in
// work RAM (0x6000-0x6BFF) and never collide with RANDOM (0x6018) or MARIO_X (0x6203).
const IX_BASE = 0x6400;
const DIR_CELL = (IX_BASE + 0x10) & 0xffff; // 0x6410
const MAG_CELL = (IX_BASE + 0x11) & 0xffff; // 0x6411
const OBJX_CELL = (IX_BASE + OBJ_X) & 0xffff; // 0x6403

// The oracle's terminal return pops the stack; point SP at work RAM so the pop reads
// valid bytes (never I/O). The oracle writes NO RAM through the stack (a leaf: only
// pops), so this choice never affects the compared memory.
const SAFE_SP = 0x6bf8;

// Distinctive sentinel pre-loaded into both output cells so a twin that SKIPS a write
// (rather than writing a wrong value) still diverges from the oracle's write.
const SENTINEL = 0xaa;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * A synthetic entry: a clone of `base` with the three input cells set, the record
 * pointer in IX, both output cells sentinel-filled, and a safe stack. The frame
 * machinery is neutralised (clone() already sets nextNmi/nextBoundary = Infinity;
 * re-asserted here) so the oracle's step machinery cannot fire an NMI or push a frame.
 */
function makeEntry(base, random, marioX, objX) {
  const e = base.clone();
  e.regs.ix = IX_BASE;
  e.mem.write8(RANDOM, random);
  e.mem.write8(MARIO_X, marioX);
  e.mem.write8(OBJX_CELL, objX);
  e.mem.write8(DIR_CELL, SENTINEL);
  e.mem.write8(MAG_CELL, SENTINEL);
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
function runPair(base, random, marioX, objX, candidate) {
  const a = makeEntry(base, random, marioX, objX); // oracle
  const b = makeEntry(base, random, marioX, objX); // candidate
  oracle(a);
  candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { ram };
}

/**
 * The two disjoint factored sweeps, run in sequence. Returns the first mismatch (or
 * null) and the total combos compared. By the factorisation in the file header these
 * two sweeps together cover the whole (RANDOM, MARIO_X, objX) input space.
 */
function fullSweep(base, candidate) {
  let count = 0;

  // SWEEP A — random-byte copy under BOTH direction arms. player-right (0x50 >= 0x40)
  // gives dir 0x01; player-left (0x40 < 0x50) gives dir 0xFF. Every RANDOM value tested
  // against +0x11 under each arm.
  for (let r = 0; r < 256; r++) {
    for (const [px, ox] of [[0x50, 0x40], [0x40, 0x50]]) {
      const { ram } = runPair(base, r, px, ox, candidate);
      count++;
      if (ram) return { mismatch: { random: r, marioX: px, objX: ox, ram }, count };
    }
  }

  // SWEEP B — the full comparison grid with RANDOM fixed. Every (MARIO_X, objX) pair
  // tested against the +0x10 toward-player sign; +0x11 must stay the fixed constant.
  const FIXED_RANDOM = 0x5a;
  for (let px = 0; px < 256; px++) {
    for (let ox = 0; ox < 256; ox++) {
      const { ram } = runPair(base, FIXED_RANDOM, px, ox, candidate);
      count++;
      if (ram) return { mismatch: { random: FIXED_RANDOM, marioX: px, objX: ox, ram }, count };
    }
  }

  return { mismatch: null, count };
}

const describeMismatch = (mm) =>
  mm &&
  `at random=${hx(mm.random)} marioX=${hx(mm.marioX)} objX=${hx(mm.objX)}: ` +
    `RAM diverges at 0x${(mm.ram.addr ?? 0).toString(16)} (${mm.ram.a}->${mm.ram.b})`;

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): loc_2303 == oracle across both factored sweeps", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, loc_2303);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  // 256 randoms * 2 arms + full 256*256 comparison grid
  assert.equal(count, 256 * 2 + 256 * 256, "must have compared the full factored input space");
  console.log(`  EQUAL/exhaustive: ${count} (random, playerX, objX) combos — RAM identical to the oracle`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/**
 * BUG (a): treats the two X bytes as SIGNED. On the sign-bit seams (exactly one X has
 * bit 7 set) this flips the toward-player direction the oracle's unsigned compare
 * produces. Invisible on same-sign pairs; caught by SWEEP B.
 */
function brokenSignedCompare(m) {
  const { regs, mem } = m;
  const objBase = regs.ix;
  mem.write8((objBase + 0x11) & 0xffff, mem.read8(RANDOM));
  const playerX = (mem.read8(MARIO_X) << 24) >> 24;               // BUG: sign-extended
  const objX = (mem.read8((objBase + OBJ_X) & 0xffff) << 24) >> 24; // BUG: sign-extended
  mem.write8((objBase + 0x10) & 0xffff, playerX < objX ? 0xff : 0x01);
}

/** BUG (b): inverts the direction — emits +1 where the oracle emits −1 and vice-versa. */
function brokenInvertedDirection(m) {
  const { regs, mem } = m;
  const objBase = regs.ix;
  mem.write8((objBase + 0x11) & 0xffff, mem.read8(RANDOM));
  const playerLeft = mem.read8(MARIO_X) < mem.read8((objBase + OBJ_X) & 0xffff);
  mem.write8((objBase + 0x10) & 0xffff, playerLeft ? 0x01 : 0xff); // BUG: arms swapped
}

/** BUG (c): swaps the two output offsets — magnitude to +0x10, direction to +0x11. */
function brokenSwappedOffsets(m) {
  const { regs, mem } = m;
  const objBase = regs.ix;
  const playerLeft = mem.read8(MARIO_X) < mem.read8((objBase + OBJ_X) & 0xffff);
  mem.write8((objBase + 0x10) & 0xffff, mem.read8(RANDOM));        // BUG: magnitude at the dir offset
  mem.write8((objBase + 0x11) & 0xffff, playerLeft ? 0xff : 0x01); // BUG: direction at the mag offset
}

test("TEETH (exhaustive): the signed-compare twin is CAUGHT (direction byte diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenSignedCompare);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a signed comparison — the RAM check is worthless");
  assert.equal(mismatch.ram.addr, DIR_CELL, "the signed-compare twin must diverge on the direction cell");
  console.log(`  TEETH/signed: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the inverted-direction twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenInvertedDirection);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch an inverted direction — worthless");
  assert.equal(mismatch.ram.addr, DIR_CELL, "the inverted-direction twin must diverge on the direction cell");
  console.log(`  TEETH/inverted: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the swapped-output-offsets twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenSwappedOffsets);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch swapped output offsets — worthless");
  console.log(`  TEETH/swapped: caught — ${describeMismatch(mismatch)}`);
});

// -- 3. FRONTIER + crafted realism --------------------------------------------

/**
 * Hook 0x2303 in a real attract run and clone the machine at up to K real dispatches.
 * Attract runs at difficulty 1, so the object-velocity dispatcher takes the 0x22F6
 * arm and 0x2303 is a non-executing frontier — we expect zero here, and confirm it.
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

test("FRONTIER: 0x2303 is a non-executing frontier in attract; any real dispatch matches the oracle", () => {
  const caps = captureDispatches(64, 2000);
  // Replay any that DO occur against the oracle (belt-and-braces if the frontier moves).
  for (const cap of caps) {
    const a = cap.clone(); a.nextNmi = Infinity; a.nextBoundary = Infinity;
    const b = cap.clone(); b.nextNmi = Infinity; b.nextBoundary = Infinity;
    oracle(a);
    loc_2303(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(ram, null, ram && `real dispatch diverges at 0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`);
  }
  console.log(`  FRONTIER: ${caps.length} natural 0x2303 dispatches over 2000 attract frames (expected 0 — difficulty-1 attract takes the 0x22F6 arm)`);
});

test("CRAFTED REALISM: crafted dispatches on a real attract-base machine match the oracle", () => {
  // A real, self-consistent machine: boot + a stretch of attract so work RAM holds
  // realistic surrounding values. 0x2303's body is never reached naturally; craft it.
  const host = new Machine(ROM);
  host.runFrames(180);
  const attractBase = host.clone();

  // Representative crafted dispatches: both direction arms, the boundary (player == obj),
  // the sign-bit seams, and random-byte extremes.
  const cases = [
    { random: 0x00, marioX: 0x40, objX: 0x40 }, // boundary -> player not-left -> +1
    { random: 0xff, marioX: 0x3f, objX: 0x40 }, // player left -> -1
    { random: 0x5a, marioX: 0x41, objX: 0x40 }, // player right -> +1
    { random: 0x80, marioX: 0x80, objX: 0x00 }, // seam: unsigned 0x80 >= 0x00 -> +1
    { random: 0x01, marioX: 0x00, objX: 0x80 }, // seam: unsigned 0x00 < 0x80 -> -1
    { random: 0x7f, marioX: 0xff, objX: 0x7f }, // player right (unsigned) -> +1
  ];

  for (const { random, marioX, objX } of cases) {
    const { ram } = runPair(attractBase, random, marioX, objX, loc_2303);
    assert.equal(
      ram,
      null,
      ram &&
        `crafted dispatch (random=${hx(random)} marioX=${hx(marioX)} objX=${hx(objX)}) ` +
          `diverges at 0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`,
    );
  }
  console.log(`  CRAFTED REALISM: ${cases.length} crafted dispatches on a real attract base — RAM == oracle`);
});
