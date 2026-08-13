// SPDX-License-Identifier: GPL-3.0-only
/** multiplexSpriteSlotsSkipping — scanline-gated position fixup over eight sprite slots. Each slot pairs a Y byte in
 * one sprite bank with the X byte at the matching offset in the other. A slot acts only while its Y
 * byte has bit 7 set and adding the live scanline counter to it carries out of the top; on that
 * trigger the Y byte's bit 7 is cleared, quieting the slot, and the X byte's bit 7 is toggled.
 * LIVE-OUT: the touched sprite bytes, plus the accumulator, C and flags left by the last slot. */

import {
  loc_c000,
  loc_b411, loc_b010,
  loc_b413, loc_b012,
  loc_b415, loc_b014,
  loc_b437, loc_b036,
  loc_b439, loc_b038,
  loc_b43b, loc_b03a,
  loc_b43d, loc_b03c,
  loc_b43f, loc_b03e,
} from "./names.js";

const DISARM_MASK = 0x7f;
const TOGGLE_X_BIT7 = 0x80;

// [Y byte, X byte] for each of the eight slots this pass covers.
const SLOTS = [
  [loc_b411, loc_b010],
  [loc_b413, loc_b012],
  [loc_b415, loc_b014],
  [loc_b437, loc_b036],
  [loc_b439, loc_b038],
  [loc_b43b, loc_b03a],
  [loc_b43d, loc_b03c],
  [loc_b43f, loc_b03e],
];

function serviceSlot(m, yAddr, xAddr) {
  const { regs, mem } = m;
  regs.a = mem.read8(yAddr);
  regs.bit(7, regs.a);
  if (regs.fZ) return;
  regs.c = regs.a;
  regs.a = mem.read8(loc_c000);
  regs.add(regs.c);
  if (regs.fNC) return; // beam not past the trigger line yet
  regs.a = regs.c;
  regs.and(DISARM_MASK);
  mem.write8(yAddr, regs.a);
  regs.a = mem.read8(xAddr);
  regs.add(TOGGLE_X_BIT7);
  mem.write8(xAddr, regs.a);
  if (m.beamPlan) m.beamPlan.push({ y: yAddr, x: xAddr }); // record for the beam-sync render
}

export function multiplexSpriteSlotsSkipping(m) {
  for (const [yAddr, xAddr] of SLOTS) serviceSlot(m, yAddr, xAddr);
  return m.ret();
}
