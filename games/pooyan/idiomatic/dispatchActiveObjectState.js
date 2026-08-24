// SPDX-License-Identifier: GPL-3.0-only
import { armObjectFromSpawnRing } from "./armObjectFromSpawnRing.js";
import { moveObject } from "./moveObject.js";
import { drawObjectStackedTiles } from "./drawObjectStackedTiles.js";
import { advanceAttractStateIfImageIntact } from "./advanceAttractStateIfImageIntact.js";
/**
 * dispatchActiveObjectState — run one object record's per-frame state handler.
 *
 * Skips the record entirely when it is inactive (bit0 of the first two bytes both clear). For an
 * active record the low two bits of the state byte select one of four handlers; each is a tail
 * hand-off — no continuation is stacked here, so the handler returns straight to our caller.
 *
 * LIVE-OUT: memory only — the caller (the record-scan loop) reads no register or flag back.
 */
export function dispatchActiveObjectState(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Inactive record: bit0 of (rec+0) | (rec+1) clear -> nothing to service.
  if (((mem8[rec + 0x00] | mem8[rec + 0x01]) & 1) === 0) return;

  switch (mem8[rec + 0x02] & 0x03) {
    case 0: return armObjectFromSpawnRing(m, rec);
    case 1: return moveObject(m, rec);
    case 2: return drawObjectStackedTiles(m, rec);
    case 3: return advanceAttractStateIfImageIntact(m, rec);
  }
}
