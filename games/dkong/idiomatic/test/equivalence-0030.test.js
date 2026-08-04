// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for boardBitGate (ROM 0x0030) — the `rst 0x30` per-board skip gate.
 *
 * sub_0030 is a near-pure leaf: it reads A and (BOARD 0x6227), writes NO memory, and
 * its only live-out is the BOOLEAN skip flag (true = normal return / proceed, false =
 * caller-skip). Its Z80 SP/PC manipulation (`pop hl` on the closed arm) is the
 * caller-skip idiom the idiomatic layer models as that boolean, so SP/PC are NOT
 * compared — the boolean IS the SP/PC decision. Every one of the 20 callers consumes
 * only the boolean (`if (!m.call(0x0030)) return;`) and immediately overwrites, or
 * never reads, A/B/HL/carry, so those registers are dead and are not compared either.
 *
 * The boolean is a pure TOTAL function of (A, BOARD), so it is validated the strongest
 * way — EXHAUSTIVELY against the frozen oracle — not by a whole-machine trace:
 *
 *   1. EQUAL (exhaustive) — boardBitGate's boolean == oracle's boolean over all
 *      65,536 (A, BOARD) combos (the full 256x256 grid). BOARD is the whole rotate
 *      count, so every value it can take is swept, including 0 (the djnz-underflow
 *      256-turn edge) and the in-play 1..4.
 *
 *   2. TEETH (exhaustive) — a deliberately-broken twin (tests bit (BOARD mod 8)
 *      instead of (BOARD-1 mod 8) — the classic "forgot rrca lands bit count-1" slip)
 *      MUST be caught by the same exhaustive sweep. It agrees on ~half the inputs, so
 *      only a real sweep catches it.
 *
 *   3. REALISM + PURITY (captured dispatches) — hook 0x0030 in a real attract run,
 *      capture the true machine states the game feeds it (board 1 = 25m, varied A per
 *      caller), and for each confirm (a) the oracle writes NO memory (justifying the
 *      writes-nothing contract) and (b) boardBitGate reproduces the oracle's boolean.
 *
 *   4. CRAFTED (unreached boards) — attract only plays board 1, so take a REAL captured
 *      state (real SP / stack / register file) and poke BOARD to 2/3/4/0 identically
 *      into the oracle and the gate, sweeping A, to cover the arms attract never reaches.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-0030.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0030 as oracle } from "../../translated/loc_0030.js";
import { boardBitGate } from "../boardBitGate.js";
import { BOARD } from "../names.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0030;
const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * Run the frozen oracle for one (a, board) and return its boolean (normal-return
 * = true, caller-skip = false).
 *
 * SP is reset into work RAM each call so the oracle's trailing `ret`/`pop` read valid
 * bytes and never drift into I/O space; the popped values feed PC/HL only and never
 * affect the returned boolean (the carry is decided before any pop). The machine may
 * be reused across combos: the oracle writes NO memory, so nothing accumulates — only
 * SP moves, which is reset each call.
 */
function runOracleBool(m, a, board) {
  const { regs, mem } = m;
  regs.a = a & 0xff;
  mem.write8(BOARD, board & 0xff);
  regs.sp = 0x6bf8;
  return oracle(m) === true;
}

/**
 * Compare a candidate's boolean against the oracle's over the full 256x256 (A, BOARD)
 * grid. Inputs are re-seeded before BOTH calls so a mutating candidate cannot poison
 * the oracle's read. Returns the first mismatch (or null) and the combo count.
 */
function sweep(candidate) {
  const m = new Machine(ROM).clone();
  const { regs, mem } = m;
  let count = 0;
  for (let board = 0; board < 256; board++) {
    for (let a = 0; a < 256; a++) {
      regs.a = a; mem.write8(BOARD, board); regs.sp = 0x6bf8;
      const got = candidate(m) === true;
      const want = runOracleBool(m, a, board);
      count++;
      if (got !== want) return { mismatch: { a, board, want, got }, count };
    }
  }
  return { mismatch: null, count };
}

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): boardBitGate == oracle over all 65,536 (A, BOARD) combos", () => {
  const { mismatch, count } = sweep(boardBitGate);
  assert.equal(
    mismatch,
    null,
    mismatch &&
      `mismatch at a=${hx(mismatch.a)} board=${hx(mismatch.board)}: ` +
        `oracle=${mismatch.want} gate=${mismatch.got}`,
  );
  assert.equal(count, 256 * 256, "must have compared the full 65,536-combo grid");
  console.log(`  EQUAL/exhaustive: ${count} (A, BOARD) combos identical to the oracle`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/**
 * Broken twin: tests bit (BOARD mod 8) instead of (BOARD-1 mod 8) — the classic
 * off-by-one of forgetting that `rrca` walked N times lands A's bit (N-1) in the
 * carry, not bit N. It agrees with the oracle on roughly half the inputs, so only a
 * real sweep catches it.
 */
function brokenBoardBitGate(m) {
  const { regs, mem } = m;
  const count = mem.read8(BOARD) || 256;
  const boardBit = (regs.a >> (count & 7)) & 1; // BUG: should be (count-1) & 7
  return boardBit === 1;
}

test("TEETH (exhaustive): the off-by-one-bit twin is CAUGHT by the sweep", () => {
  const { mismatch, count } = sweep(brokenBoardBitGate);
  assert.notEqual(
    mismatch,
    null,
    "the exhaustive sweep FAILED to catch a wrong selected-bit index — it is worthless",
  );
  console.log(
    `  TEETH/exhaustive: caught after ${count} combos at a=${hx(mismatch.a)} ` +
      `board=${hx(mismatch.board)} (oracle=${mismatch.want} broken=${mismatch.got})`,
  );
});

// -- 3. REALISM + PURITY (captured dispatches) --------------------------------

/**
 * Hook 0x0030 in a real attract run and clone the machine at up to K real dispatches.
 * The caller pushes its return address before `m.call(0x0030)`, so each captured state
 * has a valid stack; the wrapper clones the entry state, then runs the oracle so the
 * host game proceeds undisturbed to a clean stop.
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

test("REALISM + PURITY: real captured dispatches — oracle writes no memory, gate matches", () => {
  const caps = captureDispatches(128, 1200);
  assert.ok(caps.length >= 1, "expected at least one real 0x0030 dispatch during attract");

  for (const cap of caps) {
    // PURITY: run the oracle on a clone and confirm it mutated no RAM — this is what
    // licenses the writes-nothing contract (no memory in the live-out).
    const oc = cap.clone();
    const before = oc.dumpState();
    const oracleBool = oracle(oc) === true;
    const after = oc.dumpState();
    const d = firstStateDiff(before, after, (off) => oc.stateOffsetToAddr(off));
    assert.equal(
      d,
      null,
      d && `oracle wrote RAM at 0x${(d.addr ?? 0).toString(16)} (${d.a}->${d.b}) — not writes-nothing`,
    );

    // REALISM: boardBitGate reproduces the oracle's boolean on this real state.
    const gateBool = boardBitGate(cap.clone()) === true;
    assert.equal(
      gateBool,
      oracleBool,
      `mismatch on real dispatch a=${hx(cap.regs.a)} board=${hx(cap.mem.read8(BOARD))}`,
    );
  }
  console.log(`  REALISM/purity: ${caps.length} real dispatches — no memory written, gate == oracle`);
});

// -- 4. CRAFTED (boards attract never reaches) --------------------------------

test("CRAFTED: real captured state poked to boards 2/3/4/0 — gate == oracle over all A", () => {
  const [base] = captureDispatches(1, 1200);
  assert.ok(base, "expected at least one real 0x0030 dispatch to seed a crafted state");

  let count = 0;
  let mismatch = null;
  for (const board of [2, 3, 4, 0]) {
    for (let a = 0; a < 256 && !mismatch; a++) {
      const oc = base.clone();
      oc.regs.a = a; oc.mem.write8(BOARD, board); oc.regs.sp = 0x6bf8;
      const want = oracle(oc) === true;

      const g = base.clone();
      g.regs.a = a; g.mem.write8(BOARD, board);
      const got = boardBitGate(g) === true;

      count++;
      if (got !== want) mismatch = { a, board, want, got };
    }
    if (mismatch) break;
  }
  assert.equal(
    mismatch,
    null,
    mismatch &&
      `crafted mismatch at board=${hx(mismatch.board)} a=${hx(mismatch.a)}: ` +
        `oracle=${mismatch.want} gate=${mismatch.got}`,
  );
  console.log(`  CRAFTED: ${count} (board 2/3/4/0, A) combos on real state identical to the oracle`);
});
