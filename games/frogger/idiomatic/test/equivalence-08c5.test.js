// SPDX-License-Identifier: GPL-3.0-only
/**
 * equivalence-08c5 — crafted-entry gate: armScoreBonusStrip vs the frozen oracle. The arm is a
 * one-shot: first entry seeds the guard, blits a 5-tile strip, prints the countdown byte as two
 * BCD digits, then adds it to the score; a set guard suppresses the whole arm. Covers both branch
 * arms and both play-gate arms (play-off = blit+print, play-on = +score). RAM compared, dead stack
 * scratch masked. Teeth: no-op, restored seed, bumped blit, bumped score; positive controls fire.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff } from "./_frogHop.js";
import { armScoreBonusStrip as cand } from "../driveScoreDisplayCountdown.js";
import { loc_08c5 as oracle } from "../../translated/loc_0870.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const E0 = 0x83e0;       // seed guard: nonzero == already armed
const DELO = 0x83de;     // countdown byte: printed as BCD + added to the score
const PLAY = 0x83fe, PLAYER = 0x83fd;
const P1_LO = 0x83ed, P1_HI = 0x83ee, AW1 = 0x83e7;
const BLIT_SRC = 0x2f6e; // ROM strip source (first byte lands at BLIT_DST)
const BLIT_DST = 0xaa51; // strip destination column start
const BCD_DST = 0xa9b1;  // where the printed high BCD digit lands (blit left HL here)

// guard taken: 0x83E0 already set -> the arm returns without touching memory.
const seeded = () => craft((mem) => { mem[E0] = 1; });
// first entry, not in play: seed + blit + print, but the score add early-returns (PLAY_FLAG=0).
const playOff = () => craft((mem) => { mem[E0] = 0; mem[PLAY] = 0; mem[DELO] = 0x42; });
// first entry, in play: seed + blit + print + score. AW1=1 skips the once-only award branch;
// score 0x0010 + BCD 0x42 -> 0x0052.
const playOn = () => craft((mem) => {
  mem[E0] = 0; mem[PLAY] = 1; mem[PLAYER] = 1; mem[AW1] = 1;
  mem[P1_LO] = 0x10; mem[P1_HI] = 0x00; mem[DELO] = 0x42;
});

test("EQUAL (crafted): armScoreBonusStrip == oracle on seeded/play-off/play-on", { skip }, () => {
  for (const [name, mk] of [["seeded", seeded], ["play-off", playOff], ["play-on", playOn]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }
  const noOp = () => {};
  assert.ok(ramDiff(oracle, noOp, playOn()), "vacuous: oracle wrote nothing on the play-on path");
  assert.ok(ramDiff(oracle, noOp, playOff()), "vacuous: oracle wrote nothing on the play-off path");
  console.log("  EQUAL: seeded(guard) / play-off(blit+print) / play-on(blit+print+score)");
});

test("POSITIVE CONTROL: first entry seeds, blits, prints, and scores", { skip }, () => {
  const e = playOn();
  const beforeE0 = e.mem8[E0], beforeScore = e.mem8[P1_LO];
  const a = e.clone(); oracle(a);
  assert.equal(beforeE0, 0, "setup: seed guard was not clear");
  assert.equal(beforeScore, 0x10, "setup: score low byte was not seeded");
  assert.equal(a.mem8[E0], 1, "arm never seeded the guard — case is vacuous");
  assert.equal(a.mem8[BLIT_DST], a.mem8[BLIT_SRC], "arm never blitted the strip's first byte");
  assert.equal(a.mem8[BCD_DST], 0x04, "arm never printed the counter's high BCD digit");
  assert.equal(a.mem8[P1_LO], 0x52, "arm never added the counter (0x42) to the score (0x10)");
  console.log(`  POSITIVE CONTROL: E0 ${beforeE0}->${a.mem8[E0]}, score 0x${beforeScore.toString(16)}->0x${a.mem8[P1_LO].toString(16)}, digit 0x${a.mem8[BCD_DST].toString(16)}`);
});

test("POSITIVE CONTROL: a set seed suppresses the whole arm", { skip }, () => {
  const e = seeded();
  const beforeDst = e.mem8[BLIT_DST], beforeBcd = e.mem8[BCD_DST];
  const b = e.clone(); cand(b);
  assert.equal(b.mem8[BLIT_DST], beforeDst, "guard failed: candidate blitted despite the seed set");
  assert.equal(b.mem8[BCD_DST], beforeBcd, "guard failed: candidate printed despite the seed set");
  assert.equal(ramDiff(oracle, cand, seeded()), null, "seeded path diverged");
  console.log("  POSITIVE CONTROL: seed set -> no blit, no print (guard honoured)");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const restoreSeed = (m) => { const v = m.mem8[E0]; cand(m); m.mem8[E0] = v; };
  const wrongBlit = (m) => { cand(m); m.mem8[BLIT_DST] = (m.mem8[BLIT_DST] + 1) & 0xff; };
  const wrongScore = (m) => { cand(m); m.mem8[P1_LO] = (m.mem8[P1_LO] + 1) & 0xff; };
  assert.ok(ramDiff(oracle, noOp, playOn()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, restoreSeed, playOn()), "restored-seed twin escaped");
  assert.ok(ramDiff(oracle, wrongBlit, playOn()), "wrong-blit twin escaped");
  assert.ok(ramDiff(oracle, wrongScore, playOn()), "wrong-score twin escaped");
  console.log("  TEETH: no-op, restored-seed, wrong-blit, wrong-score all caught");
});
