// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_47a1 (ROM 0x47a1) — draws the rightmost playfield
 * column: a 28-tile strip from work RAM (0x8282..) up video column 31, a base colour
 * fill of the whole column (via the still-oracle colour-column fill loc_3e1d), then
 * three 3-cell colour accents (6, 4, 7). 56 display cells in all.
 *
 * loc_47a1 loads its own destinations, counts, and colours; the only state it reads
 * is the work-RAM tile strip, which both arms read identically. Its declared LIVE-OUT
 * is memory-only (the tile + colour cells the callee's cached colour byte); the
 * register file and flags it leaves behind are dead ABI. So the contract compares
 * RAM + pc + SP and NEVER the register file.
 *
 * WHY THE MID-ROUTINE m.call MATTERS. loc_47a1 is not a leaf: it calls the frozen
 * oracle colour-column fill loc_3e1d, which performs its own return. The idiomatic
 * routine reproduces the oracle's stack push before that call so the callee pops a
 * matching return address — that is why RAM (including the pushed stack bytes), pc,
 * and SP all line up. The idiomatic routine models loc_47a1's OWN final return as the
 * JS call stack, so the harness runs one m.ret() on the candidate to line pc + SP up
 * with the oracle (which performs that final net return itself).
 *
 * WHY NOT unitEquivalence's own verdict: that gate diffs the FULL register file, so it
 * reports equal:false here purely because of the dead residual registers the two arms
 * leave (loc_47a1's own pointer/colour dance vs the callee's leftovers), while RAM and
 * pc are identical. That is exactly the dead-difference a memory-only live-out is
 * allowed to have — so the contract below compares RAM + pc + SP. The first test pins
 * that down: unitEquivalence's ONLY disagreement is a register, with RAM and pc equal.
 *
 *   1. LIVE-OUT — unitEquivalence's only disagreement is a dead register (RAM + pc
 *      equal), justifying the memory-equivalence contract.
 *   2. EQUAL (real dispatch) — capture the true 0x47a1 entry in an attract run; oracle
 *      vs idiomatic leave identical RAM + pc + SP. Repeated over extra sampled attract
 *      states for breadth.
 *   3. SENTINEL (crafted) — over a marker-filled colour+video background (and a marked
 *      tile strip) the oracle writes exactly 56 display cells (non-vacuous) and the
 *      idiomatic routine matches.
 *   4. TEETH — two deliberately-broken twins, each CAUGHT on the sentinel background.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-47a1.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_47a1 as oracle } from "../../translated/loc_47a1.js";
import { loc_0066 as nmiOracle } from "../../translated/loc_0066.js";
import { loc_47a1 as idiomatic } from "../loc_47a1.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x47a1;
const NMI = 0x0066;
const CAP_FRAMES = 800; // loc_47a1's first attract dispatch lands well within this
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- the memory-equivalence contract ------------------------------------------

/** First RAM byte that differs between two machines (full dump, nothing excluded), or null. */
function firstRamDiff(a, b) {
  const da = a.dumpState(), db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] !== db[i]) return { addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] };
  }
  return null;
}

/** Run the ORACLE on a fresh clone. It performs its own net return, so pc/SP advance. */
function runOracle(entry) {
  const c = entry.clone();
  oracle(c);
  return c;
}

/**
 * Run a candidate on a fresh clone, then model its single net return with one m.ret()
 * so pc + SP line up with the oracle's (the idiomatic routine reproduces the callee's
 * stack push itself, but models its OWN final return as the JS call stack — the
 * harness supplies that return here).
 */
function runCandidate(entry, fn) {
  const c = entry.clone();
  fn(c);
  c.ret();
  return c;
}

/** Compare candidate vs oracle over RAM + pc + SP. Registers/flags are memory-only live-out, not compared. */
function contractDiffs(entry, fn) {
  const o = runOracle(entry);
  const c = runCandidate(entry, fn);
  const diffs = [];
  const ram = firstRamDiff(o, c);
  if (ram) diffs.push(`RAM@${hx(ram.addr)} oracle=${ram.a} cand=${ram.b}`);
  if (o.pc !== c.pc) diffs.push(`pc oracle=${hx(o.pc)} cand=${hx(c.pc)}`);
  if (o.regs.sp !== c.regs.sp) diffs.push(`SP oracle=${hx(o.regs.sp)} cand=${hx(c.regs.sp)}`);
  return diffs;
}

// -- capture ------------------------------------------------------------------

/** Capture the machine at the true 0x47a1 dispatch during an attract run (single runFrames — no NMI-timing skew). */
function captureRealDispatch(maxFrames) {
  let entry = null;
  const snapshot = new Map([[TARGET, (mm) => {
    if (!entry) entry = mm.clone();
    return oracle(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(maxFrames);
  return entry;
}

/** Sample up to K extra realistic machine states across the attract cycle (every-frame service hook, single run). */
function captureAttractStates(K, maxFrames) {
  const caps = [];
  let ticks = 0;
  const snapshot = new Map([[NMI, (mm) => {
    ticks += 1;
    if (ticks % 15 === 0 && caps.length < K) caps.push(mm.clone());
    return nmiOracle(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(maxFrames);
  return caps;
}

/**
 * Sentinel-fill the colour (0x8800-0x8BFF) + video (0x9000-0x93FF) RAM and mark the
 * tile strip (0x8282-0x829D) so every one of the routine's display writes is a real
 * change. The strip marker is distinct from the display sentinel so the copied tiles
 * are visible too.
 */
function sentinelFill(m, bgVal, stripVal) {
  for (let a = 0x8800; a <= 0x8bff; a++) m.mem.write8(a, bgVal);
  for (let a = 0x9000; a <= 0x93ff; a++) m.mem.write8(a, bgVal);
  for (let a = 0x8282; a <= 0x829d; a++) m.mem.write8(a, stripVal);
}

/** Count how many display cells (video + colour RAM) the ORACLE changes from `entry`. */
function oracleDisplayWriteCount(entry) {
  const before = entry.clone();
  const after = runOracle(entry);
  let n = 0;
  for (let a = 0x9000; a <= 0x93ff; a++) if (before.mem.read8(a) !== after.mem.read8(a)) n += 1;
  for (let a = 0x8800; a <= 0x8bff; a++) if (before.mem.read8(a) !== after.mem.read8(a)) n += 1;
  return n;
}

// -- broken twins -------------------------------------------------------------
// Each twin is the correct routine with ONE surgical bug, keeping the same stack
// push + callee call so the ONLY divergence is the intended display-cell difference.

/** BUG: the bottom accent band uses colour 5 instead of 6 — those 3 cells diverge. */
function teethWrongAccent(m) {
  const { mem, regs } = m;
  let src = 0x8282, cell = 0x93bf;
  for (let i = 0; i < 28; i++) { mem.write8(cell, mem.read8(src)); src += 1; cell -= 32; }
  regs.c = 2; regs.a = 31; m.push16(0x47bd); m.call(0x3e1d);
  let c = 0x8b9f; for (let i = 0; i < 3; i++) { mem.write8(c, 5); c -= 32; } // BUG: should be 6
  c = 0x8a7f; for (let i = 0; i < 3; i++) { mem.write8(c, 4); c -= 32; }
  c = 0x895f; for (let i = 0; i < 3; i++) { mem.write8(c, 7); c -= 32; }
}

/** BUG: the tile strip is written one row too high (starts at 0x939f) — the whole picture shifts. */
function teethShiftedStrip(m) {
  const { mem, regs } = m;
  let src = 0x8282, cell = 0x939f; // BUG: should start at 0x93bf
  for (let i = 0; i < 28; i++) { mem.write8(cell, mem.read8(src)); src += 1; cell -= 32; }
  regs.c = 2; regs.a = 31; m.push16(0x47bd); m.call(0x3e1d);
  let c = 0x8b9f; for (let i = 0; i < 3; i++) { mem.write8(c, 6); c -= 32; }
  c = 0x8a7f; for (let i = 0; i < 3; i++) { mem.write8(c, 4); c -= 32; }
  c = 0x895f; for (let i = 0; i < 3; i++) { mem.write8(c, 7); c -= 32; }
}

// -- 1. LIVE-OUT is memory-only ------------------------------------------------

test("LIVE-OUT: unitEquivalence's only disagreement is a dead register (RAM + pc equal)", () => {
  // Candidate wrapped with the net return so unitEquivalence's clone-run lines pc/SP up.
  const idiomaticWithRet = (m) => { idiomatic(m); m.ret(); };
  const res = unitEquivalence(makeMachine, TARGET, oracle, idiomaticWithRet, { maxFrames: CAP_FRAMES });
  assert.equal(res.ram, null, "RAM must be identical — the whole point of the routine");
  assert.equal(res.pc, null, "pc must be identical after the modelled return");
  assert.notEqual(res.regs, null, "expected the dead residual register to differ (memory-only live-out)");
  console.log(
    `  LIVE-OUT: RAM + pc identical; sole diff is dead register ${res.regs.reg} ` +
      `(oracle=${res.regs.a} idiomatic=${res.regs.b}) — outside the memory-equivalence contract`,
  );
});

// -- 2. EQUAL: real dispatch + sampled attract states --------------------------

test("EQUAL: idiomatic loc_47a1 == oracle at the real dispatch and on sampled attract states", () => {
  const real = captureRealDispatch(CAP_FRAMES);
  assert.ok(real, "expected a real 0x47a1 dispatch during attract");
  assert.equal(contractDiffs(real, idiomatic).length, 0, "real-dispatch entry: " + contractDiffs(real, idiomatic).join("; "));

  const extra = captureAttractStates(16, CAP_FRAMES);
  assert.ok(extra.length >= 4, `expected several sampled attract states, got ${extra.length}`);
  for (const cap of extra) {
    const diffs = contractDiffs(cap, idiomatic);
    assert.equal(diffs.length, 0, diffs.join("; "));
  }
  console.log(`  EQUAL: real 0x47a1 dispatch + ${extra.length} sampled states — identical RAM + pc + SP`);
});

// -- 3. SENTINEL: crafted background forces all 56 display writes visible -------

test("SENTINEL (crafted): over a marker background the oracle writes 56 display cells and idiomatic matches", () => {
  const real = captureRealDispatch(CAP_FRAMES);
  assert.ok(real, "need the real dispatch to derive the crafted entry from");

  const w = real.clone();
  sentinelFill(w, 0x5a, 0xa5);

  // Non-vacuous: prove the routine really writes its 56 display cells over this
  // background (28 tile cells up the video column + 28 colour cells down the column).
  assert.equal(oracleDisplayWriteCount(w), 56, "oracle did not write the expected 56 display cells over the sentinel background");

  const diffs = contractDiffs(w, idiomatic);
  assert.equal(diffs.length, 0, `sentinel background: ${diffs.join("; ")}`);
  console.log("  SENTINEL: 56 display writes over a marker background — idiomatic identical to the oracle");
});

// -- 4. TEETH -----------------------------------------------------------------

test("TEETH: the wrong-accent twin and the shifted-strip twin are CAUGHT", () => {
  const real = captureRealDispatch(CAP_FRAMES);
  assert.ok(real, "need the real dispatch to derive the crafted entry from");

  const w1 = real.clone(); sentinelFill(w1, 0x5a, 0xa5);
  const dAccent = contractDiffs(w1, teethWrongAccent);
  assert.notEqual(dAccent.length, 0, "the gate FAILED to catch the wrong-accent twin — it is worthless");

  const w2 = real.clone(); sentinelFill(w2, 0x5a, 0xa5);
  const dShift = contractDiffs(w2, teethShiftedStrip);
  assert.notEqual(dShift.length, 0, "the gate FAILED to catch the shifted-strip twin — it is worthless");

  console.log(`  TEETH: wrong-accent caught (${dAccent[0]}); shifted-strip caught (${dShift[0]})`);
});
