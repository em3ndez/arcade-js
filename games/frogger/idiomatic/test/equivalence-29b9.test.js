// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchSpriteObjectArmsA (0x29b9) == frozen oracle. GATE: crafted-entry. Dispatcher A runs the five
 * IX/IY per-slot arms in fixed order then returns; the spawn-arm sibling stays a direct dispatch, the
 * other four are called inline. From a captured post-boot state, regs.ix/iy are aimed at a real
 * record/slot and the slot count + active flag are poked so several arms write, for player 1, player 2,
 * and the count>=6 case. Live-out memory-only; RAM compared, dead stack scratch masked. Teeth: a no-op,
 * and a twin that drops the animation arm (which always decrements its frame timer); positive control
 * the animation frame timer really moves.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { romsPresent, craft, ramDiff } from "./_frogHop.js";
import { dispatchSpriteObjectArmsA as cand } from "../dispatchSpriteObjectArmsA.js";
import { loc_29b9 as oracle } from "../../translated/loc_29b9.js";
import { loc_29f9 } from "../loc_29f9.js";
import { placeSpriteObjectSlotAndRetire } from "../placeSpriteObjectSlotAndRetire.js";
import { flagSpriteObjectFrogHit } from "../flagSpriteObjectFrogHit.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const REC = 0x8440, SLOT = 0x8048, SLOT_COUNT = 0x83b7, ACTIVE_PLAYER = 0x83fd;

const armed = (player, count = 0x03) => () => craft((mem, mm) => {
  mm.regs.ix = REC; mm.regs.iy = SLOT;
  mem[SLOT_COUNT] = count; mem[ACTIVE_PLAYER] = player; mem[(REC + 0x06) & 0xffff] = 0x01;
});

test("EQUAL (crafted): dispatchSpriteObjectArmsA == oracle running the five arms", { skip }, () => {
  for (const [name, mk] of [["P1", armed(1)], ["P2", armed(2)], ["count>=6", armed(1, 0x07)]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} case diverged`);
  }
  const e = armed(1)(); const a = e.clone(); const before = a.mem8[(REC + 0x08) & 0xffff]; oracle(a);
  assert.notEqual(a.mem8[(REC + 0x08) & 0xffff], before, "positive control: the animation frame timer (ix+8) must move");
  console.log(`  EQUAL: P1/P2/count>=6; frame timer ${before}->${a.mem8[(REC + 0x08) & 0xffff]}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const dropAnimate = (m) => {
    m.push16(0x29bc); m.call(0x2a6a); loc_29f9(m); placeSpriteObjectSlotAndRetire(m); flagSpriteObjectFrogHit(m);
  };
  assert.ok(ramDiff(oracle, noOp, armed(1)()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, dropAnimate, armed(1)()), "drop-animate twin escaped");
  console.log("  TEETH: no-op, drop-animate-arm both caught");
});
