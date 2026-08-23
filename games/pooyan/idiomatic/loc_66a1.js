// SPDX-License-Identifier: GPL-3.0-only
import { copyDisplayTilesIntoActorRecords } from "./copyDisplayTilesIntoActorRecords.js";
import {
  BLINK_PHASE,
  ANIM_PHASE_TOGGLE_892C,
  TILE_SRC_ROW_66BF,
  TILE_SRC_ROW_66C2,
} from "./names.js";
/**
 * loc_66a1 — countdown-gated sprite-table applier.
 *
 * Counts the BLINK_PHASE cell down; while it stays non-zero the routine returns at once. On
 * reaching zero it reloads that cell to 0x08, advances the select phase, and by the phase's bit 0
 * picks one of two 3-tile source tables (bit 0 clear -> even, set -> odd). It then hands three
 * actor records (one record backward each) their tiles via the tile-run copier.
 *
 * LIVE-OUT: none — the sole caller issues this then ret's, reading nothing back; IX is a
 * live-in forwarded to the tile-run copier.
 */

const RELOAD = 0x08; //        countdown reload once it drains
const RECORD_COUNT = 0x03; //  actor records written per pass
const RECORD_STRIDE = -0x18; // one actor record backward
const STRIDE_LOW = 0xe8; //    stride low byte (the E value the tile-run copier reads on its divert path)

export function loc_66a1(m, ix = m.regs.ix) {
  const { mem8 } = m;

  const remaining = (mem8[BLINK_PHASE] - 1) & 0xff;
  mem8[BLINK_PHASE] = remaining;
  if (remaining !== 0) return; // countdown still live

  mem8[BLINK_PHASE] = RELOAD;
  const phase = (mem8[ANIM_PHASE_TOGGLE_892C] + 1) & 0xff;
  mem8[ANIM_PHASE_TOGGLE_892C] = phase;
  const table = (phase & 0x01) === 0 ? TILE_SRC_ROW_66BF : TILE_SRC_ROW_66C2;
  copyDisplayTilesIntoActorRecords(m, table, RECORD_COUNT, RECORD_STRIDE, ix, STRIDE_LOW);
}
