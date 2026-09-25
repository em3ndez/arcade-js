// SPDX-License-Identifier: GPL-3.0-only
/** setTheLaunchFacingInsideOneAimWindow — the last gate before a launch: on one sprite-entry coordinate the launcher
 * must lie inside a window centred on a fixed line whose half-width is ATTACKER_SPAWN_AIM_WINDOW_HALF (a setting, not
 * baked in) -- outside it nothing launches; inside, the other coordinate's side of a second line is handed over as
 * the facing bit. LIVE-OUT: inside the window, memory and the facing bit in C, then whatever the launcher leaves;
 * outside it, the working value in the accumulator, the doubled half-width in C, the half-width in D, and the flags
 * of the width comparison. */

import { u8, u16 } from "../../../core/int.js";
import { F_C, F_H, F_N, F_PV, F_S, F_Z, F_F3, F_F5 } from "../../../core/cpu/z80.js";
import { commissionStagedAttackerByEra } from "./commissionStagedAttackerByEra.js";
import { ATTACKER_SPAWN_AIM_WINDOW_HALF } from "./names.js";

const WINDOW_CENTRE = 0x84;
const FACING_LINE = 0x78;

const ENTRY_OTHER_COORD = 0x31;

export function setTheLaunchFacingInsideOneAimWindow(m, entry = m.regs.iy) {
  const { mem8 } = m;
  const half = mem8[ATTACKER_SPAWN_AIM_WINDOW_HALF];
  const width = u8(half + half);
  const intoWindow = u8(WINDOW_CENTRE - mem8[entry] + half);
  if (intoWindow >= width) {
    // Outside the window: seat the working value, the doubled half-width, the half-width and the flags the
    // width comparison leaves (an unsigned compare, its result discarded; the F3/F5 bits come from the width).
    const diff = u8(intoWindow - width);
    const flags =
      (diff & 0x80 ? F_S : 0) |
      (diff === 0 ? F_Z : 0) |
      (width & (F_F3 | F_F5)) |
      F_N |
      (intoWindow < width ? F_C : 0) |
      (((intoWindow ^ width ^ diff) & 0x10) ? F_H : 0) |
      (((intoWindow ^ width) & (intoWindow ^ diff) & 0x80) ? F_PV : 0);
    return (m.regs.a = intoWindow, m.regs.c = width, m.regs.d = half, m.regs.f = flags, undefined);
  }

  const facing = mem8[u16(entry + ENTRY_OTHER_COORD)] > FACING_LINE ? 1 : 0;
  // Hand the facing to the launcher in C (its live-in) and continue straight into it.
  return (m.regs.c = facing, commissionStagedAttackerByEra(m));
}
