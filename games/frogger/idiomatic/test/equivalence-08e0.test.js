// SPDX-License-Identifier: GPL-3.0-only
/**
 * addScoreAndAwardExtraLife — memory-equivalent to the frozen oracle at ROM 0x08E0.
 * GATE: crafted-entry. From a captured post-boot state the play gate, active player, score words,
 * award flags and DE delta are poked to drive: the play-gate early return; a BCD add whose low-byte
 * daa carry propagates into the high byte; the first crossing of the ROM target (0x2E08 = 0x2000)
 * awarding the bonus (flag set, counter bumped, HUD tile + rst-18 enqueue); the already-awarded skip;
 * a below-target no-award; the high-score trail; and a player-2 routing case. Live-out memory-only;
 * RAM compared, dead stack masked. Teeth: no-op, wrong score, un-set award flag; positive control the
 * award flag really goes 0->1.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff } from "./_frogHop.js";
import { addScoreAndAwardExtraLife as cand } from "../addScoreAndAwardExtraLife.js";
import { loc_08e0 as oracle } from "../../translated/loc_08e0.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const PLAY = 0x83fe, PLAYER = 0x83fd;
const P1_LO = 0x83ed, P1_HI = 0x83ee, P2_LO = 0x83eb, P2_HI = 0x83ec;
const AW1 = 0x83e7, AW2 = 0x83e8, CNT1 = 0x83e5, CNT2 = 0x83e6, SCRATCH = 0x83cf;
const HI_LO = 0x83ef, HI_HI = 0x83f0;

const gate = () => craft((mem, c) => { mem[PLAY] = 0; c.regs.de = 0x0010; });
// score 0x1990 + 0x0010 -> daa carry -> 0x2000 == target 0x2E08, award flag clear.
const award = () => craft((mem, c) => {
  mem[PLAY] = 1; mem[PLAYER] = 1; mem[AW1] = 0; mem[AW2] = 0;
  mem[P1_LO] = 0x90; mem[P1_HI] = 0x19; mem[CNT1] = 3; mem[SCRATCH] = 0x55;
  mem[HI_LO] = 0x00; mem[HI_HI] = 0x10; c.regs.de = 0x0010;
});
const already = () => craft((mem, c) => {
  mem[PLAY] = 1; mem[PLAYER] = 1; mem[AW1] = 1; mem[P1_LO] = 0x00; mem[P1_HI] = 0x20; c.regs.de = 0x0000;
});
const below = () => craft((mem, c) => {
  mem[PLAY] = 1; mem[PLAYER] = 1; mem[AW1] = 0; mem[P1_LO] = 0x00; mem[P1_HI] = 0x10;
  mem[HI_LO] = 0x99; mem[HI_HI] = 0x09; c.regs.de = 0x0005;
});
// player 2: score 0x1995 + 0x0006 -> 0x2001 >= target, routes to 0x83eb / 0x83e8 / 0x83e6.
const p2 = () => craft((mem, c) => {
  mem[PLAY] = 1; mem[PLAYER] = 2; mem[AW2] = 0; mem[AW1] = 0;
  mem[P2_LO] = 0x95; mem[P2_HI] = 0x19; mem[CNT2] = 7; c.regs.de = 0x0006;
});

test("EQUAL (crafted): addScoreAndAwardExtraLife == oracle on gate/award/already/below/p2", { skip }, () => {
  for (const [name, mk] of [["gate", gate], ["award", award], ["already", already], ["below", below], ["p2", p2]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }
  const noOp = () => {};
  assert.ok(ramDiff(oracle, noOp, award()), "vacuous: oracle wrote nothing on the award path");
  assert.ok(ramDiff(oracle, noOp, below()), "vacuous: oracle wrote nothing on the below/high-score path");
  console.log("  EQUAL: gate/award(BCD-carry)/already/below/high-score + p2 routing");
});

test("POSITIVE CONTROL: the award sets the flag (0 -> 1) and bumps the counter", { skip }, () => {
  const e = award(); const beforeFlag = e.mem8[AW1], beforeCnt = e.mem8[CNT1];
  const a = e.clone(); oracle(a);
  assert.equal(beforeFlag, 0, "setup: award flag was not clear");
  assert.equal(a.mem8[AW1], 1, "award never set the flag — case is vacuous");
  assert.equal(a.mem8[CNT1], (beforeCnt + 1) & 0xff, "award never bumped the counter");
  console.log(`  POSITIVE CONTROL: award flag ${beforeFlag}->${a.mem8[AW1]}, counter ${beforeCnt}->${a.mem8[CNT1]}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongScore = (m) => { cand(m); m.mem8[P1_LO] = (m.mem8[P1_LO] + 1) & 0xff; };
  const skipAwardFlag = (m) => { cand(m); m.mem8[AW1] = 0; };
  assert.ok(ramDiff(oracle, noOp, award()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongScore, award()), "wrong-score twin escaped");
  assert.ok(ramDiff(oracle, skipAwardFlag, award()), "skip-award-flag twin escaped");
  console.log("  TEETH: no-op, wrong-score, skip-award-flag all caught");
});
