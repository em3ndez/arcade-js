// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { objectMatchesDrawPhase } from "./objectMatchesDrawPhase.js";
import { loadPlayerShotDescriptor } from "./loadPlayerShotDescriptor.js";
import { eraseShiftedSprite } from "./eraseShiftedSprite.js";
import { drawSpriteWithCollision } from "./drawSpriteWithCollision.js";
import { orBlitShiftedSprite } from "./orBlitShiftedSprite.js";
import { blockCopy } from "./blockCopy.js";
import {
  PLAYER_SHOT_STATUS, PLAYER_SHOT_DESC, PLAYER_SHOT_RETIRE_TIMER, loc_2029, loc_202a, PLAYER_SHOT_ROW_COUNT, PLAYER_SHOT_Y_STEP,
  PLAYER_SHIP_X, COLLISION_FLAG, PLAYER_SHOT_HIT, PLAYER_SHOT_RECORD_TEMPLATE, SAUCER_SCORE_KEY_PTR, SAUCER_DIR_SEQ_PTR,
  SAUCER_ACTIVE, loc_208a, SAUCER_STEP_DX,
} from "./names.js";

/**
 * playerShotHandler -- the object-table handler for the player's shot (record 1 at 0x2020).
 *
 * WHAT IT IS
 *   The per-frame driver for the single player shot. Unlike the other four in-game handlers (each keyed on
 *   one mode cell), this one is a small state machine keyed on the shot's status byte PLAYER_SHOT_STATUS
 *   (0x2025): idle, launching, flying, retiring, and a post-flight tally. It launches a shot, walks a flying
 *   shot up the screen while watching for a collision, runs the short retire animation, and finally reseeds
 *   the shot record so a new shot can be fired.
 *
 * ROLE IN THE MACHINE
 *   Dispatched by the object walker walkObjectTable (keyed by PLAYER_SHOT_HANDLER_ADDR 0x03bb), which passes
 *   the record. It runs only in the raster half matching the object's phase bit, then forks on the status:
 *     - 1 launch:  bump the status to flying, seat the muzzle X from the ship X (PLAYER_SHIP_X + 8), blit.
 *     - 2 flying:  erase, advance Y by the per-frame step (PLAYER_SHOT_Y_STEP into loc_2029), redraw with collision,
 *                  and copy any COLLISION_FLAG (0x2061) into PLAYER_SHOT_HIT (0x2002) for the shot resolver.
 *     - 3 retiring: count the retire timer (PLAYER_SHOT_RETIRE_TIMER) down one frame at a time, stepping the explosion cells.
 *     - 4 / other:  the shared tally doT (via doR) -- reseed the record from the ROM template (PLAYER_SHOT_RECORD_TEMPLATE) and
 *                   step the two saucer-key counters; 5 (the explosion state) is idle here.
 *   Because each redraw follows an erase, the descriptor is reloaded after every erase so the erase and the
 *   redraw land on the same (recomputed) rows.
 *
 * ROM 0x03bb-0x0475 (with the 0x0430 loadPlayerShotDescriptor head spliced in).  Grounding: [seen].
 *
 * LIVE-OUT: memory + video RAM; the walker ignores any register result.
 */
export function playerShotHandler(m) {
  // Status 1 -- launch a fresh shot. Bump the status (1 -> 2 "flying"), seat the shot's coordinate byte
  // to the ship's muzzle (the ship X at PLAYER_SHIP_X, offset +8), load its descriptor, and OR-blit it in.
  function doP() { // launch a new shot
    m.mem8[PLAYER_SHOT_STATUS] = u8(m.mem8[PLAYER_SHOT_STATUS] + 1);
    m.mem8[loc_202a] = u8(m.mem8[PLAYER_SHIP_X] + 8);
    loadPlayerShotDescriptor(m);
    return orBlitShiftedSprite(m);
  }

  // Status 2 -- step a shot already in flight. Erase it at its current position, advance its Y by the
  // per-frame step, redraw with collision detection, and latch any hit into PLAYER_SHOT_HIT so the
  // separate shot resolver (resolvePlayerShotHit) can decide what was struck next pass.
  function doQ() { // step a shot in flight
    loadPlayerShotDescriptor(m);
    eraseShiftedSprite(m);
    const y = u8(m.mem8[PLAYER_SHOT_Y_STEP] + m.mem8[loc_2029]); // advance the shot's Y by its per-frame step
    m.mem8[loc_2029] = y;
    loadPlayerShotDescriptor(m); // re-read the descriptor so the redraw seats the advanced Y
    drawSpriteWithCollision(m, undefined, undefined, y);
    if (m.mem8[COLLISION_FLAG] !== 0) m.mem8[PLAYER_SHOT_HIT] = m.mem8[COLLISION_FLAG];
  }

  // Write the chosen movement pair to the two publish cells (low byte then high byte).
  function doV(cLow, bHigh) { // publish the picked movement pair
    m.mem8[loc_208a] = cLow;
    m.mem8[SAUCER_STEP_DX] = bHigh;
  }

  // The shared end-of-shot tally. Erase the sprite, reload the 7-byte shot record from its ROM template
  // (PLAYER_SHOT_RECORD_TEMPLATE) so a fresh shot can be fired, then advance the two saucer-score-key counters: the key
  // pointer SAUCER_SCORE_KEY_PTR (0x208d) steps its low byte and wraps 0x63 -> 0x54, and the second
  // counter SAUCER_DIR_SEQ_PTR steps its low byte. Finally, only while no saucer is active, pick one of two movement
  // pairs from bit 0 of the byte the SAUCER_DIR_SEQ_PTR pointer now addresses and publish it via doV.
  function doT() { // shared tally: reseed the record and step the saucer-key counters
    loadPlayerShotDescriptor(m);
    eraseShiftedSprite(m);
    blockCopy(m, PLAYER_SHOT_RECORD_TEMPLATE, PLAYER_SHOT_STATUS, 7); // reload the record from its template
    let keyLo = u8(m.mem8[SAUCER_SCORE_KEY_PTR] + 1); // only the counter's low byte moves
    if (keyLo >= 0x63) keyLo = 0x54; // wrap the key back to its low bound
    m.mem8[SAUCER_SCORE_KEY_PTR] = keyLo;
    const ptrLo = u8(m.mem8[SAUCER_DIR_SEQ_PTR] + 1);
    m.mem8[SAUCER_DIR_SEQ_PTR] = ptrLo;
    const ptr = (m.mem8[SAUCER_DIR_SEQ_PTR + 1] << 8) | ptrLo; // the pointer this counter walks
    if (m.mem8[SAUCER_ACTIVE] !== 0) return;
    if ((m.mem8[ptr] & 0x01) !== 0) return doV(0x29, 0x02);
    return doV(0xe0, 0xfe);
  }

  // Any status past the two flight states: the explosion state (5) is idle here; everything else runs the
  // shared reseed tally.
  function doR(type) { // any status past the flight states
    if (type === 5) return;
    return doT();
  }

  // Gate: only service this object in the raster half its phase bit (bit7 of loc_202a) belongs to, so the
  // shot is drawn in just one of the two half-frames and never torn across the beam.
  if (!objectMatchesDrawPhase(m, loc_202a)) return; // wrong raster half for this object
  // Dispatch on the shot status: 0 idle, 1 launch, 2 fly, 3 retire; anything else -> the post-flight tally.
  const type = m.mem8[PLAYER_SHOT_STATUS];
  if (type === 0) return; // idle
  if (type === 1) return doP();
  if (type === 2) return doQ();
  if (type !== 3) return doR(type);
  // Status 3 -- retiring. Count the retire timer down one frame; store it back.
  const count = u8(m.mem8[PLAYER_SHOT_RETIRE_TIMER] - 1);
  m.mem8[PLAYER_SHOT_RETIRE_TIMER] = count;
  // Timer drained -> run the shared reseed tally (the shot is fully gone).
  if (count === 0) return doT();
  // Only the specific frame-trigger 0x0f advances one animation step; every other count idles this frame.
  if (count !== 0x0f) return;
  // retire animation frame: erase, nudge the shot descriptor to the next explosion cell, redraw
  loadPlayerShotDescriptor(m);
  eraseShiftedSprite(m);
  m.mem8[PLAYER_SHOT_DESC] = u8(m.mem8[PLAYER_SHOT_DESC] + 1);
  m.mem8[loc_2029] = u8(m.mem8[loc_2029] - 2);
  m.mem8[loc_202a] = u8(m.mem8[loc_202a] - 3);
  m.mem8[PLAYER_SHOT_ROW_COUNT] = 8;
  loadPlayerShotDescriptor(m);
  return orBlitShiftedSprite(m);
}
