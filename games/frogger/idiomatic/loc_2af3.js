// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2af3 — IX sprite-object motion arm. Skipped when the record's active flag is clear; otherwise
 * runs the shared arm helper, derives the object's on-screen X into the sprite slot, mirrors its
 * attribute byte, and sets a position byte from a +15 / -15 bias. On the wrap condition (the bias
 * lands on the fold value and the record's retire flag is set) it clears the record and sprite slot.
 * LIVE-OUT: memory-only (the sprite-slot bytes, and on the wrap the cleared record and slot).
 */
import { loc_8014 } from "./names.js";

const ARM_HELPER = 0x2ae6; // raise the one-shot and queue the arm sound

export function loc_2af3(m) {
  const { regs, mem8 } = m;

  if (mem8[(regs.ix + 6) & 0xffff] === 0) return; // inactive object

  m.push16(0x2afb); m.call(ARM_HELPER);
  const record = regs.ix;
  const slot = regs.iy;

  const attr = mem8[(record + 4) & 0xffff];
  let onScreenX;
  if (attr >= 0x60) {
    onScreenX = mem8[(record + 3) & 0xffff];
  } else {
    onScreenX = (mem8[loc_8014] - mem8[(record + 2) & 0xffff]) & 0xff; // drift toward the frog
  }
  mem8[slot & 0xffff] = onScreenX;
  mem8[(slot + 3) & 0xffff] = attr;
  mem8[(slot + 7) & 0xffff] = attr;

  let reachedFold;
  if (mem8[(record + 5) & 0xffff] !== 0) {
    mem8[(slot + 4) & 0xffff] = (0xf1 + onScreenX) & 0xff;
    reachedFold = onScreenX === 0;
  } else {
    const biased = (0x0f + onScreenX) & 0xff;
    mem8[(slot + 4) & 0xffff] = biased;
    reachedFold = ((biased + 1) & 0xff) === 0;
  }
  if (!reachedFold) return;
  if (mem8[(record + 7) & 0xffff] === 0) return;

  for (let i = 0; i < 16; i++) mem8[(record + i) & 0xffff] = 0;
  for (let i = 0; i < 8; i++) mem8[(slot + i) & 0xffff] = 0;
  mem8[(record + 10) & 0xffff] = 0x20;
}
