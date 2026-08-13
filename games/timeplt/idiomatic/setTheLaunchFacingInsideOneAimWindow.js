// SPDX-License-Identifier: GPL-3.0-only
/** setTheLaunchFacingInsideOneAimWindow — the last gate before a launch: on one sprite-entry coordinate the launcher
 * must lie inside a window centred on a fixed line whose half-width is ATTACKER_SPAWN_AIM_WINDOW_HALF (a setting, not
 * baked in) -- outside it nothing launches; inside, the other coordinate's side of a second line is handed over as the facing bit. LIVE-OUT: memory + that byte. */

import { u8, u16 } from "../../../core/int.js";
import { ATTACKER_SPAWN_AIM_WINDOW_HALF, commissionStagedAttackerByEra_ADDR } from "./names.js";

const WINDOW_CENTRE = 0x84;
const FACING_LINE = 0x78;

const ENTRY_OTHER_COORD = 0x31;

export function setTheLaunchFacingInsideOneAimWindow(m) {
  const { regs, mem8 } = m;
  const half = mem8[ATTACKER_SPAWN_AIM_WINDOW_HALF];
  const intoWindow = u8(WINDOW_CENTRE - mem8[regs.iy] + half);
  if (intoWindow >= u8(half + half)) return;

  regs.c = mem8[u16(regs.iy + ENTRY_OTHER_COORD)] > FACING_LINE ? 1 : 0;
  return m.call(commissionStagedAttackerByEra_ADDR);
}
