// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for limitMarioHorizontalTravel (ROM 0x241f) — the horizontal position gate.
 *
 * sub_241f is a read-only leaf: it reads MARIO_X (0x6203), MARIO_Y (0x6205) and
 * BOARD (0x6227), writes NO memory, calls nothing, and leaves its verdict in the
 * (D,E) register pair. Its live-out is exactly that pair — every one of its three
 * callers (walkRightWhileHeld, advanceMarioAirborneFrame, move_2b02) `dec`s and tests D and/or E and reloads
 * A / recomputes flags before reading them, so A and the flags are dead and the
 * Z80 `ret` is just the function returning (pc/SP not modelled or compared).
 *
 * The (D,E) pair is a pure TOTAL function of (X, Y, BOARD), and BOARD enters ONLY
 * through its bit 0 (`rrca`), so it is validated the strongest way — EXHAUSTIVELY
 * against the frozen oracle — not by a whole-machine trace:
 *
 *   1. EQUAL (exhaustive) — limitMarioHorizontalTravel's (D,E) == oracle's over the full 256x256
 *      (X,Y) grid for BOTH board parities (BOARD=1 bit0-set, BOARD=2 bit0-clear):
 *      131,072 combos. That covers every (X,Y) the gate can see on either parity.
 *
 *   2. EQUAL (board breadth) — because "only bit 0 of BOARD matters" must be PROVEN,
 *      not assumed: sweep ALL 256 BOARD values over a curated (X,Y) edge set (the
 *      three X thresholds 0x16/0x6C/0xEA and the Y threshold 0x58, each +/-1), each
 *      compared to the oracle. Confirms no BOARD value beyond its bit 0 changes it.
 *
 *   3. TEETH (exhaustive) — a deliberately-broken twin (Y threshold `> 0x58` instead
 *      of `>= 0x58`, a classic boundary off-by-one) MUST be caught by the same sweep.
 *      It agrees with the oracle everywhere except Y == 0x58 in the odd-board in-band
 *      region, so only a real sweep that hits that exact row catches it.
 *
 *   4. REALISM + PURITY (captured dispatches) — hook 0x241f in a real attract run
 *      and capture the true states the game feeds it. Attract plays 25m with Mario
 *      low on the girders (Y always >= 0x58), so every real dispatch reaches the
 *      (0,0) arm; for each confirm (a) the oracle writes NO memory (licensing the
 *      writes-nothing / register-only contract), (b) limitMarioHorizontalTravel reproduces the oracle's
 *      returned (D,E), and (c) it mirrors that pair into regs.d/regs.e (the boundary
 *      ABI the still-oracle callers read).
 *
 *   5. CRAFTED (arms attract never reaches) — attract only reaches (0,0), so take a
 *      REAL captured state (real SP / stack / register file) and poke (X,Y,BOARD)
 *      identically into the oracle and limitMarioHorizontalTravel to drive EACH exit arm — (1,0) far
 *      left, (0,1) far right, and (0,0) via even board / Y-band / mid-column — and
 *      confirm the returned pair and the regs.d/regs.e mirror both match the oracle.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-241f.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_241f as oracle } from "../../translated/loc_241f.js";
import { limitMarioHorizontalTravel } from "../limitMarioHorizontalTravel.js";
import { MARIO_X, MARIO_Y, BOARD } from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x241f;
const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");
const eqPair = (a, b) => a.d === b.d && a.e === b.e;
const pairStr = (p) => `(${p.d},${p.e})`;

/**
 * Seed the three input bytes and a valid stack, then run the frozen oracle and read
 * back its (D,E) verdict from the register file.
 *
 * SP is reset into work RAM each call so the oracle's trailing `ret` reads valid
 * bytes and never drifts into I/O space; the popped value feeds PC only and never
 * affects (D,E) (which is decided before the ret). The machine may be reused across
 * combos: the oracle writes NO memory, so nothing accumulates — only SP moves,
 * which is reset each call.
 */
function runOraclePair(m, x, y, board) {
  const { regs, mem } = m;
  mem.write8(MARIO_X, x & 0xff);
  mem.write8(MARIO_Y, y & 0xff);
  mem.write8(BOARD, board & 0xff);
  regs.sp = 0x6bf8;
  oracle(m);
  return { d: regs.d & 0xff, e: regs.e & 0xff };
}

/** Seed the inputs for the candidate (no SP needed — it never touches the stack). */
function seed(m, x, y, board) {
  m.mem.write8(MARIO_X, x & 0xff);
  m.mem.write8(MARIO_Y, y & 0xff);
  m.mem.write8(BOARD, board & 0xff);
}

/**
 * Compare a candidate's (D,E) against the oracle's over the full 256x256 (X,Y) grid
 * for each board in `boards`. Inputs are re-seeded before the candidate call so a
 * mutating candidate cannot poison the oracle's read. Returns first mismatch + count.
 */
function sweepXY(candidate, boards) {
  const m = new Machine(ROM).clone();
  let count = 0;
  for (const board of boards) {
    for (let x = 0; x < 256; x++) {
      for (let y = 0; y < 256; y++) {
        const want = runOraclePair(m, x, y, board);
        seed(m, x, y, board);
        const got = candidate(m);
        count++;
        if (!eqPair(got, want)) return { mismatch: { x, y, board, want, got }, count };
      }
    }
  }
  return { mismatch: null, count };
}

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): limitMarioHorizontalTravel == oracle over all 131,072 (X,Y) x {odd,even board} combos", () => {
  const { mismatch, count } = sweepXY(limitMarioHorizontalTravel, [1, 2]);
  assert.equal(
    mismatch,
    null,
    mismatch &&
      `mismatch at X=${hx(mismatch.x)} Y=${hx(mismatch.y)} board=${hx(mismatch.board)}: ` +
        `oracle=${pairStr(mismatch.want)} loc=${pairStr(mismatch.got)}`,
  );
  assert.equal(count, 256 * 256 * 2, "must have compared the full 131,072-combo grid");
  console.log(`  EQUAL/exhaustive: ${count} (X,Y,parity) combos identical to the oracle`);
});

// -- 2. EQUAL (board breadth) -------------------------------------------------

test("EQUAL (board breadth): all 256 BOARD values match the oracle on curated (X,Y) edges", () => {
  // X edges: each threshold (0x16, 0x6C, 0xEA) and its neighbours, plus the extremes.
  const XS = [0x00, 0x15, 0x16, 0x17, 0x6b, 0x6c, 0x6d, 0xe9, 0xea, 0xeb, 0xff];
  // Y edges: the 0x58 band threshold +/-1 and the extremes.
  const YS = [0x00, 0x57, 0x58, 0x59, 0xff];

  const m = new Machine(ROM).clone();
  let count = 0;
  let mismatch = null;
  for (let board = 0; board < 256 && !mismatch; board++) {
    for (const x of XS) {
      for (const y of YS) {
        const want = runOraclePair(m, x, y, board);
        seed(m, x, y, board);
        const got = limitMarioHorizontalTravel(m);
        count++;
        if (!eqPair(got, want)) { mismatch = { x, y, board, want, got }; break; }
      }
      if (mismatch) break;
    }
  }
  assert.equal(
    mismatch,
    null,
    mismatch &&
      `mismatch at X=${hx(mismatch.x)} Y=${hx(mismatch.y)} board=${hx(mismatch.board)}: ` +
        `oracle=${pairStr(mismatch.want)} loc=${pairStr(mismatch.got)}`,
  );
  console.log(`  EQUAL/board-breadth: ${count} combos over all 256 BOARD values identical to the oracle`);
});

// -- 3. TEETH (exhaustive) ----------------------------------------------------

/**
 * Broken twin: the Y-band block uses `Y > 0x58` instead of `Y >= 0x58` — a classic
 * boundary off-by-one. It matches the oracle everywhere except Y == 0x58 in the
 * odd-board in-band region (0x16 <= X < 0x6C), where the real gate blocks to (0,0)
 * but the twin falls through to the (1,0) default. Only a sweep hitting that exact
 * row catches it.
 */
function brokenLoc241f(m) {
  const { mem } = m;
  const x = mem.read8(MARIO_X);
  let d, e;
  if (x < 0x16) { d = 1; e = 0; }
  else if (x >= 0xea) { d = 0; e = 1; }
  else if ((mem.read8(BOARD) & 0x01) === 0) { d = 0; e = 0; }
  else if (mem.read8(MARIO_Y) > 0x58) { d = 0; e = 0; } // BUG: should be >= 0x58
  else if (x >= 0x6c) { d = 0; e = 0; }
  else { d = 1; e = 0; }
  return { d, e };
}

test("TEETH (exhaustive): the Y-threshold off-by-one twin is CAUGHT by the sweep", () => {
  const { mismatch, count } = sweepXY(brokenLoc241f, [1, 2]);
  assert.notEqual(
    mismatch,
    null,
    "the exhaustive sweep FAILED to catch a wrong Y-band threshold — it is worthless",
  );
  console.log(
    `  TEETH/exhaustive: caught after ${count} combos at X=${hx(mismatch.x)} Y=${hx(mismatch.y)} ` +
      `board=${hx(mismatch.board)} (oracle=${pairStr(mismatch.want)} broken=${pairStr(mismatch.got)})`,
  );
});

// -- 4. REALISM + PURITY (captured dispatches) --------------------------------

/**
 * Hook 0x241f in a real attract run and clone the machine at up to K real dispatches.
 * 0x241f is reached by m.call from walkRightWhileHeld/1bb2/2b02; the construction-time override
 * map intercepts the m.call, so each captured state is a genuine mid-play entry with a
 * valid stack. The wrapper clones the entry state, then runs the oracle so the host
 * game proceeds undisturbed to a clean stop.
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

test("REALISM + PURITY: real captured dispatches — oracle writes no memory, loc matches (pair + regs)", () => {
  const caps = captureDispatches(128, 1200);
  assert.ok(caps.length >= 1, "expected at least one real 0x241f dispatch during attract");

  for (const cap of caps) {
    // PURITY + oracle verdict: run the oracle on a clone, confirm it mutated no RAM,
    // and read back its (D,E).
    const oc = cap.clone();
    const before = oc.dumpState();
    oracle(oc);
    const after = oc.dumpState();
    const wrote = firstStateDiff(before, after, (off) => oc.stateOffsetToAddr(off));
    assert.equal(
      wrote,
      null,
      wrote && `oracle wrote RAM at 0x${(wrote.addr ?? 0).toString(16)} (${wrote.a}->${wrote.b}) — not writes-nothing`,
    );
    const want = { d: oc.regs.d & 0xff, e: oc.regs.e & 0xff };

    // REALISM: limitMarioHorizontalTravel reproduces the oracle's (D,E) — both as its return value and
    // as the regs.d/regs.e mirror the still-oracle callers read.
    const cc = cap.clone();
    const got = limitMarioHorizontalTravel(cc);
    assert.ok(
      eqPair(got, want),
      `returned-pair mismatch on real dispatch X=${hx(cap.mem.read8(MARIO_X))} Y=${hx(cap.mem.read8(MARIO_Y))} ` +
        `board=${hx(cap.mem.read8(BOARD))}: oracle=${pairStr(want)} loc=${pairStr(got)}`,
    );
    assert.ok(
      cc.regs.d === want.d && cc.regs.e === want.e,
      `regs.d/regs.e mirror mismatch: oracle=${pairStr(want)} regs=(${cc.regs.d},${cc.regs.e})`,
    );
  }
  console.log(`  REALISM/purity: ${caps.length} real dispatches — no memory written, pair + regs == oracle`);
});

// -- 5. CRAFTED (arms attract never reaches) ----------------------------------

test("CRAFTED: real captured state poked to EACH exit arm — pair + regs == oracle", () => {
  const [base] = captureDispatches(1, 1200);
  assert.ok(base, "expected at least one real 0x241f dispatch to seed a crafted state");

  // One point per exit arm; `expect` documents the intended verdict (also checked
  // against the oracle so a wrong `expect` cannot mask a real divergence).
  const CASES = [
    { x: 0x10, y: 0xe0, board: 1, label: "X<0x16 far-left",       expect: { d: 1, e: 0 } },
    { x: 0xf0, y: 0xe0, board: 1, label: "X>=0xEA far-right",     expect: { d: 0, e: 1 } },
    { x: 0x40, y: 0x30, board: 2, label: "even board blocks",     expect: { d: 0, e: 0 } },
    { x: 0x40, y: 0x60, board: 1, label: "Y>=0x58 blocks",        expect: { d: 0, e: 0 } },
    { x: 0x80, y: 0x30, board: 1, label: "X>=0x6C blocks",        expect: { d: 0, e: 0 } },
    { x: 0x40, y: 0x30, board: 1, label: "in-band default",       expect: { d: 1, e: 0 } },
  ];

  const seenClasses = new Set();
  for (const c of CASES) {
    const oc = base.clone();
    oc.mem.write8(MARIO_X, c.x); oc.mem.write8(MARIO_Y, c.y); oc.mem.write8(BOARD, c.board);
    oracle(oc);
    const want = { d: oc.regs.d & 0xff, e: oc.regs.e & 0xff };
    assert.ok(
      eqPair(want, c.expect),
      `oracle disagrees with the documented ${c.label}: oracle=${pairStr(want)} expect=${pairStr(c.expect)}`,
    );

    const cc = base.clone();
    cc.mem.write8(MARIO_X, c.x); cc.mem.write8(MARIO_Y, c.y); cc.mem.write8(BOARD, c.board);
    const got = limitMarioHorizontalTravel(cc);
    assert.ok(
      eqPair(got, want) && cc.regs.d === want.d && cc.regs.e === want.e,
      `crafted mismatch (${c.label}) X=${hx(c.x)} Y=${hx(c.y)} board=${hx(c.board)}: ` +
        `oracle=${pairStr(want)} loc=${pairStr(got)} regs=(${cc.regs.d},${cc.regs.e})`,
    );
    seenClasses.add(pairStr(want));
  }

  // Coverage: the crafted set must actually exercise all three (D,E) classes.
  assert.deepEqual(
    [...seenClasses].sort(),
    ["(0,0)", "(0,1)", "(1,0)"],
    `crafted set did not cover all three (D,E) verdicts — saw ${[...seenClasses].sort().join(" ")}`,
  );
  console.log(`  CRAFTED: ${CASES.length} real-state arms identical to the oracle; verdicts covered ${[...seenClasses].sort().join(" ")}`);
});
