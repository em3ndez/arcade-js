// SPDX-License-Identifier: GPL-3.0-only
/** setTheLaunchFacingInsideOneAimWindow — the last gate before a launch: on one sprite-entry coordinate the launcher
 * must lie inside a window centred on a fixed line whose half-width is ATTACKER_SPAWN_AIM_WINDOW_HALF (a setting, not
 * baked in) -- outside it nothing launches; inside, the other coordinate's side of a second line is handed over as
 * the facing bit. LIVE-OUT: memory — inside the window, whatever the launcher writes; outside it, nothing. */

import { u8, u16 } from "../../../core/int.js";
import { commissionStagedAttackerByEra } from "./commissionStagedAttackerByEra.js";
import { ATTACKER_SPAWN_AIM_WINDOW_HALF } from "./names.js";

const WINDOW_CENTRE = 0x84;
const FACING_LINE = 0x78;

const ENTRY_OTHER_COORD = 0x31;

export function setTheLaunchFacingInsideOneAimWindow(m, record = m.regs.ix, entry = m.regs.iy) {
  const { mem8 } = m;
  const half = mem8[ATTACKER_SPAWN_AIM_WINDOW_HALF];
  const width = u8(half + half);
  const intoWindow = u8(WINDOW_CENTRE - mem8[entry] + half);
  if (intoWindow >= width) return; // outside the window nothing launches

  const facing = mem8[u16(entry + ENTRY_OTHER_COORD)] > FACING_LINE ? 1 : 0;
  // Hand the facing to the launcher and continue straight into it.
  return commissionStagedAttackerByEra(m, record, entry, facing);
}
