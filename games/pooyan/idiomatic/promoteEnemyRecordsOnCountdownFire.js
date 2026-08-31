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
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { rebuildSpriteDisplayList } from "./rebuildSpriteDisplayList.js";
/**
 * promoteEnemyRecordsOnCountdownFire — deferred-object promoter, run when its countdown fires.
 *
 * WHAT IT IS
 *   A once-per-frame worker that watches a small countdown and, on the single frame it
 *   reaches one, "promotes" the enemy records currently on the board into a compact side
 *   list so they can be committed onto the playfield a moment later. It is the *build* half
 *   of a two-step hand-off that stages the second-phase / how-to-play screen: this routine
 *   fills PROMOTED_OBJECT_LIST, and its companion commitPromotedObjectsAndClearHelpScreenOnCountdown
 *   later drains that list back onto the field (writing each saved value six bytes past the
 *   stored record pointer) and wipes the help screen.
 *
 * ROLE IN THE MACHINE
 *   Runs only in the pre-play window: it bails while the in-play gate GAME_ACTIVE_FLAG is
 *   set, so it fires between rounds/at setup rather than during live play. Three guards must
 *   all be clear before anything happens — the in-play gate, the promotion busy latch
 *   PENDING_OBJECT_STATE, and bit 0 of ROUND_COUNTER (a stage-type/facing parity that gates
 *   this variant). Then it reads a countdown: a zero idles, a value above one just ticks down
 *   one and waits, and exactly one is the fire frame. On fire it arms the play-state and the
 *   busy latch (so it fires exactly once until the latch is released), reseeds the countdown,
 *   scans the eleven enemy records, copies each promotable one into the list, queues the
 *   promotion's five paint jobs, and rebuilds the sprite display list.
 *
 * ROM ADDRESS: 0x6b3b (0x6b3b-0x6bb1)
 * Grounding: [seen]
 *
 * LIVE-OUT: memory only —
 *   - PROMOTED_OBJECT_LIST (0x8d80): the freshly built list, three bytes per promoted record
 *     (record pointer low, record pointer high, and the record's saved (+6) field).
 *   - PLAY_STATE_INDEX (0x880a) and PENDING_OBJECT_STATE (0x8d5f): both set to 0x11 on fire,
 *     the latter also serving as the busy latch that blocks a re-fire.
 *   - PENDING_OBJECT_COUNTDOWN (0x8d5e): reseeded to 0xff on fire (or decremented while >1).
 *   - The (+6) field of every promoted enemy record: cleared to 0 after being saved off.
 *   - The display-command ring and the rebuilt sprite display list (the tail).
 *   The early exits leave a gate byte in A that no caller consumes.
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

export function promoteEnemyRecordsOnCountdownFire(m) {
  const { mem8 } = m;

  // Three gates, all of which must be clear before the promoter does any work.
  //   - GAME_ACTIVE_FLAG (0x8806): the in-play gate. It is set while a life is being played,
  //     so a nonzero value means we are in live play and this pre-play promoter must stand down.
  //   - PENDING_OBJECT_STATE (0x8d5f): the promotion busy latch. A fire arms it to 0x11, so a
  //     nonzero value means a promotion is already in flight and this frame must bail — this is
  //     what makes the fire happen exactly once until the latch is released.
  //   - ROUND_COUNTER (0x8907) bit 0: the stage-type/facing parity. This promotion variant runs
  //     only when that low bit is clear.
  if (mem8[GAME_ACTIVE_FLAG] !== 0) return;
  if (mem8[PENDING_OBJECT_STATE] !== 0) return;
  if ((mem8[ROUND_COUNTER] & 0x01) !== 0) return;

  // Read the promotion countdown at PENDING_OBJECT_COUNTDOWN (0x8d5e) and branch on it:
  //   - 0  -> idle: nothing pending, return.
  //   - >1 -> not yet: tick it down by one and return, waiting for a later frame.
  //   - 1  -> fire this frame (fall through below).
  const countdown = mem8[PENDING_OBJECT_COUNTDOWN];
  if (countdown === 0) return;
  if (countdown !== 1) {
    mem8[PENDING_OBJECT_COUNTDOWN] = countdown - 1;
    return;
  }

  // Fire: arm the state cells.
  //   PLAY_STATE_INDEX (0x880a) and PENDING_OBJECT_STATE (0x8d5f) both take 0x11 — advancing the
  //   in-play sub-state and, at the same time, raising the busy latch that the second gate above
  //   tests, so no further frame re-enters the fire path until that latch is cleared elsewhere.
  //   PENDING_OBJECT_COUNTDOWN (0x8d5e) is reseeded to 0xff so it will not immediately re-fire.
  mem8[PLAY_STATE_INDEX] = FIRE_STATE;
  mem8[PENDING_OBJECT_STATE] = FIRE_STATE;
  mem8[PENDING_OBJECT_COUNTDOWN] = COUNTDOWN_RELOAD;

  // Scan the enemy records; promote each in-range block into the list.
  //   Walk the eleven enemy records of ENEMY_ACTOR_TABLE (0x8ae0) at the 0x18 record stride, and
  //   build PROMOTED_OBJECT_LIST (0x8d80) as a packed run of three-byte entries. A record qualifies
  //   when its type/state byte at rec+4, masked to five bits, lands in the half-open window
  //   [0x06, 0x1a): types below the low bound (empty/idle records) and at or above the high bound
  //   are skipped. `rec` marches the source pointer; `list` marches the destination and only
  //   advances when an entry is actually written, so the list stays gap-free.
  let rec = ENEMY_ACTOR_TABLE;
  let list = PROMOTED_OBJECT_LIST;
  for (let i = 0; i < ENEMY_BLOCK_COUNT; i++) {
    const type = mem8[rec + REC_TYPE] & TYPE_MASK;
    if (type >= TYPE_MIN && type < TYPE_MAX) {
      // Save the record's own little-endian address plus its rec+6 field into the entry, then
      // clear rec+6 in the live record. The companion committer later reads this entry back,
      // using the stored pointer to write the saved value six bytes past the record.
      mem8[list] = rec; // record pointer, low byte
      mem8[list + 1] = rec >> 8; // record pointer, high byte
      mem8[list + 2] = mem8[rec + REC_SAVED];
      mem8[rec + REC_SAVED] = 0x00;
      list = u16(list + LIST_STRIDE);
    }
    rec = u16(rec + RECORD_STRIDE);
  }

  // Queue the promotion's five display commands, then rebuild the sprite list.
  //   Push the five type-0x06 display-command words (0x062b..0x062f) onto the display-command ring
  //   so the promotion's paint jobs run on a later pass, then rebuild the sprite display list as
  //   the tail so the newly promoted objects are reflected on screen this frame.
  enqueueDisplayCommand(m, PROMOTE_DISPLAY_CMD_A);
  enqueueDisplayCommand(m, PROMOTE_DISPLAY_CMD_B);
  enqueueDisplayCommand(m, PROMOTE_DISPLAY_CMD_C);
  enqueueDisplayCommand(m, PROMOTE_DISPLAY_CMD_D);
  enqueueDisplayCommand(m, PROMOTE_DISPLAY_CMD_E);
  return rebuildSpriteDisplayList(m);
}
