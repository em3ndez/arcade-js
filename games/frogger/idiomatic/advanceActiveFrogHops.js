// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceActiveFrogHops — per-vblank continuation of any in-progress directional hop.
 *
 * Points the cursors at the frog X/Y cells, then for each of the four hop directions: if the
 * direction's hop-active flag is set, hand off to that direction's advance handler to step the hop
 * one frame; otherwise clear that direction's arrival mirror flag. LIVE-OUT: memory-only.
 */
import {
  FROG_X, FROG_Y,
  FROG_HOP_DOWN_ACTIVE, FROG_HOP_UP_ACTIVE, FROG_HOP_RIGHT_ACTIVE, FROG_HOP_LEFT_ACTIVE,
  FROG_HOP_DOWN_ARRIVAL, FROG_HOP_UP_ARRIVAL, FROG_HOP_RIGHT_ARRIVAL, FROG_HOP_LEFT_ARRIVAL,
} from "./names.js";
import {
  advanceFrogHopDown, advanceFrogHopUp,
  advanceFrogHopRight, advanceFrogHopLeft,
} from "./animateFrogHop.js";

export function advanceActiveFrogHops(m) {
  const { regs, mem8 } = m;
  regs.hl = FROG_X;
  regs.de = FROG_Y;

  regs.a = mem8[FROG_HOP_DOWN_ACTIVE];
  if (regs.a !== 0) return advanceFrogHopDown(m);
  mem8[FROG_HOP_DOWN_ARRIVAL] = 0;

  regs.a = mem8[FROG_HOP_UP_ACTIVE];
  if (regs.a !== 0) return advanceFrogHopUp(m);
  mem8[FROG_HOP_UP_ARRIVAL] = 0;

  regs.a = mem8[FROG_HOP_RIGHT_ACTIVE];
  if (regs.a !== 0) return advanceFrogHopRight(m);
  mem8[FROG_HOP_RIGHT_ARRIVAL] = 0;

  regs.a = mem8[FROG_HOP_LEFT_ACTIVE];
  if (regs.a !== 0) return advanceFrogHopLeft(m);
  mem8[FROG_HOP_LEFT_ARRIVAL] = 0;
}
