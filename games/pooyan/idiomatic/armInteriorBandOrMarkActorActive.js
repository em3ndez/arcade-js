// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { despawnActorAndRenderStageCountdown } from "./despawnActorAndRenderStageCountdown.js";
import {
  ANIM_ARMED_LATCH,
  SPAWN_PHASE_SNAPSHOT,
  ANIM_TABLE_3418,
  TURN_COLUMN_LIMIT,
  SPRITE_BAND_86E3,
} from "./names.js";
/**
 * armInteriorBandOrMarkActorActive — interior-entry arm for the shared movement tail. When the anim-armed latch is already
 * set it just marks the record active-1 and returns. Otherwise it clears that record byte, steps the
 * capped animation phase, and (once the phase is below the cap) looks the phase up in a row table
 * to seed the turn-column limit, stamps the 2x2 interior sprite band, raises the anim-armed latch,
 * and falls into the shared despawn/movement tail. At/above the cap it goes straight to the tail.
 *
 * LIVE-OUT: memory only. Every exit either ends in the render-only tail or in a bare return after a
 * single (record+1) write; the record-dispatch caller does not read a result register back.
 */

const REC_ACTIVE_FLAG = 0x01; // record byte written 1 (armed) / 0 (clearing before the phase step)
const PHASE_CAP = 0x07; //      phase at/above which we skip straight to the tail
const PHASE_STEP_CAP = 0x0a; //  phase below which the phase counter is stepped up
const ROW_STRIDE = 0x20; //     tilemap row pitch between the band's two rows
const BAND_TL = 0xd8; // band tiles, row-major from the base: top-left / top-right ...
const BAND_TR = 0xd9;
const BAND_BL = 0xda;
const BAND_BR = 0xdb;

export function armInteriorBandOrMarkActorActive(m, rec = m.regs.ix) {
  const { mem8 } = m;

  if (mem8[ANIM_ARMED_LATCH] !== 0) {
    mem8[u16(rec + 0x01)] = REC_ACTIVE_FLAG; // already armed: just mark active
    return;
  }

  mem8[u16(rec + 0x01)] = 0x00;
  const phase = mem8[SPAWN_PHASE_SNAPSHOT];
  if (phase >= PHASE_CAP) return despawnActorAndRenderStageCountdown(m, rec); // capped: straight to the shared tail

  if (phase < PHASE_STEP_CAP) {
    mem8[SPAWN_PHASE_SNAPSHOT] = mem8[SPAWN_PHASE_SNAPSHOT] + 1;
  }
  const [limit] = fetchByteFromTableIndex(m, ANIM_TABLE_3418, mem8[SPAWN_PHASE_SNAPSHOT]); // row-table lookup
  mem8[TURN_COLUMN_LIMIT] = limit;

  // Stamp the 2x2 interior sprite band: two tiles at the base, two more one row down.
  mem8[SPRITE_BAND_86E3] = BAND_TL;
  mem8[u16(SPRITE_BAND_86E3 + 0x01)] = BAND_TR;
  mem8[u16(SPRITE_BAND_86E3 + ROW_STRIDE)] = BAND_BL;
  mem8[u16(SPRITE_BAND_86E3 + ROW_STRIDE + 0x01)] = BAND_BR;

  mem8[ANIM_ARMED_LATCH] = REC_ACTIVE_FLAG; // raise the anim-armed latch
  return despawnActorAndRenderStageCountdown(m, rec); // fall into the shared despawn/movement tail
}
