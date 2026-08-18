// SPDX-License-Identifier: GPL-3.0-only
/**
 * placeSpriteObjectSlotAndRetire — IX sprite-object motion arm. Skipped when the record's active flag is clear; otherwise
 * runs the shared arm helper, derives the object's on-screen X into the sprite slot, mirrors its
 * attribute byte, and sets a position byte from a +15 / -15 bias. On the wrap condition (the bias
 * lands on the fold value and the record's retire flag is set) it clears the record and sprite slot.
 * LIVE-OUT: memory-only (the sprite-slot bytes, and on the wrap the cleared record and slot).
 */
import { FREE_RUNNING_POS_COUNTER } from "./names.js";
import { raiseSpriteArmOneShotAndQueueSound } from "./raiseSpriteArmOneShotAndQueueSound.js";

export function placeSpriteObjectSlotAndRetire(m, ix = m.regs.ix, iy = m.regs.iy) {
  const { mem8 } = m;

  if (mem8[(ix + 6)] === 0) return; // inactive object

  raiseSpriteArmOneShotAndQueueSound(m);
  const record = ix;
  const slot = iy;

  const attr = mem8[(record + 4)];
  let onScreenX;
  if (attr >= 0x60) {
    onScreenX = mem8[(record + 3)];
  } else {
    onScreenX = (mem8[FREE_RUNNING_POS_COUNTER] - mem8[(record + 2)]) & 0xff; // drift toward the free-running counter
  }
  mem8[slot] = onScreenX;
  mem8[(slot + 3)] = attr;
  mem8[(slot + 7)] = attr;

  let reachedFold;
  if (mem8[(record + 5)] !== 0) {
    mem8[(slot + 4)] = 0xf1 + onScreenX;
    reachedFold = onScreenX === 0;
  } else {
    const biased = (0x0f + onScreenX) & 0xff;
    mem8[(slot + 4)] = biased;
    reachedFold = ((biased + 1) & 0xff) === 0;
  }
  if (!reachedFold) return;
  if (mem8[(record + 7)] === 0) return;

  for (let i = 0; i < 16; i++) mem8[(record + i)] = 0;
  for (let i = 0; i < 8; i++) mem8[(slot + i)] = 0;
  mem8[(record + 10)] = 0x20;
}
