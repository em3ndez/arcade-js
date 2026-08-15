// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderScoreHeader — memory-equivalent to the frozen oracle at ROM 0x0B1F.
 * GATE: captured-entry + crafted sweep. Attract redraws the score header every frame, so real
 * dispatches are captured at 0x0B1F and replayed on fresh clones. The rewrite dissolves the oracle's
 * rst-0x28 blits and its 0x0b95/0x0ba9 calls into direct calls, so the oracle's push16 return-brackets
 * no longer land on the stack; the dead [SP-8, SP) window is masked and the compared live-out is
 * memory-only (every caller reloads its registers immediately after this dispatch). The candidate is
 * additionally required to leave SP on its seat, which is how the live seam supplies the ret — so a
 * surviving push16 is caught even though its bytes fall inside the masked window. Attract only ever
 * runs one-player, so a crafted entry pokes the player-count cell to two to exercise the player-2 arm,
 * and crafted score words widen digit coverage past the few attract displays. Teeth: no-op (redraw
 * suppressed), surviving-push16 (SP off its seat), wrong-count (one extra label tile), wrong-cell
 * (HI-SCORE field reads the player-1 score), wrong-digit (1-UP column's leading digit), drop-player-2
 * (omits the two-player arm).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_83ed, loc_83eb } from "../names.js";
import { renderScoreHeader } from "../renderScoreHeader.js";
import { copyRunUpTileColumn } from "../copyRunUpTileColumn.js";
import { writeScoreField } from "../writeScoreField.js";
import { writeScoreDigitStepUp } from "../writeScoreDigitStepUp.js";
import { loc_0b1f as oracle } from "../../translated/loc_0b1f.js";

const TARGET = 0x0b1f;
const CAP = 300;
const STACK_MASK = 8;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// Cells and destinations, mirrored from the module for the mutation twins.
const HIGH_SCORE = 0x83ef;
const PLAYER_COUNT = 0x8370;
const HISCORE_LABEL_SRC = 0x2ee2;
const SIDE_LABEL_SRC = 0x2edf;
const HISCORE_LABEL_DST = 0xaa60;
const HISCORE_VALUE_DST = 0xaa41;
const P1_DIGIT_DST = 0xab20;
const P1_SCORE_DST = 0xab41;
const P2_DIGIT_DST = 0xa900;
const P2_SCORE_DST = 0xa921;
const P1_LABEL_LEN = 8;
const SIDE_LABEL_LEN = 3;

let captured = null;
function captureEntries() {
  if (captured) return captured;
  const entries = [];
  const real = TRANSLATED.get(TARGET);
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (entries.length < CAP) entries.push(mm.clone());
    return real(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  assert.ok(entries.length > 0, "vacuous: 0x0b1f was never dispatched, no state to replay");
  captured = entries;
  return captured;
}

// null == equivalent. The candidate must leave SP on the entry seat (the seam supplies the ret), and
// its RAM must match the oracle everywhere outside the dead [SP-8, SP) scratch the oracle's dissolved
// return-brackets leave behind. SP is compared on the candidate only: the oracle's own exit pops the
// caller's return slot, so its SP legitimately sits two above the seat.
function diff(cand, entry) {
  const seat = entry.regs.sp;
  const lo = (seat - STACK_MASK) & 0xffff;
  const hi = seat;
  const a = entry.clone(); oracle(a);
  const b = entry.clone(); cand(b);
  if (b.regs.sp !== seat) {
    return `cand SP left its seat: 0x${seat.toString(16)} -> 0x${b.regs.sp.toString(16)}`;
  }
  const A = a.dumpState(), B = b.dumpState();
  const n = Math.min(A.length, B.length);
  for (let i = 0; i < n; i++) {
    if (A[i] === B[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= lo && addr < hi) continue; // dead stack scratch
    return `0x${(addr ?? 0).toString(16)}: ${A[i]} vs ${B[i]}`;
  }
  return null;
}

// Broken twins. Each is renderScoreHeader with exactly one mutation, so a caught twin proves the gate
// sees that class and not merely gross omission.
function brokenNoOp() {}

function brokenSurvivingPush16(m) {
  m.push16(0x0b32); // BUG: a leftover return-bracket a dissolve should have removed
  return renderScoreHeader(m);
}

function brokenWrongCount(m) {
  const { regs, mem8, mem16 } = m;
  copyRunUpTileColumn(m, HISCORE_LABEL_DST, HISCORE_LABEL_SRC, P1_LABEL_LEN + 1); // BUG: one extra tile
  regs.hl = HISCORE_VALUE_DST; regs.de = mem16[HIGH_SCORE]; writeScoreField(m);
  writeScoreDigitStepUp(m, 1, P1_DIGIT_DST);
  copyRunUpTileColumn(m, regs.hl, SIDE_LABEL_SRC, SIDE_LABEL_LEN);
  regs.hl = P1_SCORE_DST; regs.de = mem16[loc_83ed]; writeScoreField(m);
  if (mem8[PLAYER_COUNT] === 1) return;
  writeScoreDigitStepUp(m, 2, P2_DIGIT_DST);
  copyRunUpTileColumn(m, regs.hl, SIDE_LABEL_SRC, SIDE_LABEL_LEN);
  regs.hl = P2_SCORE_DST; regs.de = mem16[loc_83eb]; return writeScoreField(m);
}

function brokenWrongCell(m) {
  const { regs, mem8, mem16 } = m;
  copyRunUpTileColumn(m, HISCORE_LABEL_DST, HISCORE_LABEL_SRC, P1_LABEL_LEN);
  regs.hl = HISCORE_VALUE_DST; regs.de = mem16[loc_83ed]; writeScoreField(m); // BUG: HI-SCORE field reads the P1 score
  writeScoreDigitStepUp(m, 1, P1_DIGIT_DST);
  copyRunUpTileColumn(m, regs.hl, SIDE_LABEL_SRC, SIDE_LABEL_LEN);
  regs.hl = P1_SCORE_DST; regs.de = mem16[loc_83ed]; writeScoreField(m);
  if (mem8[PLAYER_COUNT] === 1) return;
  writeScoreDigitStepUp(m, 2, P2_DIGIT_DST);
  copyRunUpTileColumn(m, regs.hl, SIDE_LABEL_SRC, SIDE_LABEL_LEN);
  regs.hl = P2_SCORE_DST; regs.de = mem16[loc_83eb]; return writeScoreField(m);
}

function brokenWrongDigit(m) {
  const { regs, mem8, mem16 } = m;
  copyRunUpTileColumn(m, HISCORE_LABEL_DST, HISCORE_LABEL_SRC, P1_LABEL_LEN);
  regs.hl = HISCORE_VALUE_DST; regs.de = mem16[HIGH_SCORE]; writeScoreField(m);
  writeScoreDigitStepUp(m, 7, P1_DIGIT_DST); // BUG: wrong leading digit
  copyRunUpTileColumn(m, regs.hl, SIDE_LABEL_SRC, SIDE_LABEL_LEN);
  regs.hl = P1_SCORE_DST; regs.de = mem16[loc_83ed]; writeScoreField(m);
  if (mem8[PLAYER_COUNT] === 1) return;
  writeScoreDigitStepUp(m, 2, P2_DIGIT_DST);
  copyRunUpTileColumn(m, regs.hl, SIDE_LABEL_SRC, SIDE_LABEL_LEN);
  regs.hl = P2_SCORE_DST; regs.de = mem16[loc_83eb]; return writeScoreField(m);
}

function brokenDropP2(m) {
  const { regs, mem16 } = m;
  copyRunUpTileColumn(m, HISCORE_LABEL_DST, HISCORE_LABEL_SRC, P1_LABEL_LEN);
  regs.hl = HISCORE_VALUE_DST; regs.de = mem16[HIGH_SCORE]; writeScoreField(m);
  writeScoreDigitStepUp(m, 1, P1_DIGIT_DST);
  copyRunUpTileColumn(m, regs.hl, SIDE_LABEL_SRC, SIDE_LABEL_LEN);
  regs.hl = P1_SCORE_DST; regs.de = mem16[loc_83ed]; return writeScoreField(m); // BUG: always stops here
}

// A tooth entry the mutations are observable against: dirty the first label and score cells so a no-op
// leaves them dirty, and poke distinct score words so a wrong cell/digit writes visibly different tiles.
function toothEntry(players) {
  const e = captureEntries()[0].clone();
  e.mem8[PLAYER_COUNT] = players;
  e.mem16[HIGH_SCORE] = 0x1234;
  e.mem16[loc_83ed] = 0x5678;
  e.mem16[loc_83eb] = 0x9abc;
  e.mem8[HISCORE_LABEL_DST] = 0xee;
  e.mem8[HISCORE_VALUE_DST] = 0xee;
  e.mem8[P1_DIGIT_DST] = 0xee;
  e.mem8[P2_DIGIT_DST] = 0xee;
  e.mem8[(HISCORE_LABEL_DST - P1_LABEL_LEN * 32) & 0xffff] = 0xee; // the cell an off-by-one label count reaches
  return e;
}

test("REAL: oracle == rewrite on every captured 0x0b1f dispatch", { skip }, () => {
  const entries = captureEntries();
  for (const e of entries) assert.equal(diff(renderScoreHeader, e), null, "a captured machine diverged");
  console.log(`  REAL: ${entries.length} captured dispatches, oracle == rewrite (memory-only, SP seated)`);
});

test("CRAFTED 1P: oracle == rewrite across poked score words", { skip }, () => {
  const words = [0x0000, 0x1234, 0x5678, 0x9abc, 0xdef0, 0x9999, 0xffff];
  for (const w of words) {
    const e = captureEntries()[0].clone();
    e.mem8[PLAYER_COUNT] = 1;
    e.mem16[HIGH_SCORE] = w;
    e.mem16[loc_83ed] = (w ^ 0x2222) & 0xffff;
    assert.equal(diff(renderScoreHeader, e), null, `crafted 1P word=0x${w.toString(16)} diverged`);
  }
  console.log(`  CRAFTED 1P: ${words.length} score words, oracle == rewrite`);
});

test("CRAFTED 2P: oracle == rewrite on the two-player arm attract never reaches", { skip }, () => {
  const words = [0x0000, 0x1234, 0x9abc, 0x9999, 0xffff];
  for (const w of words) {
    const e = captureEntries()[0].clone();
    e.mem8[PLAYER_COUNT] = 2;
    e.mem16[HIGH_SCORE] = w;
    e.mem16[loc_83ed] = (w ^ 0x1111) & 0xffff;
    e.mem16[loc_83eb] = (w ^ 0x3333) & 0xffff;
    assert.equal(diff(renderScoreHeader, e), null, `crafted 2P word=0x${w.toString(16)} diverged`);
  }
  console.log(`  CRAFTED 2P: ${words.length} score words on the player-2 arm, oracle == rewrite`);
});

test("TEETH: broken twins are caught, real stays green", { skip }, () => {
  const e1 = toothEntry(1);
  const e2 = toothEntry(2);
  assert.equal(diff(renderScoreHeader, e1), null, "positive control: real diverged on the 1P tooth entry");
  assert.equal(diff(renderScoreHeader, e2), null, "positive control: real diverged on the 2P tooth entry");
  assert.ok(diff(brokenNoOp, e1), "the no-op twin escaped");
  assert.ok(diff(brokenSurvivingPush16, e1), "the surviving-push16 twin escaped");
  assert.ok(diff(brokenWrongCount, e1), "the wrong-count twin escaped");
  assert.ok(diff(brokenWrongCell, e1), "the wrong-cell twin escaped");
  assert.ok(diff(brokenWrongDigit, e1), "the wrong-digit twin escaped");
  assert.ok(diff(brokenDropP2, e2), "the drop-player-2 twin escaped");
  console.log("  TEETH: no-op, surviving-push16, wrong-count, wrong-cell, wrong-digit, drop-player-2 all caught");
});
