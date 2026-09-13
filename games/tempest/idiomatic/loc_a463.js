// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  loc_2e, SLOT_LOOP_INDEX, TABLE_CURSOR, HIT_DISTANCE_THRESHOLD,
  ACTIVE_OBJECT_COUNT, ENEMY_BAND_THRESHOLD_0, PLAYER_SHOT_DEPTH, OBJECT_BAND, TARGET_SEG, loc_2b5, loc_2c0, loc_2c8, SLOT_STATE, loc_2db, HIT_TALLY,
} from "./names.js";
import { loc_a36f } from "./loc_a36f.js";
import { loc_a309 } from "./loc_a309.js";
import { loc_a38e } from "./loc_a38e.js";

// Scan slots y = 10..0 of loc_2db against threshold A (kept in loc_2e). For each nonzero entry form
// delta = |entry - threshold|. Near slots (y < 4) with delta below HIT_DISTANCE_THRESHOLD and a matching loc_2b5/TARGET_SEG
// pair retire via the pair-retire helper. Far slots (y >= 4) fold OBJECT_BAND,y to a 3-bit band; when delta is under the
// band threshold ENEMY_BAND_THRESHOLD_0,band a chain of loc_2c8/loc_2b5/loc_2c0/TARGET_SEG/PLAYER_SHOT_DEPTH tests dispatches
// the band-4 handler (band 4) or the other-band handler (other bands). After the scan, if slot X of HIT_TALLY reads 0xff the slot
// is cleared (SLOT_STATE,x and HIT_TALLY,x) and the live count ACTIVE_OBJECT_COUNT drops.
export function loc_a463(m, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;

  const threshold = a;
  mem8[loc_2e] = threshold;

  for (let y = 10; y >= 0; y--) {
    const entry = mem8[u16(loc_2db + y)];
    if (entry === 0) continue;
    const delta = entry >= threshold ? entry - threshold : threshold - entry;

    if (y < 4) {
      if (delta >= mem8[HIT_DISTANCE_THRESHOLD]) continue;
      if (mem8[u16(loc_2b5 + y)] !== mem8[u16(TARGET_SEG + x)]) continue;
      loc_a36f(m, x, y);
      continue;
    }

    // Far slot: fold to a 3-bit band and test delta against the band threshold.
    mem8[TABLE_CURSOR] = y;
    const band = mem8[u16(OBJECT_BAND + y)] & 0x07;
    if (delta >= mem8[u16(ENEMY_BAND_THRESHOLD_0 + band)]) continue;

    if (band === 4) {
      if (mem8[u16(loc_2db + y)] === mem8[PLAYER_SHOT_DEPTH]) continue;
      if (mem8[u16(TARGET_SEG + x)] !== mem8[u16(loc_2b5 + y)]) continue;
      if ((mem8[u16(loc_2c8 + y)] & 0x80) === 0) continue;
      loc_a309(m, x, y);
      continue;
    }

    let doCall;
    if ((mem8[u16(loc_2c8 + y)] & 0x80) !== 0) {
      doCall = mem8[u16(loc_2b5 + y)] === mem8[u16(loc_2c0 + x)]
        ? true
        : mem8[u16(loc_2b5 + y)] === mem8[u16(TARGET_SEG + x)];
    } else if (mem8[u16(loc_2db + y)] === mem8[PLAYER_SHOT_DEPTH]) {
      doCall = false;
    } else {
      doCall = mem8[u16(loc_2b5 + y)] === mem8[u16(TARGET_SEG + x)];
    }
    if (doCall) {
      mem8[SLOT_LOOP_INDEX] = x;
      loc_a38e(m, x, y);
    }
  }

  if (mem8[u16(HIT_TALLY + x)] === 0xff) {
    mem8[u16(SLOT_STATE + x)] = 0;
    mem8[ACTIVE_OBJECT_COUNT] = mem8[ACTIVE_OBJECT_COUNT] - 1;
    mem8[u16(HIT_TALLY + x)] = 0;
  }
}
