// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_2ab4 (ROM 0x2AB4) — the slope foot-contact fall check.
 *
 * loc_2ab4 is reached from the foot-contact cascade once Mario's foot-probe tile is a
 * slope. Its whole memory-observable behaviour is: on some branches raise the one-shot
 * MARIO_START_FALL (0x6221) trigger (via triggerMarioFall / the oracle's entry_2acd),
 * on the keeps-footing branch write nothing. It consumes two live-ins from registers —
 * the probe X (regs.d) and the foot-cell tilemap pointer (regs.hl) — because its caller
 * sub_2a85 is still the translated oracle, so this is a genuine register boundary.
 *
 * The oracle NEVER pushes: the three fall branches are `jp`s (rendered `return
 * m.call(0x2acd)` with no push16), and every path's terminal control is a single `ret`
 * that only READS the stack. So no path writes the stack region — the sole memory write
 * on any path is MARIO_START_FALL, and the memory-equivalence contract needs NO
 * STACK_SCRATCH exclusion. Live-out is memory-only; pc/SP are dead (the caller
 * tail-invokes and consumes nothing), so the gate compares RAM only, like the leaf
 * template equivalence-037f.
 *
 * The decision factorises into two independent variables, which is what makes an
 * EXHAUSTIVE gate available:
 *
 *   ALIGNMENT — depends ONLY on the probe X's low 3 bits. When they are zero the fall
 *               is unconditional (independent of any tile). Swept over ALL 256 probe-X
 *               bytes at a fixed solid tile (SWEEP-ALIGN), so every X byte — not just
 *               each residue — is proven.
 *   TILE      — reached only when NOT aligned, and then depends ONLY on the upper tile:
 *               fall iff (tile < 0xB0) OR ((tile & 0x0F) >= 8). Swept over ALL 256 tile
 *               codes at a fixed non-aligned probe X (SWEEP-TILE).
 *   GRID      — the two composed: every low-3-bit residue (0..7) × every tile code
 *               (SWEEP-GRID), so the composition is checked directly, not just inferred.
 *
 * Together these cover the whole (probeX-residue, tile) decision space by that
 * factorisation, so this is a proof, not a sample. Crafted on a real attract base
 * because 0x2AB4 is a non-attract frontier (see REACHABILITY).
 *
 *   1. REACHABILITY — confirm 0x2AB4 is NOT naturally dispatched in attract (it is
 *      poke-reached only), so crafted entries are the right instrument; if any real
 *      dispatch DID occur it is validated against the oracle too.
 *   2. EQUAL (exhaustive) — loc_2ab4 == oracle on RAM across SWEEP-ALIGN + SWEEP-TILE +
 *      SWEEP-GRID.
 *   3. TEETH (exhaustive) — three deliberately-broken twins, one per decision boundary,
 *      each of which the SAME sweeps MUST catch (each diverges on MARIO_START_FALL):
 *        (a) off-by-one solid threshold (`<= 0xB0`) — caught at tile 0xB0.
 *        (b) wrong nibble comparison (`> 8` instead of `>= 8`) — caught at low nibble 8.
 *        (c) wrong alignment mask (`& 0x03`) — caught at residue 4 over a solid tile.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2ab4.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2ab4 as oracle } from "../../translated/loc_2ab4.js";
import { decideSlopeGirderFooting as loc_2ab4 } from "../decideSlopeGirderFooting.js";
import { MARIO_START_FALL } from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2ab4;

// The oracle's terminal `ret` pops the stack; point SP at work RAM so those pops read
// valid bytes (never I/O). The oracle NEVER pushes and its `ret` only reads, so this
// choice never affects the compared memory — it only keeps the oracle well-defined.
const SAFE_SP = 0x6bf8;

// A tilemap cell for the foot probe. Both this cell and the cell one row up (−0x20) sit
// in video RAM, so the crafted upper tile lands in real, mapped memory.
const FOOT_CELL = 0x7500;
const UPPER_CELL = (FOOT_CELL - 0x20) & 0xffff;

// A "solid girder" tile: code >= 0xB0 with a low nibble under 8 — the keeps-footing case,
// so at this tile the ONLY thing that can trigger a fall is column alignment.
const SOLID_TILE = 0xb0;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

// A real, self-consistent machine: boot + a stretch of attract so the surrounding RAM
// holds realistic values. 0x2AB4's inputs are then crafted on top of it.
function attractBase(frames = 180) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone(); // clone neutralises the frame machinery (nextNmi/nextBoundary = Infinity)
}

/**
 * A synthetic entry: a clone of `base` with the two register live-ins set, the upper
 * tile written into video RAM, and a safe stack. Frame machinery re-neutralised so the
 * oracle's step()/ret() cannot fire an NMI or push a frame in isolation.
 */
function makeEntry(base, probeX, upperTile) {
  const e = base.clone();
  e.regs.d = probeX & 0xff;
  e.regs.hl = FOOT_CELL;
  e.mem.write8(UPPER_CELL, upperTile & 0xff);
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and the candidate on two FRESH, byte-identical entries and diff the
 * memory-equivalence contract (RAM over the whole dump — no exclusion needed, the oracle
 * never writes the stack). A fresh entry per side because the routine WRITES memory.
 */
function runPair(base, probeX, upperTile, candidate) {
  const a = makeEntry(base, probeX, upperTile); // oracle
  const b = makeEntry(base, probeX, upperTile); // candidate
  oracle(a);
  candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { ram };
}

/**
 * The three factored sweeps in sequence. Returns the first mismatch (or null) and the
 * total combos compared. By the factorisation in the header these together cover the
 * whole (probeX-residue, tile) input space.
 */
function fullSweep(base, candidate) {
  let count = 0;

  // SWEEP-ALIGN — every probe-X byte at a solid tile: the fall must be exactly
  // (probeX & 7) == 0, independent of the (solid) tile. Proves the alignment decision
  // over all 256 X bytes, not just each residue.
  for (let x = 0; x < 256; x++) {
    const { ram } = runPair(base, x, SOLID_TILE, candidate);
    count++;
    if (ram) return { mismatch: { probeX: x, tile: SOLID_TILE, ram }, count };
  }

  // SWEEP-TILE — every tile code at a fixed NON-aligned probe X (residue 3), so the tile
  // decision is exercised over its whole input: fall iff tile<0xB0 or (tile&0x0f)>=8.
  for (let t = 0; t < 256; t++) {
    const { ram } = runPair(base, 3, t, candidate);
    count++;
    if (ram) return { mismatch: { probeX: 3, tile: t, ram }, count };
  }

  // SWEEP-GRID — every low-3-bit residue × every tile: the two decisions composed.
  for (let r = 0; r < 8; r++) {
    for (let t = 0; t < 256; t++) {
      const { ram } = runPair(base, r, t, candidate);
      count++;
      if (ram) return { mismatch: { probeX: r, tile: t, ram }, count };
    }
  }

  return { mismatch: null, count };
}

const describeMismatch = (mm) =>
  mm &&
  `at probeX=${hx(mm.probeX)} tile=${hx(mm.tile)}: RAM diverges at ` +
    `0x${(mm.ram.addr ?? 0).toString(16)} (${mm.ram.a}->${mm.ram.b})`;

// -- 1. REACHABILITY ----------------------------------------------------------

test("REACHABILITY: 0x2AB4 is a non-attract frontier (poke-reached only)", () => {
  const caps = [];
  let count = 0;
  const orig = new Machine(ROM).routines.get(TARGET);
  const snap = new Map([[TARGET, (mm) => {
    count++;
    if (caps.length < 64) caps.push(mm.clone());
    return orig(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(2000);

  // Any real dispatch that DID occur must also match the oracle (belt-and-suspenders).
  for (const cap of caps) {
    const a = cap.clone(); a.nextNmi = Infinity; a.nextBoundary = Infinity;
    const b = cap.clone(); b.nextNmi = Infinity; b.nextBoundary = Infinity;
    oracle(a);
    loc_2ab4(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(ram, null, ram && `real dispatch diverges at 0x${(ram.addr ?? 0).toString(16)}`);
  }
  console.log(`  REACHABILITY: ${count} natural 0x2AB4 dispatches in 2000 attract frames (frontier — crafted entries carry the proof)`);
});

// -- 2. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): loc_2ab4 == oracle across the factored decision space", () => {
  const base = attractBase();
  const { mismatch, count } = fullSweep(base, loc_2ab4);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  // 256 align + 256 tile + 8*256 grid
  assert.equal(count, 256 + 256 + 8 * 256, "must have compared the full factored input space");
  console.log(`  EQUAL/exhaustive: ${count} (probeX, tile) combos — RAM identical to the oracle`);
});

// -- 3. TEETH (exhaustive) ----------------------------------------------------

/** BUG (a): off-by-one solid threshold — treats 0xB0 as NOT solid, so it falls at the
 *  boundary tile where the oracle keeps footing. Caught in SWEEP-TILE / SWEEP-GRID. */
function brokenThreshold(m) {
  const { regs, mem } = m;
  const probeX = regs.d;
  if ((probeX & 0x07) === 0) return triggerMarioFallLocal(m);
  const upperTile = mem.read8((regs.hl - 0x20) & 0xffff);
  if (upperTile <= 0xb0) return triggerMarioFallLocal(m); // BUG: `<=` should be `<`
  if ((upperTile & 0x0f) >= 8) return triggerMarioFallLocal(m);
}

/** BUG (b): wrong nibble comparison — keeps footing at low nibble exactly 8 where the
 *  oracle falls. Caught wherever (tile & 0x0f) == 8 and tile >= 0xB0. */
function brokenNibble(m) {
  const { regs, mem } = m;
  const probeX = regs.d;
  if ((probeX & 0x07) === 0) return triggerMarioFallLocal(m);
  const upperTile = mem.read8((regs.hl - 0x20) & 0xffff);
  if (upperTile < 0xb0) return triggerMarioFallLocal(m);
  if ((upperTile & 0x0f) > 8) return triggerMarioFallLocal(m); // BUG: `>` should be `>=`
}

/** BUG (c): wrong alignment mask — tests only the low 2 bits, so it falls at residue 4
 *  (offset 4) where the oracle would inspect the tile and keep footing. Caught in
 *  SWEEP-GRID at residue 4 over the solid tile. */
function brokenMask(m) {
  const { regs, mem } = m;
  const probeX = regs.d;
  if ((probeX & 0x03) === 0) return triggerMarioFallLocal(m); // BUG: `& 0x03` should be `& 0x07`
  const upperTile = mem.read8((regs.hl - 0x20) & 0xffff);
  if (upperTile < 0xb0) return triggerMarioFallLocal(m);
  if ((upperTile & 0x0f) >= 8) return triggerMarioFallLocal(m);
}

// The twins raise the same trigger the real routine does, so a caught twin diverges on
// MARIO_START_FALL — never a spurious cell.
function triggerMarioFallLocal(m) {
  m.mem.write8(MARIO_START_FALL, 1);
}

test("TEETH (exhaustive): the off-by-one-threshold twin is CAUGHT on MARIO_START_FALL", () => {
  const base = attractBase();
  const { mismatch } = fullSweep(base, brokenThreshold);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch an off-by-one solid threshold — worthless");
  assert.equal(mismatch.ram.addr, MARIO_START_FALL, "the threshold twin must diverge on MARIO_START_FALL");
  console.log(`  TEETH/threshold: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the wrong-nibble twin is CAUGHT on MARIO_START_FALL", () => {
  const base = attractBase();
  const { mismatch } = fullSweep(base, brokenNibble);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong nibble comparison — worthless");
  assert.equal(mismatch.ram.addr, MARIO_START_FALL, "the nibble twin must diverge on MARIO_START_FALL");
  console.log(`  TEETH/nibble: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the wrong-alignment-mask twin is CAUGHT on MARIO_START_FALL", () => {
  const base = attractBase();
  const { mismatch } = fullSweep(base, brokenMask);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong alignment mask — worthless");
  assert.equal(mismatch.ram.addr, MARIO_START_FALL, "the mask twin must diverge on MARIO_START_FALL");
  console.log(`  TEETH/mask: caught — ${describeMismatch(mismatch)}`);
});
