// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_46f4 (ROM 0x46f4) — stamps the fixed playfield
 * edge column: a 32-tile ROM picture strip up video column 0, then two 9-cell
 * colour-2 runs and one 10-cell colour-3 run that tint it (60 cells total).
 *
 * loc_46f4 loads its own source, destinations, counts, and colours — no live-in
 * register, no work RAM read — so its writes depend on nothing but the fixed ROM
 * strip. Its declared LIVE-OUT is memory-only (the tile + colour cells); the
 * register file and flags it leaves behind are dead ABI. The routine touches no
 * stack, so the whole work/colour/video RAM dump is compared, nothing excluded.
 *
 * WHY NOT unitEquivalence's own verdict: that gate diffs the FULL register file, so
 * it reports equal:false here purely because of the dead residual register the
 * oracle leaves (a=3) versus the idiomatic routine (a=0), while RAM and pc are
 * identical. That is exactly the dead-difference a memory-only live-out is allowed
 * to have — so the contract below compares RAM + pc + SP and never the register
 * file. The first test pins that down: unitEquivalence's ONLY disagreement is a
 * register, with RAM and pc equal.
 *
 * The idiomatic routine models the Z80 return as the JS call stack, so it does not
 * touch pc/SP itself; the oracle performs one net return, so the harness runs one
 * m.ret() on the candidate to line pc + SP up with the oracle.
 *
 *   1. LIVE-OUT — unitEquivalence's only disagreement is a dead register (RAM + pc
 *      equal), justifying the memory-equivalence contract.
 *   2. EQUAL (real dispatch) — capture the true 0x46f4 entry in an attract run;
 *      oracle vs idiomatic leave identical RAM + pc + SP. Repeated over extra
 *      sampled attract states for breadth (the routine ignores incoming state).
 *   3. SENTINEL (crafted) — over a marker-filled colour+video background the oracle
 *      writes exactly 60 cells (non-vacuous) and the idiomatic routine matches.
 *   4. TEETH — two deliberately-broken twins, each CAUGHT on the sentinel background.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-46f4.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_46f4 as oracle } from "../../translated/loc_46f4.js";
import { loc_0066 as nmiOracle } from "../../translated/loc_0066.js";
import { loc_46f4 as idiomatic } from "../loc_46f4.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x46f4;
const NMI = 0x0066;
const CAP_FRAMES = 300; // a single attract run reaches the 0x46f4 board-setup dispatch well within this
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
 * so pc + SP line up with the oracle's (the idiomatic routine uses the JS call stack
 * and does not touch pc/SP itself — the harness supplies the return).
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

/** Capture the machine at the true 0x46f4 dispatch during an attract run (single runFrames — no NMI-timing skew). */
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

/** Sentinel-fill the colour (0x8800-0x8BFF) + video (0x9000-0x93FF) RAM so every write is a real change. */
function sentinelFill(m, val) {
  for (let a = 0x8800; a <= 0x8bff; a++) m.mem.write8(a, val);
  for (let a = 0x9000; a <= 0x93ff; a++) m.mem.write8(a, val);
}

/** Count how many state-dump cells the ORACLE changes from `entry`. */
function oracleWriteCount(entry) {
  const before = entry.dumpState();
  const after = runOracle(entry).dumpState();
  let n = 0;
  for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) n += 1;
  return n;
}

// -- broken twins -------------------------------------------------------------

/** BUG: paints colour 3 into the first run instead of colour 2 — those 9 cells diverge. */
function teethWrongColour(m) {
  const { mem } = m;
  let src = 0x4aab, cell = 0x93e0;
  for (let i = 0; i < 32; i++) { mem.write8(cell, mem.read8(src)); src += 1; cell -= 32; }
  let c = 0x8ba0;
  for (let i = 0; i < 9; i++) { mem.write8(c, 3); c -= 32; } // BUG: colour should be 2
  c = 0x8940; for (let i = 0; i < 9; i++) { mem.write8(c, 2); c -= 32; }
  c = 0x8a80; for (let i = 0; i < 10; i++) { mem.write8(c, 3); c -= 32; }
}

/** BUG: writes the tile strip one row too high (starts at 0x93c0) — the whole picture shifts. */
function teethShiftedStrip(m) {
  const { mem } = m;
  let src = 0x4aab, cell = 0x93c0; // BUG: should start at 0x93e0
  for (let i = 0; i < 32; i++) { mem.write8(cell, mem.read8(src)); src += 1; cell -= 32; }
  let c = 0x8ba0;
  for (let i = 0; i < 9; i++) { mem.write8(c, 2); c -= 32; }
  c = 0x8940; for (let i = 0; i < 9; i++) { mem.write8(c, 2); c -= 32; }
  c = 0x8a80; for (let i = 0; i < 10; i++) { mem.write8(c, 3); c -= 32; }
}

// -- 1. LIVE-OUT is memory-only ------------------------------------------------

test("LIVE-OUT: unitEquivalence's only disagreement is a dead register (RAM + pc equal)", () => {
  // Candidate wrapped with the net return so unitEquivalence's clone-run lines pc/SP up.
  const idiomaticWithRet = (m) => { idiomatic(m); m.ret(); };
  const res = unitEquivalence(makeMachine, TARGET, oracle, idiomaticWithRet, { maxFrames: 240 });
  assert.equal(res.ram, null, "RAM must be identical — the whole point of the routine");
  assert.equal(res.pc, null, "pc must be identical after the modelled return");
  assert.notEqual(res.regs, null, "expected the dead residual register to differ (memory-only live-out)");
  console.log(
    `  LIVE-OUT: RAM + pc identical; sole diff is dead register ${res.regs.reg} ` +
      `(oracle=${res.regs.a} idiomatic=${res.regs.b}) — outside the memory-equivalence contract`,
  );
});

// -- 2. EQUAL: real dispatch + sampled attract states --------------------------

test("EQUAL: idiomatic loc_46f4 == oracle at the real dispatch and on sampled attract states", () => {
  const real = captureRealDispatch(CAP_FRAMES);
  assert.ok(real, "expected a real 0x46f4 dispatch during attract");
  assert.equal(contractDiffs(real, idiomatic).length, 0, "real-dispatch entry: " + contractDiffs(real, idiomatic).join("; "));

  const extra = captureAttractStates(16, CAP_FRAMES);
  assert.ok(extra.length >= 4, `expected several sampled attract states, got ${extra.length}`);
  for (const cap of extra) {
    const diffs = contractDiffs(cap, idiomatic);
    assert.equal(diffs.length, 0, diffs.join("; "));
  }
  console.log(`  EQUAL: real 0x46f4 dispatch + ${extra.length} sampled states — identical RAM + pc + SP`);
});

// -- 3. SENTINEL: crafted background forces all 60 writes visible --------------

test("SENTINEL (crafted): over a marker background the oracle writes 60 cells and idiomatic matches", () => {
  const real = captureRealDispatch(CAP_FRAMES);
  assert.ok(real, "need the real dispatch to derive the crafted entry from");

  const w = real.clone();
  sentinelFill(w, 0x5a);

  // Non-vacuous: prove the routine really writes its 60 cells over this background
  // (32 tile cells + two 9-cell colour runs + one 10-cell colour run).
  assert.equal(oracleWriteCount(w), 60, "oracle did not write the expected 60 cells over the sentinel background");

  const diffs = contractDiffs(w, idiomatic);
  assert.equal(diffs.length, 0, `sentinel background: ${diffs.join("; ")}`);
  console.log("  SENTINEL: 60 writes over a marker background — idiomatic identical to the oracle");
});

// -- 4. TEETH -----------------------------------------------------------------

test("TEETH: the wrong-colour twin and the shifted-strip twin are CAUGHT", () => {
  const real = captureRealDispatch(CAP_FRAMES);
  assert.ok(real, "need the real dispatch to derive the crafted entry from");

  const w1 = real.clone(); sentinelFill(w1, 0x5a);
  const dColour = contractDiffs(w1, teethWrongColour);
  assert.notEqual(dColour.length, 0, "the gate FAILED to catch the wrong-colour twin — it is worthless");

  const w2 = real.clone(); sentinelFill(w2, 0x5a);
  const dShift = contractDiffs(w2, teethShiftedStrip);
  assert.notEqual(dShift.length, 0, "the gate FAILED to catch the shifted-strip twin — it is worthless");

  console.log(`  TEETH: wrong-colour caught (${dColour[0]}); shifted-strip caught (${dShift[0]})`);
});
