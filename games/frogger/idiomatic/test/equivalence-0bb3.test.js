// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderMode3ScoreRankingScreen — memory-equivalent to the frozen oracle at ROM 0x0BB3.
 * Crafted-entry: the mode-3 SCORE RANKING screen is not reached by plain attract within ENTRY_FRAMES,
 * so a post-boot clone drives the routine directly (once as-seeded, once with nonzero rank codes at
 * 0x83FB and distinct high-score words at 0x83F1-0x83FA so every value-dependent digit path draws).
 * Live-out is memory-only; the rewrite's dissolved callees omit the oracle's push16 return residue in
 * [SP-8,SP), masked before the RAM compare. The tail loc_0c17 stays m.call, so both sides run it
 * identically. Teeth: no-op, perturbed-score, static-strip-source, short-loop.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { renderMode3ScoreRankingScreen } from "../renderMode3ScoreRankingScreen.js";
import { loc_0bb3 as oracle } from "../../translated/loc_0bb3.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { fillTilemapBlock22x32 } from "../fillTilemapBlock22x32.js";
import { placeScoreRankMarkers } from "../placeScoreRankMarkers.js";
import { copyRunUpTileColumn } from "../copyRunUpTileColumn.js";
import { writeScoreDigitStepUp } from "../writeScoreDigitStepUp.js";
import { writeScoreField } from "../writeScoreField.js";
import { ATTRACT_DEMO_PHASE_COUNTER, POINT_TABLE_DRAW_STATE, START_LATCH } from "../names.js";

const RANK_CODES = 0x83fb;
const HISCORE_ROW = 0x83ef; // rank r's score word is (HISCORE_ROW + 2*r), r = 1..5
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let seed = null;
function seedMachine() {
  if (seed) return seed;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the seed run stopped early: ${m.stoppedBy}`);
  seed = m.clone();
  return seed;
}

function entryPlain() {
  return seedMachine().clone();
}
function entryPoked() {
  const e = seedMachine().clone();
  e.mem8[RANK_CODES] = 0x37; // nonzero low+high rank codes -> both markers stamp
  e.mem8[RANK_CODES + 1] = 0x00;
  for (let r = 1; r <= 5; r++) {
    e.mem8[HISCORE_ROW + 2 * r] = 0x10 * r + r; // distinct packed-BCD words per rank
    e.mem8[HISCORE_ROW + 2 * r + 1] = r;
  }
  return e;
}

const WORK_RAM_BASE = 0x8000;
const WORK_RAM_END = 0x8800;
function maskStack(dump, sp) {
  const lo = Math.max(WORK_RAM_BASE, sp - 8);
  const hi = Math.min(WORK_RAM_END, sp);
  for (let a = lo; a < hi; a++) dump[a - WORK_RAM_BASE] = 0;
  return dump;
}
function ramDiff(cand, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(
    maskStack(a.dumpState(), sp),
    maskStack(b.dumpState(), sp),
    (o) => a.stateOffsetToAddr(o),
  );
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

function brokenNoOp() {}
function brokenPerturbScore(m) { oracle(m); m.mem8[0xa9ef] ^= 0xff; } // BUG: corrupts a drawn score cell

// Structural twin: forgets to carry the running strip source across the five rank rows.
function brokenStaticStripSource(m) {
  const { regs, mem8 } = m;
  mem8[POINT_TABLE_DRAW_STATE] = (mem8[POINT_TABLE_DRAW_STATE] - 1) & 0xff;
  mem8[ATTRACT_DEMO_PHASE_COUNTER] = 0;
  mem8[START_LATCH] = 0;
  fillTilemapBlock22x32(m);
  mem8[0x8019] = 3;
  for (let p = 0x801f, i = 0; i < 5; i++, p += 4) mem8[p] = 0;
  placeScoreRankMarkers(m);
  copyRunUpTileColumn(m, 0xaaac, 0x2ee5, 0x0d);
  const stripSrc = regs.de; // BUG: never re-read after each strip
  for (let rank = 1; rank <= 5; rank++) {
    writeScoreDigitStepUp(m, rank, 0xaa00 | ((2 * rank + 0xcd) & 0xff));
    copyRunUpTileColumn(m, regs.hl, stripSrc, 0x03);
    regs.de = mem8[HISCORE_ROW + 2 * rank] | (mem8[HISCORE_ROW + 2 * rank + 1] << 8);
    regs.hl = 0xa900 | ((2 * rank + 0xed) & 0xff);
    writeScoreField(m);
    copyRunUpTileColumn(m, regs.hl, 0x2fba, 0x04);
  }
  return m.call(0x0c17);
}

// Structural twin: draws four rank rows instead of five.
function brokenShortLoop(m) {
  const { regs, mem8 } = m;
  mem8[POINT_TABLE_DRAW_STATE] = (mem8[POINT_TABLE_DRAW_STATE] - 1) & 0xff;
  mem8[ATTRACT_DEMO_PHASE_COUNTER] = 0;
  mem8[START_LATCH] = 0;
  fillTilemapBlock22x32(m);
  mem8[0x8019] = 3;
  for (let p = 0x801f, i = 0; i < 5; i++, p += 4) mem8[p] = 0;
  placeScoreRankMarkers(m);
  copyRunUpTileColumn(m, 0xaaac, 0x2ee5, 0x0d);
  let stripSrc = regs.de;
  for (let rank = 1; rank <= 4; rank++) { // BUG: 4 rows, not 5
    writeScoreDigitStepUp(m, rank, 0xaa00 | ((2 * rank + 0xcd) & 0xff));
    copyRunUpTileColumn(m, regs.hl, stripSrc, 0x03);
    stripSrc = regs.de;
    regs.de = mem8[HISCORE_ROW + 2 * rank] | (mem8[HISCORE_ROW + 2 * rank + 1] << 8);
    regs.hl = 0xa900 | ((2 * rank + 0xed) & 0xff);
    writeScoreField(m);
    copyRunUpTileColumn(m, regs.hl, 0x2fba, 0x04);
  }
  return m.call(0x0c17);
}

test("EQUAL (crafted): renderMode3ScoreRankingScreen == oracle, plain and poked entries", { skip }, () => {
  assert.equal(ramDiff(renderMode3ScoreRankingScreen, entryPlain()), null, "plain entry diverged");
  assert.equal(ramDiff(renderMode3ScoreRankingScreen, entryPoked()), null, "poked entry diverged");
  assert.ok(ramDiff(brokenNoOp, entryPlain()), "vacuous: the routine wrote no RAM");
  console.log("  EQUAL: renderMode3ScoreRankingScreen == oracle (plain + poked)");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = entryPoked(); // distinct scores/markers make every path observable
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenPerturbScore, e), "the perturbed-score twin escaped");
  assert.ok(ramDiff(brokenStaticStripSource, e), "the static-strip-source twin escaped");
  assert.ok(ramDiff(brokenShortLoop, e), "the short-loop twin escaped");
  console.log("  TEETH: no-op, perturbed-score, static-strip-source, short-loop all caught");
});
