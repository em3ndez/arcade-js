// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  STATUS_FLAGS, PLAYER_LEVEL_TBL, SLOT_COUNTDOWN, SLOT_COUNTDOWN_HI, loc_3d, ACTIVE_SLOT_COUNT, LEVEL_ID, SPIKE_TABLE_GUARD, DSW_BONUS_CONFIG,
} from "./names.js";
import { loc_aba2 } from "./loc_aba2.js";
import { buildLevelLayout } from "./buildLevelLayout.js";
import { clearChannelStagingBlock } from "./clearChannelStagingBlock.js";
import { selectWaveStartSlot } from "./selectWaveStartSlot.js";

// Reset the per-slot state, then tail-delegate. Runs the two setup passes, and when STATUS_FLAGS is
// negative a third; clears SLOT_COUNTDOWN_HI; seeds every slot from ACTIVE_SLOT_COUNT down to 0 (SLOT_COUNTDOWN,slot = DSW_BONUS_CONFIG,
// PLAYER_LEVEL_TBL,slot = 0xff); clears LEVEL_ID and SPIKE_TABLE_GUARD; reloads loc_3d from ACTIVE_SLOT_COUNT.
export function resetLevelPlayfieldSlots(m) {
  const { mem8 } = m;

  loc_aba2(m);
  buildLevelLayout(m);
  if ((mem8[STATUS_FLAGS] & 0x80) !== 0) clearChannelStagingBlock(m);

  mem8[SLOT_COUNTDOWN_HI] = 0;

  mem8[loc_3d] = mem8[ACTIVE_SLOT_COUNT];
  while (true) {
    const slot = mem8[loc_3d];
    mem8[u16(SLOT_COUNTDOWN + slot)] = mem8[DSW_BONUS_CONFIG];
    mem8[u16(PLAYER_LEVEL_TBL + slot)] = 0xff;
    const next = u8(mem8[loc_3d] - 1);
    mem8[loc_3d] = next;
    if ((next & 0x80) !== 0) break;
  }

  mem8[LEVEL_ID] = 0;
  mem8[SPIKE_TABLE_GUARD] = 0;
  mem8[loc_3d] = mem8[ACTIVE_SLOT_COUNT];

  return selectWaveStartSlot(m);
}
