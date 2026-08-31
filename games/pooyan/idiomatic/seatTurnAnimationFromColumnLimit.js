// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { armInteriorBandOrMarkActorActive } from "./armInteriorBandOrMarkActorActive.js";
import { setActorAnimation } from "./setActorAnimation.js";
import {
  SPAWN_PHASE_SNAPSHOT,
  TURN_COLUMN_LIMIT,
  ANIM_TABLE_3418,
  ANIM_TABLE_3829,
  ANIM_TABLE_3838,
} from "./names.js";
/**
 * seatTurnAnimationFromColumnLimit — the shared turn-select tail of the enemy-actor state machine.
 *
 * WHAT IT IS
 *   An enemy actor (an eagle, or a rope-borne object) that is walking horizontally across the
 *   playfield eventually has to decide, each frame, whether it should keep marching in a straight
 *   line or begin turning around. This routine is the tail that makes that decision and seats the
 *   matching walk/turn animation. Two callers reach it: the state-0 handler
 *   advanceEnemyState0AndArmFlapReset falls straight through into this code, and it is also entered
 *   as a call target from that same handler — hence "shared tail". Either way the actor being
 *   worked on is the record pointed at by `rec` (the machine keeps that pointer in IX).
 *
 * ROLE IN THE MACHINE
 *   The turn decision hinges on a per-round "turn-column limit": the tile column at which a moving
 *   object is expected to start its turn animation. This routine first (re)derives that limit from
 *   the current spawn phase, latches it into shared RAM, and then compares it against the actor's
 *   own target column to pick one of three outcomes:
 *     - limit ABOVE target : the actor still has ground to cover -> seat walk frame 0 and the
 *                            straight-run animation table.
 *     - limit BELOW target : the actor is past where it should turn -> seat frame 1 and the
 *                            turn-around animation table.
 *     - limit EQUAL target : right at the turn column; resolve on the actor's aim vs its
 *                            sub-position. If the aim still trails the sub-position, seat the aim
 *                            as the frame with the turn-around table; otherwise the aim has caught
 *                            up, so this routine defers (see below) and leaves the frame untouched.
 *   Every branch that actually commits a decision writes the chosen frame into the record and
 *   restarts the animation from it.
 *
 * ROM: 0x33ca-0x33f4 (a second entry point sharing the state-0 handler's tail).
 * Grounding: [seen]
 *
 * LIVE-OUT: none — this routine communicates only through memory (the latched turn-column limit,
 * the record's frame field, and whatever the animation start seats into the record). The caller
 * that dispatches actor records reloads A afterward and reads back no register from here.
 */
// Record-relative field offsets (the record base is `rec`). Named so the branch logic reads as the
// machine's own fields rather than raw displacements.
const OFF_SUBPOS = 0x05; //     sub-position within the tile column; the aim is gated against it on the equal arm
const OFF_TARGET_COL = 0x06; // the actor's target column, compared against the fetched turn-column limit
const OFF_FRAME = 0x08; //      animation frame index; written by every branch that does not defer
const OFF_AIM = 0x09; //        the actor's aim; compared against the sub-position on the equal arm
// The spawn-phase snapshot is a full byte, but only its low nibble indexes the limit table.
const PHASE_MASK = 0x0f;

export function seatTurnAnimationFromColumnLimit(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // STEP 1 — derive the fresh turn-column limit from the current spawn phase.
  // SPAWN_PHASE_SNAPSHOT (0x8d43) is the work-RAM copy of the per-round spawn-phase counter. Its
  // low nibble selects a row of the rst-0x20 byte table at ANIM_TABLE_3418 (ROM 0x3418), which maps
  // each phase to the tile column at which objects should begin turning this round.
  const index = mem8[SPAWN_PHASE_SNAPSHOT] & PHASE_MASK;
  const [limit] = fetchByteFromTableIndex(m, ANIM_TABLE_3418, index); // rst-0x20 byte-table lookup: HL(=0x3418)+=index, then read the byte there
  // Publish the fetched limit into TURN_COLUMN_LIMIT (0x8d4b), the shared threshold the movement
  // routines all read when deciding whether an object has reached its turn column.
  mem8[TURN_COLUMN_LIMIT] = limit;

  // STEP 2 — read the actor's own target column (rec+0x06) and set up the frame/table selection.
  const targetColumn = mem8[u16(rec + OFF_TARGET_COL)];
  let frame, animTable;

  // STEP 3 — branch on the freshly latched limit against this actor's target column.
  if (limit === targetColumn) {
    // EQUAL: the actor is sitting exactly on its turn column. Break the tie on progress-within-tile:
    // read the aim (rec+0x09) and compare it against the sub-position (rec+0x05).
    const aim = mem8[u16(rec + OFF_AIM)];
    if (aim < mem8[u16(rec + OFF_SUBPOS)]) {
      // Aim still trails the sub-position: seat the aim itself as the animation frame and select
      // the turn-around table (ANIM_TABLE_3838, ROM 0x3838).
      frame = aim;
      animTable = ANIM_TABLE_3838;
    } else {
      // Aim has caught up to the sub-position: nothing to turn yet. Hand off to
      // armInteriorBandOrMarkActorActive (the interior-entry arm) and leave the frame field alone.
      return armInteriorBandOrMarkActorActive(m, rec); // aim caught up -> defer, frame untouched
    }
  } else if (limit > targetColumn) {
    // LIMIT ABOVE TARGET: the turn column is still ahead of the actor, so keep it walking straight.
    // Seat walk frame 0 and the straight-run animation table (ANIM_TABLE_3829, ROM 0x3829).
    frame = 0x00;
    animTable = ANIM_TABLE_3829;
  } else {
    // LIMIT BELOW TARGET: the actor is past its turn column. Seat frame 1 and the turn-around
    // animation table (ANIM_TABLE_3838, ROM 0x3838).
    frame = 0x01;
    animTable = ANIM_TABLE_3838;
  }

  // STEP 4 — commit the decision: write the chosen frame into the record (rec+0x08) and point the
  // record at the selected animation table, restarting the sequence from that frame.
  mem8[u16(rec + OFF_FRAME)] = frame;
  return setActorAnimation(m, rec, animTable);
}
