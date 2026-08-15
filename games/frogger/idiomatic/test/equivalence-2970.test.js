// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveSpriteObjectCluster (0x2970) == frozen oracle. GATE: crafted-entry. The cluster entry gates on
 * the slot count: below 3 it runs only dispatcher B; at 3..5 it runs dispatcher A twice on the SAME
 * record/slot; at 6+ the second pass advances to the next record/slot; the active player selects the
 * record pair. From a captured post-boot state the slot count + active player are poked to drive every
 * arm. Live-out memory-only; RAM compared, dead stack scratch masked. Teeth: a no-op, and a twin that
 * fails to advance the second-pass record at count>=6; positive control a dispatcher-A record moves.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { romsPresent, craft, ramDiff } from "./_frogHop.js";
import { driveSpriteObjectCluster as cand } from "../driveSpriteObjectCluster.js";
import { loc_2970 as oracle } from "../../translated/loc_2970.js";
import { updateSpriteObject } from "../updateSpriteObject.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const SLOT_COUNT = 0x83b7, ACTIVE_PLAYER = 0x83fd, RECORD_A_TIMER = 0x8448;

const cluster = (count, player) => () => craft((mem) => { mem[SLOT_COUNT] = count; mem[ACTIVE_PLAYER] = player; });

test("EQUAL (crafted): driveSpriteObjectCluster == oracle across the slot-count arms", { skip }, () => {
  for (const [name, mk] of [["count<3", cluster(0x02, 1)], ["3..5 P1", cluster(0x03, 1)], ["3..5 P2", cluster(0x04, 2)], ["count>=6 P2", cluster(0x07, 2)]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} case diverged`);
  }
  const e = cluster(0x04, 1)(); const a = e.clone(); const before = a.mem8[RECORD_A_TIMER]; oracle(a);
  assert.notEqual(a.mem8[RECORD_A_TIMER], before, "positive control: a dispatcher-A record byte must move");
  console.log(`  EQUAL: count<3 / 3..5 P1,P2 / count>=6; dispatcher-A record ${before}->${a.mem8[RECORD_A_TIMER]}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const noAdvance = (m) => {
    const { regs, mem8 } = m;
    if (mem8[SLOT_COUNT] >= 3) {
      regs.ix = mem8[ACTIVE_PLAYER] === 1 ? 0x8440 : 0x8460; regs.iy = 0x8048;
      m.push16(0x298e); m.call(0x29b9);
      m.push16(0x29a1); m.call(0x29b9); // BUG: never advance IX/IY at count>=6
    }
    regs.ix = mem8[ACTIVE_PLAYER] === 1 ? 0x8480 : 0x8490; regs.iy = 0x8058;
    return updateSpriteObject(m);
  };
  assert.ok(ramDiff(oracle, noOp, cluster(0x04, 1)()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, noAdvance, cluster(0x07, 2)()), "no-advance twin escaped");
  console.log("  TEETH: no-op, no-advance-at-count>=6 both caught");
});
