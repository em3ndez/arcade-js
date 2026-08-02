// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for dispatchBoardCollision (ROM 0x286F) — the per-board collision
 * dispatcher: `ld a,(0x6227)` (BOARD), `push hl`, then vector through the 6-entry inline
 * jump table at ROM 0x2874 to that board's collision handler.
 *
 * dispatchBoardCollision is NOT a leaf — it dispatches a handler that sweeps object records
 * and drives state — so it is validated by MEMORY-equivalence against the frozen oracle
 * (RAM − STACK_SCRATCH, pc, SP, and the handler's result registers A + IX), never the full
 * register file and never cycles, with a FRESH clone per case. Two things separate it from
 * its siblings (dispatchInGameSubstate / dispatchIntroCutsceneStep):
 *   - it PUSHES the caller's HL first, and every handler recovers it with `pop hl`, so the
 *     push is load-bearing (drop it and the handler pops the wrong word and the return
 *     unwinds two bytes off); the oracle additionally leaves the trampoline's popped table-
 *     base bytes in the dead stack region, so the RAM diff excludes STACK_SCRATCH.
 *   - it IS reached in plain attract (BOARD holds 1, the 25m handler 0x2880), so the reached
 *     arm is covered by real captures; the other three handlers (BOARD 2/3/4) are crafted.
 *
 *   1. REACHABILITY — 0x286f is dispatched during attract (the collision cascade calls it).
 *
 *   2. REALISM (captured attract dispatches) — hook 0x286f in attract and clone at each real
 *      dispatch. Run the ORACLE on one clone and dispatchBoardCollision on another and prove
 *      RAM(−stack) + pc + SP + A + IX identical — the FULL oracle handler runs on BOTH sides,
 *      so a wrong target OR a live register/flag handoff the folded-away trampoline would
 *      have supplied surfaces as divergent memory or result register.
 *
 *   3. CRAFTED (the other three boards) — poke BOARD to 2/3/4 on a real captured state,
 *      identically on both sides, to run handlers 0x28B0 / 0x28E0 / 0x2901 in full and prove
 *      the same contract; this exercises the pushed-HL handoff and register deadness for the
 *      handlers attract never reaches.
 *
 *   4. CRAFTED (exhaustive selector sweep) — poke BOARD to every byte 0..255 identically on
 *      both sides and route ANY computed target to an IDENTICAL catch-all stub (so the handler
 *      never runs), then compare the target the dispatcher formed + SP. This exhaustively pins
 *      the `0x2874 + (2*board & 0xff)` 8-bit-wrap table math, including the 0x0000 guard slots
 *      (idx 0 and 5) and the wrap region sel >= 0x80.
 *
 *   5. TEETH — two broken twins, each MUST be caught:
 *      (a) a twin that forms the offset as a full 16-bit `2*sel` (skipping the `add a,a` 8-bit
 *          wrap) — caught by the selector sweep at sel >= 0x80.
 *      (b) a twin that DROPS the `push hl` — caught by the full-handler runs (the handler's
 *          `pop hl` shifts SP by two, so pc/SP diverge).
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-286f.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_286f as oracle } from "../../translated/loc_286f.js";
import { dispatchBoardCollision } from "../dispatchBoardCollision.js";
import { loc_00ca } from "../../translated/loc_00ca.js";
import { Machine } from "../../machine.js";
import { STACK_SCRATCH, BOARD } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x286f;
const COLLISION_TABLE = 0x2874;
const DISPATCH_TABLE_2874 = "0x2874 (0x6227 collision dispatch)";
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// First differing RAM byte between two dumps, EXCLUDING the dead stack-scratch region (the
// memory-equivalence contract is RAM − STACK_SCRATCH; the oracle leaves the trampoline's
// popped table-base word there and this routine does not). Returns { addr, a, b } or null.
function firstRamDiffExStack(a, b, offToAddr) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) continue;
    const addr = offToAddr(i);
    if (addr >= STACK_SCRATCH.lo && addr < STACK_SCRATCH.hi) continue;
    return { addr, a: a[i], b: b[i] };
  }
  return null;
}

// Full contract diff for a full-handler run: RAM − STACK_SCRATCH, pc, SP, and the result
// registers A + IX (both consumed by the callers). The full oracle handler runs on BOTH
// sides, so these are identical for the correct routine and expose any divergence.
function contractDiffs(entry, fn) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  oracle(a);
  fn(b);
  const diffs = [];
  const ram = firstRamDiffExStack(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  if (ram) diffs.push(`RAM@${hx(ram.addr)} oracle=${ram.a} cand=${ram.b}`);
  if (a.pc !== b.pc) diffs.push(`pc oracle=${hx(a.pc)} cand=${hx(b.pc)}`);
  if (a.regs.sp !== b.regs.sp) diffs.push(`SP oracle=${hx(a.regs.sp)} cand=${hx(b.regs.sp)}`);
  if (a.regs.a !== b.regs.a) diffs.push(`A oracle=${hx(a.regs.a)} cand=${hx(b.regs.a)}`);
  if (a.regs.ix !== b.regs.ix) diffs.push(`IX oracle=${hx(a.regs.ix)} cand=${hx(b.regs.ix)}`);
  return diffs;
}

// Hook 0x286f in a plain attract run and clone the machine at up to K real dispatches. The
// wrapper clones the entry state (only while capturing), then runs the oracle so the host
// game proceeds undisturbed; capturing is gated off after the host run so the isolated
// replays below cannot pollute it.
function captureAttract(K, maxFrames) {
  const caps = [];
  let capturing = true;
  const snap = new Map([[TARGET, (mm) => {
    if (capturing && caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  capturing = false;
  return caps;
}

// -- 1. REACHABILITY ----------------------------------------------------------

test("REACHABILITY: 0x286f is dispatched during attract", () => {
  let count = 0;
  const boards = new Set();
  const snap = new Map([[TARGET, (mm) => { count++; boards.add(mm.mem.read8(BOARD)); return oracle(mm); }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(2000);
  assert.ok(count > 0, "0x286f should be dispatched — the collision cascade calls it during the attract demo");
  console.log(`  REACHABILITY: ${count} natural 0x286f dispatches in 2000 attract frames; BOARD values {${[...boards].map(hx).join(", ")}}`);
});

// -- 2. REALISM (captured attract dispatches) ---------------------------------

test("REALISM: real captured attract 0x286f dispatches — RAM(−stack) + pc + SP + A + IX match", () => {
  const caps = captureAttract(200, 1500);
  assert.ok(caps.length >= 1, "expected at least one real 0x286f dispatch during attract");

  for (const cap of caps) {
    const diffs = contractDiffs(cap, dispatchBoardCollision);
    assert.equal(
      diffs.length,
      0,
      diffs.length ? `captured dispatch (BOARD=${hx(cap.mem.read8(BOARD))}): ${diffs.join("; ")}` : "",
    );
  }
  const board = caps[0].mem.read8(BOARD);
  console.log(`  REALISM: ${caps.length} real dispatches (BOARD=${hx(board)} -> handler 0x2880) — full-handler contract identical`);
});

// -- 3. CRAFTED (the other three boards) --------------------------------------

test("CRAFTED: boards 2/3/4 run handlers 0x28B0/0x28E0/0x2901 — full contract matches", () => {
  const base = captureAttract(1, 1500)[0];
  assert.ok(base, "expected a real 0x286f attract state to craft from");

  for (const b of [2, 3, 4]) {
    const entry = base.clone();
    entry.mem.write8(BOARD, b); // identically on both sides (contractDiffs clones this entry)
    const diffs = contractDiffs(entry, dispatchBoardCollision);
    assert.equal(diffs.length, 0, `BOARD=${b}: ${diffs.join("; ")}`);
  }
  console.log("  CRAFTED: boards 2/3/4 handlers run in full — RAM(−stack)+pc+SP+A+IX identical to the oracle");
});

// -- 4. CRAFTED (exhaustive selector sweep) -----------------------------------

// A catch-all override object (duck-typed like the Machine's overrides Map) that routes ANY
// computed target to `stub`, so the dispatched handler never runs and we can read the target
// the dispatcher formed plus the SP at the dispatch (the oracle passes the target via HL, the
// candidate as an argument; recording the get() key works for both).
function stubOverrides(rec) {
  const SENTINEL = 0x5a;
  return {
    has: () => true,
    get: (target) => (mm) => { rec.push({ target, sp: mm.regs.sp }); return SENTINEL; },
  };
}

// Run oracle and candidate on identically-poked clones for one selector; return the
// { target, sp } each handed the stub.
function runCraftedSelector(base, candidate, sel) {
  const mA = base.clone();
  const mB = base.clone();
  mA.mem.write8(BOARD, sel);
  mB.mem.write8(BOARD, sel);
  const recA = [], recB = [];
  mA.overrides = stubOverrides(recA);
  mB.overrides = stubOverrides(recB);
  oracle(mA);
  candidate(mB);
  return { recA, recB };
}

test("CRAFTED: dispatchBoardCollision == oracle over all 256 selectors (0x2874 table)", () => {
  const base = captureAttract(1, 1500)[0];
  assert.ok(base, "expected a real 0x286f attract state to craft from");

  let count = 0;
  let mismatch = null;
  for (let sel = 0; sel < 256 && !mismatch; sel++) {
    const { recA, recB } = runCraftedSelector(base, dispatchBoardCollision, sel);
    count++;
    if (recA.length !== 1 || recB.length !== 1) {
      mismatch = { sel, why: `dispatch fired ${recA.length}/${recB.length} times (want 1/1)` };
    } else if (recA[0].target !== recB[0].target) {
      mismatch = { sel, why: `target ${hx(recA[0].target)}/${hx(recB[0].target)}` };
    } else if (recA[0].sp !== recB[0].sp) {
      mismatch = { sel, why: `SP ${hx(recA[0].sp)}/${hx(recB[0].sp)}` };
    }
  }
  assert.equal(mismatch, null, mismatch && `mismatch at sel=${hx(mismatch.sel)}: ${mismatch.why}`);
  assert.equal(count, 256, "must have swept all 256 selectors");
  console.log(`  CRAFTED: ${count} selectors — dispatched target + SP identical to the oracle`);
});

// -- 5. TEETH -----------------------------------------------------------------

/**
 * Broken twin (a): forms the table offset as a FULL 16-bit `2*sel` instead of the hardware's
 * 8-bit `add a,a` (`2*sel & 0xff`). Agrees with the oracle for every selector < 0x80 and
 * diverges from 0x80 up, so only the wrap sweep catches it. Keeps the `push hl` so ONLY the
 * offset differs.
 */
function brokenSixteenBitOffset(m) {
  const { regs, mem } = m;
  const board = mem.read8(BOARD);
  m.push16(regs.hl);
  const entry = (COLLISION_TABLE + 2 * board) & 0xffff; // BUG: no 8-bit wrap on the *2
  const target = mem.read8(entry) | (mem.read8((entry + 1) & 0xffff) << 8);
  loc_00ca(m, target, DISPATCH_TABLE_2874);
}

/** Broken twin (b): DROPS the `push hl`, so the handler's `pop hl` lifts the wrong stack
 *  word and the return unwinds two bytes off. Everything else is identical. */
function brokenDroppedPush(m) {
  const { mem } = m;
  const board = mem.read8(BOARD);
  // BUG: no `m.push16(regs.hl)`
  const entry = (COLLISION_TABLE + ((board * 2) & 0xff)) & 0xffff;
  const target = mem.read8(entry) | (mem.read8((entry + 1) & 0xffff) << 8);
  loc_00ca(m, target, DISPATCH_TABLE_2874);
}

test("TEETH: the 16-bit-offset twin (no 8-bit wrap) is CAUGHT by the selector sweep", () => {
  const base = captureAttract(1, 1500)[0];
  let caughtAt = null;
  for (let sel = 0; sel < 256 && caughtAt === null; sel++) {
    const { recA, recB } = runCraftedSelector(base, brokenSixteenBitOffset, sel);
    if (recA.length !== 1 || recB.length !== 1 || recA[0].target !== recB[0].target) {
      caughtAt = sel;
    }
  }
  assert.notEqual(caughtAt, null, "the sweep FAILED to catch the missing 8-bit offset wrap — it is worthless");
  console.log(`  TEETH: caught the 16-bit-offset twin at sel=${hx(caughtAt)}`);
});

test("TEETH: the dropped-push-HL twin is CAUGHT by the full-handler runs", () => {
  const caps = captureAttract(64, 1500);
  assert.ok(caps.length >= 1, "expected a real 0x286f dispatch to run the handler against");

  let caught = null;
  for (const cap of caps) {
    const diffs = contractDiffs(cap, brokenDroppedPush);
    if (diffs.length) { caught = diffs; break; }
  }
  assert.notEqual(caught, null, "the full-handler runs FAILED to catch a dropped `push hl` — the gate is worthless");
  console.log(`  TEETH: dropped-push-HL caught — ${caught.join("; ")}`);
});
