// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for rowColToTileOffset (ROM 0x3dae) — the (row,col) tile-cell to
 * 16-bit tilemap-offset calc (offset = row*32 + col, stored at 0x805a).
 *
 * The routine reads two RAM bytes (TILE_ROW / TILE_COL) and writes one 16-bit RAM
 * word (0x805a), so it is gated on MEMORY-equivalence, not on a returned register,
 * and its declared live-out is memory-only: every caller reads the offset back from
 * memory (via the cursor-derivation step loc_3dc9), never from a leftover register,
 * so the value registers the oracle leaves behind are dead and not reproduced.
 *
 * Its VISIBLE behaviour is a pure function of the two input bytes, so it is proven
 * the strongest practical way:
 *
 *   0. IDENTITY — run the unit gate with both arms = the oracle; EQUAL proves the
 *      harness wiring (construct-with-override -> host run -> capture -> clone -> diff)
 *      works on The Pit at all.
 *   1. EQUAL (exhaustive) — poke all 65,536 (row,col) pairs onto a real captured
 *      entry and confirm rowColToTileOffset writes the SAME 0x805a offset as the
 *      oracle over the whole input domain.
 *   2. EQUAL (real dispatches, full contract) — hook 0x3dae in a real attract run
 *      (many panel/record plotters feed it different row/col) and, for each capture,
 *      run the oracle on one clone and rowColToTileOffset on another and confirm they
 *      leave identical RAM + pc + SP. This proves the candidate writes ONLY 0x805a on
 *      the real surrounding state — i.e. the memory-only signature is honest.
 *   3. TEETH — a deliberately-broken twin (tilemap width 16 instead of 32) MUST be
 *      caught, both by the exhaustive sweep and on a crafted row>0 entry.
 *
 * The idiomatic routine models the return as a plain JS return (no stack modelling),
 * so the contract check performs one m.ret() on the candidate clone AFTER the call to
 * line pc + SP up with the oracle (which rets internally).
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3dae.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3dae as oracle } from "../../translated/loc_3dae.js";
import { rowColToTileOffset } from "../rowColToTileOffset.js";
import { TILE_ROW, TILE_COL } from "../ram.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x3dae;
const OUT = 0x805a; // the 16-bit tilemap-offset output cell
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/** The little-endian 16-bit offset the routine stored at 0x805a. */
function readOffset(m) {
  return m.mem.read8(OUT) | (m.mem.read8(OUT + 1) << 8);
}

/**
 * Hook 0x3dae in a real attract run and clone the machine at up to K real dispatches.
 * The wrapper snapshots the entry state, then runs the oracle so the host game
 * proceeds undisturbed. Attract's title/panel draws dispatch it from several plotters
 * (drawPlayerLabel, loc_4816, drawMenLeftPanel, drawCreditsDisplay, showSetupScreen, loc_4df8) with varied row/col.
 */
function captureDispatches(K, maxFrames) {
  const caps = [];
  const snapshot = new Map([[TARGET, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(maxFrames);
  return caps;
}

/** First differing RAM byte between two machines (or null). */
function firstRamDiff(a, b) {
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/**
 * Compare a candidate against the oracle over the memory-equivalence contract for one
 * entry: RAM + pc + SP (value registers are the declared-dead live-out and excluded).
 * The oracle rets internally; the candidate's return is modelled with one m.ret().
 */
function contractDiffs(entry, fn) {
  const o = entry.clone();
  oracle(o);
  const c = entry.clone();
  fn(c);
  c.ret();

  const diffs = [];
  const ram = firstRamDiff(o, c);
  if (ram) diffs.push(`RAM@0x${(ram.addr ?? ram.offset).toString(16)} oracle=${ram.a} cand=${ram.b}`);
  if (o.pc !== c.pc) diffs.push(`pc oracle=${hx(o.pc)} cand=${hx(c.pc)}`);
  if (o.regs.sp !== c.regs.sp) diffs.push(`SP oracle=${hx(o.regs.sp)} cand=${hx(c.regs.sp)}`);
  return diffs;
}

/**
 * Exhaustive sweep of the input domain: for every (row,col) pair, poke both bytes on
 * a reused clone and compare the offset the candidate stores against the oracle's.
 * The reused oracle clone rets internally, so its SP is reset each pass; nothing else
 * accumulates (both sides overwrite only 0x805a). Returns the first mismatch or null.
 */
function sweep(candidate, seed) {
  const oM = seed.clone();
  const cM = seed.clone();
  let count = 0;
  for (let row = 0; row < 256; row++) {
    for (let col = 0; col < 256; col++) {
      oM.mem.write8(TILE_ROW, row);
      oM.mem.write8(TILE_COL, col);
      oM.regs.sp = 0x83fc; // keep the internal ret's pop from drifting SP across passes
      oracle(oM);
      const want = readOffset(oM);

      cM.mem.write8(TILE_ROW, row);
      cM.mem.write8(TILE_COL, col);
      candidate(cM);
      const got = readOffset(cM);

      count++;
      if (want !== got) return { mismatch: { row, col, want, got }, count };
    }
  }
  return { mismatch: null, count };
}

/** Broken twin: tilemap width 16 instead of 32 — wrong offset whenever row > 0. */
function brokenRowColToTileOffset(m) {
  const { mem } = m;
  const row = mem.read8(TILE_ROW);
  const col = mem.read8(TILE_COL);
  mem.write16(OUT, 16 * row + col); // BUG: the tilemap is 32 cells wide, not 16
}

// -- 0. IDENTITY --------------------------------------------------------------

test("IDENTITY: the unit gate runs on The Pit and reports EQUAL when both arms are the oracle", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, oracle);
  assert.equal(
    res.equal,
    true,
    `gate reported a diff for identical arms: ram=${JSON.stringify(res.ram)} regs=${JSON.stringify(res.regs)}`,
  );
  console.log("  IDENTITY: captured 0x3dae, cloned, ran oracle vs oracle -> EQUAL");
});

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): rowColToTileOffset == oracle over all 65,536 (row,col) pairs", () => {
  const seed = captureDispatches(1, 400)[0];
  assert.ok(seed, "expected at least one real 0x3dae dispatch during attract");

  const { mismatch, count } = sweep(rowColToTileOffset, seed);
  assert.equal(
    mismatch,
    null,
    mismatch &&
      `mismatch at row=${hx(mismatch.row)} col=${hx(mismatch.col)}: oracle=${hx(mismatch.want)} cand=${hx(mismatch.got)}`,
  );
  assert.equal(count, 256 * 256, "must have compared the full 65,536-pair domain");
  console.log(`  EQUAL/exhaustive: ${count} (row,col) pairs store an identical offset to the oracle`);
});

// -- 2. EQUAL (real dispatches, full contract) --------------------------------

test("EQUAL (real dispatches): rowColToTileOffset == oracle on every captured 0x3dae entry", () => {
  const caps = captureDispatches(64, 1200);
  assert.ok(caps.length >= 1, "expected at least one real 0x3dae dispatch during attract");
  for (const cap of caps) {
    const diffs = contractDiffs(cap, rowColToTileOffset); // fresh clones inside — cap untouched
    assert.equal(diffs.length, 0, diffs.join("; "));
  }
  const s = caps[0];
  console.log(
    `  EQUAL/real: ${caps.length} captured dispatches identical over RAM+pc+SP ` +
      `(sample row=${hx(s.mem.read8(TILE_ROW))} col=${hx(s.mem.read8(TILE_COL))})`,
  );
});

// -- 3. TEETH -----------------------------------------------------------------

test("TEETH: the wrong-tilemap-width twin is CAUGHT", () => {
  const caps = captureDispatches(8, 1200);
  assert.ok(caps.length >= 1, "need a real capture to seed the teeth check");

  // Exhaustive sweep must catch the twin somewhere in the domain.
  const { mismatch, count } = sweep(brokenRowColToTileOffset, caps[0]);
  assert.notEqual(mismatch, null, "the exhaustive sweep FAILED to catch a wrong tilemap width — it is worthless");

  // And on a crafted row>0 entry (row=12, col=1), the full contract must fail too.
  const crafted = caps[0].clone();
  crafted.mem.write8(TILE_ROW, 12);
  crafted.mem.write8(TILE_COL, 1);
  const craftedDiffs = contractDiffs(crafted, brokenRowColToTileOffset);
  assert.ok(craftedDiffs.length > 0, "the twin escaped the full-contract check on a crafted row=12 entry");

  console.log(
    `  TEETH: wrong-width twin caught after ${count} sweep pairs ` +
      `at row=${hx(mismatch.row)} col=${hx(mismatch.col)} (oracle=${hx(mismatch.want)} broken=${hx(mismatch.got)}) ` +
      `and on the crafted entry (${craftedDiffs[0]})`,
  );
});
