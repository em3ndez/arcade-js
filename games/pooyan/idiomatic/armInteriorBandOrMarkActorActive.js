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
 * armInteriorBandOrMarkActorActive — INTERIOR-ENTRY ARM for the shared enemy-movement tail.
 *
 * WHAT IT IS
 *   One of several entry points into the animation-arming + despawn/movement machinery that every
 *   moving enemy actor funnels through each frame. An "actor record" is a per-enemy block of state
 *   in work RAM; here it is addressed by `rec` (the IX index register in the original), and the byte
 *   at rec+0x01 is that record's active/state byte. This routine is reached mid-flow: the column
 *   movement handlers (advanceObjectColumnByStepAndDispatch, advanceActorColumnAndArmTurnOrBand),
 *   the state-1 dispatch prologue (dispatchActorState1MovementByMode), and the turn-select tail
 *   (seatTurnAnimationFromColumnLimit) all vector into it when an actor reaches the point where its
 *   on-screen "interior" sprite band must be (re)built before it walks on.
 *
 * ROLE IN THE MACHINE
 *   A one-shot latch, ANIM_ARMED_LATCH, records whether the interior sprite band has already been
 *   built this cycle. This routine gates on that latch two ways:
 *     - Latch already set  -> the band exists; just mark this record active (rec+0x01 = 1) and leave.
 *     - Latch clear        -> build the band: clear the record byte, advance the capped animation
 *                             phase, use the new phase to seed the turn-column limit, stamp the 2x2
 *                             interior tile band into video RAM, raise the latch, then fall into the
 *                             shared despawn/movement tail. If the phase has already reached its cap
 *                             the band step is skipped and control goes straight to the tail.
 *   The turn-column limit it seeds is the tile column at which a moving object later begins its
 *   turn-around animation; the movement handlers compare an actor's column against it.
 *
 * ROM: 0x3473-0x34af.  Grounding: [seen].
 *
 * LIVE-OUT (memory only):
 *   - rec+0x01 (actor record active/state byte): 1 on the already-armed path, 0 on the arming path.
 *   - SPAWN_PHASE_SNAPSHOT (0x8d43): bumped by one while below the step cap.
 *   - TURN_COLUMN_LIMIT   (0x8d4b): reseeded from the phase-indexed row table (arming path only).
 *   - SPRITE_BAND_86E3    (0x86e3): four video-RAM tiles written (arming path only).
 *   - ANIM_ARMED_LATCH    (0x8f63): raised to 1 (arming path only).
 *   Every exit either returns bare after a single record write or ends inside the render-only
 *   despawn tail; no result register is read back by the caller.
 */

const REC_ACTIVE_FLAG = 0x01; // record byte written 1 (armed) / 0 (clearing before the phase step)
const PHASE_CAP = 0x07; //      phase at/above which we skip straight to the tail
const PHASE_STEP_CAP = 0x0a; //  phase below which the phase counter is stepped up
const ROW_STRIDE = 0x20; //     tilemap row pitch (32 tiles) between the band's two rows
const BAND_TL = 0xd8; // band tiles, row-major from the base: top-left / top-right ...
const BAND_TR = 0xd9;
const BAND_BL = 0xda;
const BAND_BR = 0xdb;

export function armInteriorBandOrMarkActorActive(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // --- Gate on the anim-armed latch (ROM 0x3473-0x347e) ---------------------------------------
  // ANIM_ARMED_LATCH (0x8f63) is the one-shot "interior sprite band already built" flag. When it is
  // already set there is nothing to build: just stamp this actor record as active and return. The
  // record's active/state byte lives at rec+0x01.
  if (mem8[ANIM_ARMED_LATCH] !== 0) {
    mem8[u16(rec + 0x01)] = REC_ACTIVE_FLAG; // already armed: just mark active
    return;
  }

  // --- Arming path: begin building the band (ROM 0x347f-0x3489) --------------------------------
  // The latch is clear here, so this actor is the one that (re)builds the band. Start by clearing the
  // record's active/state byte, then read the working spawn-phase snapshot SPAWN_PHASE_SNAPSHOT
  // (0x8d43). Once the phase has reached its cap (0x07) the band is left as-is and control drops
  // straight into the shared despawn/movement tail.
  mem8[u16(rec + 0x01)] = 0x00;
  const phase = mem8[SPAWN_PHASE_SNAPSHOT];
  if (phase >= PHASE_CAP) return despawnActorAndRenderStageCountdown(m, rec); // capped: straight to the shared tail

  // --- Step the capped animation phase (ROM 0x348b-0x3490) -------------------------------------
  // Below the higher step cap (0x0a) the phase snapshot is advanced by one, so successive band
  // builds walk through the animation frames. At/above the step cap the phase is held (the counter
  // saturates) and only the table lookup below runs against the current value.
  if (phase < PHASE_STEP_CAP) {
    mem8[SPAWN_PHASE_SNAPSHOT] = mem8[SPAWN_PHASE_SNAPSHOT] + 1;
  }

  // --- Seed the turn-column limit from the phase-indexed row table (ROM 0x3491-0x3498) ---------
  // The (possibly bumped) phase indexes the byte table at ANIM_TABLE_3418 (0x3418) via the shared
  // indexed-byte lookup, and the fetched byte becomes the new TURN_COLUMN_LIMIT (0x8d4b): the tile
  // column at which this moving object will later start its turn-around animation.
  const [limit] = fetchByteFromTableIndex(m, ANIM_TABLE_3418, mem8[SPAWN_PHASE_SNAPSHOT]); // row-table lookup
  mem8[TURN_COLUMN_LIMIT] = limit;

  // --- Stamp the 2x2 interior sprite band into video RAM (ROM 0x349b-0x34ab) -------------------
  // Draw the actor's interior tile block at SPRITE_BAND_86E3 (0x86e3): the top row is tiles
  // 0xd8/0xd9 at base+0/+1, and the bottom row is tiles 0xda/0xdb one tilemap row down
  // (base+0x20/+0x21). The tilemap is 32 tiles wide, so ROW_STRIDE (0x20) is the pitch to the row
  // below.
  // Stamp the 2x2 interior sprite band: two tiles at the base, two more one row down.
  mem8[SPRITE_BAND_86E3] = BAND_TL;
  mem8[u16(SPRITE_BAND_86E3 + 0x01)] = BAND_TR;
  mem8[u16(SPRITE_BAND_86E3 + ROW_STRIDE)] = BAND_BL;
  mem8[u16(SPRITE_BAND_86E3 + ROW_STRIDE + 0x01)] = BAND_BR;

  // --- Raise the latch and fall into the shared tail (ROM 0x34ad-0x34b0) -----------------------
  // Mark the band built by raising ANIM_ARMED_LATCH (0x8f63) so later actors this cycle take the
  // "just mark active" branch above, then continue into the shared despawn/movement tail, which
  // handles the actor's walk/despawn bookkeeping and repaints the stage-countdown HUD digits.
  mem8[ANIM_ARMED_LATCH] = REC_ACTIVE_FLAG; // raise the anim-armed latch
  return despawnActorAndRenderStageCountdown(m, rec); // fall into the shared despawn/movement tail
}
