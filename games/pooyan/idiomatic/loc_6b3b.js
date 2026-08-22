// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  GAME_ACTIVE_FLAG,
  ROUND_COUNTER,
  PLAY_STATE_INDEX,
  ENEMY_ACTOR_TABLE,
  PENDING_OBJECT_STATE,
  PENDING_OBJECT_COUNTDOWN,
  PROMOTED_OBJECT_LIST,
  PROMOTE_DISPLAY_CMD_A,
  PROMOTE_DISPLAY_CMD_B,
  PROMOTE_DISPLAY_CMD_C,
  PROMOTE_DISPLAY_CMD_D,
  PROMOTE_DISPLAY_CMD_E,
} from "./names.js";
import { loc_0038 } from "./loc_0038.js";
import { loc_02ef } from "./loc_02ef.js";
/**
 * loc_6b3b — deferred-object promoter, run when its countdown fires.
 *
 * Bails unless the game-idle gate, the busy latch, and the round counter's low bit are all
 * clear. It then reads a countdown: zero idles, above one decrements and returns, exactly one
 * fires. Firing arms the busy state, reseeds the countdown, and scans the eleven enemy records:
 * each whose type nibble sits in range has its pointer and one field copied into the promoted
 * list (three bytes per entry) and that field cleared. It then queues five display commands and
 * rebuilds the sprite list.
 *
 * LIVE-OUT: memory only — the promoted list, the state cells, the command ring, and the rebuilt
 * sprite list (the tail). The early exits leave a gate byte in A that no caller consumes.
 */

const RECORD_STRIDE = 0x18; // pitch between enemy records
const ENEMY_BLOCK_COUNT = 0x0b; // records scanned
const FIRE_STATE = 0x11; // armed into the play-state and busy latch on fire
const COUNTDOWN_RELOAD = 0xff; // countdown reseed on fire
const TYPE_MIN = 0x06; // inclusive low bound of the promoted type range
const TYPE_MAX = 0x1a; // exclusive high bound
const TYPE_MASK = 0x1f; // record type-nibble mask
const REC_TYPE = 0x04; // rec+4: type/state byte
const REC_SAVED = 0x06; // rec+6: field copied into the list, then cleared
const LIST_STRIDE = 0x03; // bytes per promoted-list entry

export function loc_6b3b(m) {
  const { mem8 } = m;

  if (mem8[GAME_ACTIVE_FLAG] !== 0) return;
  if (mem8[PENDING_OBJECT_STATE] !== 0) return;
  if ((mem8[ROUND_COUNTER] & 0x01) !== 0) return;

  const countdown = mem8[PENDING_OBJECT_COUNTDOWN];
  if (countdown === 0) return;
  if (countdown !== 1) {
    mem8[PENDING_OBJECT_COUNTDOWN] = countdown - 1;
    return;
  }

  // Fire: arm the state cells.
  mem8[PLAY_STATE_INDEX] = FIRE_STATE;
  mem8[PENDING_OBJECT_STATE] = FIRE_STATE;
  mem8[PENDING_OBJECT_COUNTDOWN] = COUNTDOWN_RELOAD;

  // Scan the enemy records; promote each in-range block into the list.
  let rec = ENEMY_ACTOR_TABLE;
  let list = PROMOTED_OBJECT_LIST;
  for (let i = 0; i < ENEMY_BLOCK_COUNT; i++) {
    const type = mem8[rec + REC_TYPE] & TYPE_MASK;
    if (type >= TYPE_MIN && type < TYPE_MAX) {
      mem8[list] = rec; // record pointer, low byte
      mem8[list + 1] = rec >> 8; // record pointer, high byte
      mem8[list + 2] = mem8[rec + REC_SAVED];
      mem8[rec + REC_SAVED] = 0x00;
      list = u16(list + LIST_STRIDE);
    }
    rec = u16(rec + RECORD_STRIDE);
  }

  // Queue the promotion's five display commands, then rebuild the sprite list.
  loc_0038(m, PROMOTE_DISPLAY_CMD_A);
  loc_0038(m, PROMOTE_DISPLAY_CMD_B);
  loc_0038(m, PROMOTE_DISPLAY_CMD_C);
  loc_0038(m, PROMOTE_DISPLAY_CMD_D);
  loc_0038(m, PROMOTE_DISPLAY_CMD_E);
  return loc_02ef(m);
}
