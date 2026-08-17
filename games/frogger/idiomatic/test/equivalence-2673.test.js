// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardBonusPoints — memory-equivalent to the frozen oracle at ROM 0x2673 (a caller-skip DISSOLVED to a
 * boolean skip-signal, direct-called by awardHomeBayGoal — runs as JS, not oracle-served; this gate is
 * its memory-equivalence check against the ROM routine).
 * With the slot cursor clear it seeds the score popup + arms the timer + adds BCD 0x20; with it set it
 * raises the hold flag and pops the caller's return. Both arms are driven from a captured post-boot
 * state with B armed and PLAY_FLAG set. Teeth: no-op, wrong popup position, wrong arm; positive control
 * the skip arm raises the hold flag. RAM compared, stack masked.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, PLAY_FLAG } from "./_frogHop.js";
import { awardBonusPoints as cand } from "../awardBonusPoints.js";
import { loc_2673 as oracle } from "../../translated/loc_2673.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const CURSOR = 0x8120, POPUP = 0x805c, HOLD = 0x8004;
const POS = 0x50;

const award = () => { const e = craft((mem) => { mem[CURSOR] = 0; mem[PLAY_FLAG] = 1; }); e.regs.b = POS; return e; };
const skipArm = () => { const e = craft((mem) => { mem[CURSOR] = 1; mem[HOLD] = 0; }); e.regs.b = POS; return e; };

test("EQUAL (crafted): awardBonusPoints == oracle on the award and caller-skip arms", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, award()), null, "the award arm diverged");
  assert.equal(ramDiff(oracle, cand, skipArm()), null, "the caller-skip arm diverged");

  const e = skipArm(); const before = e.mem8[HOLD]; const a = e.clone(); oracle(a);
  assert.notEqual(a.mem8[HOLD], before, "skip arm not exercised: hold flag never raised");
  console.log(`  EQUAL: award + caller-skip; skip raised hold ${before}->${a.mem8[HOLD]}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongPos = (m) => { cand(m); m.mem8[POPUP] = (m.mem8[POPUP] + 1) & 0xff; };
  const wrongArm = (m) => { m.regs.de = 0x20; };
  assert.ok(ramDiff(oracle, noOp, award()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongPos, award()), "wrong-position twin escaped");
  assert.ok(ramDiff(oracle, wrongArm, skipArm()), "wrong-arm twin escaped");
  console.log("  TEETH: no-op, wrong-popup-position, wrong-arm all caught");
});
