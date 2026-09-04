// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { objectMatchesDrawPhase } from "./objectMatchesDrawPhase.js";
import { loadPlayerShotDescriptor } from "./loadPlayerShotDescriptor.js";
import { eraseShiftedSprite } from "./eraseShiftedSprite.js";
import { drawSpriteWithCollision } from "./drawSpriteWithCollision.js";
import { orBlitShiftedSprite } from "./orBlitShiftedSprite.js";
import { blockCopy } from "./blockCopy.js";
import {
  PLAYER_SHOT_STATUS, PLAYER_SHOT_DESC, loc_2026, loc_2029, loc_202a, loc_202b, loc_202c,
  loc_201b, COLLISION_FLAG, PLAYER_SHOT_HIT, loc_1b25, SAUCER_SCORE_KEY_PTR, loc_208f,
  SAUCER_ACTIVE, loc_208a, loc_208c,
} from "./names.js";

// The player-shot object handler reached by the table walker. Skip unless this raster half matches the
// object's phase, then branch on the shot's status byte: launch a fresh shot, step one in flight (erase,
// advance its Y, redraw with collision and latch any hit), retire an expiring shot one animation frame at
// a time, or -- when the retire countdown reaches its trigger -- run the tally that reseeds the record
// from the template and advances the two saucer-key counters. Each sprite's screen position is re-read
// from its descriptor after every erase, so the erase and the redraw land on the right rows.
export function playerShotHandler(m) {
  function doP() { // launch a new shot
    m.mem8[PLAYER_SHOT_STATUS] = u8(m.mem8[PLAYER_SHOT_STATUS] + 1);
    m.mem8[loc_202a] = u8(m.mem8[loc_201b] + 8);
    loadPlayerShotDescriptor(m);
    return orBlitShiftedSprite(m);
  }

  function doQ() { // step a shot in flight
    loadPlayerShotDescriptor(m);
    eraseShiftedSprite(m);
    const y = u8(m.mem8[loc_202c] + m.mem8[loc_2029]); // advance the shot's Y by its per-frame step
    m.mem8[loc_2029] = y;
    loadPlayerShotDescriptor(m); // re-read the descriptor so the redraw seats the advanced Y
    drawSpriteWithCollision(m, undefined, undefined, y);
    if (m.mem8[COLLISION_FLAG] !== 0) m.mem8[PLAYER_SHOT_HIT] = m.mem8[COLLISION_FLAG];
  }

  function doV(cLow, bHigh) { // publish the picked movement pair
    m.mem8[loc_208a] = cLow;
    m.mem8[loc_208c] = bHigh;
  }

  function doT() { // shared tally: reseed the record and step the saucer-key counters
    loadPlayerShotDescriptor(m);
    eraseShiftedSprite(m);
    blockCopy(m, loc_1b25, PLAYER_SHOT_STATUS, 7); // reload the record from its template
    let keyLo = u8(m.mem8[SAUCER_SCORE_KEY_PTR] + 1); // only the counter's low byte moves
    if (keyLo >= 0x63) keyLo = 0x54; // wrap the key back to its low bound
    m.mem8[SAUCER_SCORE_KEY_PTR] = keyLo;
    const ptrLo = u8(m.mem8[loc_208f] + 1);
    m.mem8[loc_208f] = ptrLo;
    const ptr = (m.mem8[loc_208f + 1] << 8) | ptrLo; // the pointer this counter walks
    if (m.mem8[SAUCER_ACTIVE] !== 0) return;
    if ((m.mem8[ptr] & 0x01) !== 0) return doV(0x29, 0x02);
    return doV(0xe0, 0xfe);
  }

  function doR(type) { // any status past the flight states
    if (type === 5) return;
    return doT();
  }

  if (!objectMatchesDrawPhase(m, loc_202a)) return; // wrong raster half for this object
  const type = m.mem8[PLAYER_SHOT_STATUS];
  if (type === 0) return; // idle
  if (type === 1) return doP();
  if (type === 2) return doQ();
  if (type !== 3) return doR(type);
  const count = u8(m.mem8[loc_2026] - 1);
  m.mem8[loc_2026] = count;
  if (count === 0) return doT();
  if (count !== 0x0f) return;
  // retire animation frame: erase, nudge the shot descriptor to the next explosion cell, redraw
  loadPlayerShotDescriptor(m);
  eraseShiftedSprite(m);
  m.mem8[PLAYER_SHOT_DESC] = u8(m.mem8[PLAYER_SHOT_DESC] + 1);
  m.mem8[loc_2029] = u8(m.mem8[loc_2029] - 2);
  m.mem8[loc_202a] = u8(m.mem8[loc_202a] - 3);
  m.mem8[loc_202b] = 8;
  loadPlayerShotDescriptor(m);
  return orBlitShiftedSprite(m);
}
