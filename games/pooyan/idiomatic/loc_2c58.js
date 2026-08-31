// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { advanceRecordStateAndSeedMoveScript } from "./advanceRecordStateAndSeedMoveScript.js";
import { queueSoundCommand12 } from "./queueSoundCommand12.js";
import { ENEMY_ACTOR_TABLE } from "./names.js";
/**
 * loc_2c58 — hunter attacker, "climb to the launch row" state (record state 0x11).
 *
 * WHAT IT IS
 *   A run of "hunter" attackers is seeded into the enemy actor pool as a group. Each hunter is one
 *   0x18-byte record, and every frame the hunter sweep dispatches the record on its state index
 *   (rec+0x02, masked to 0x1f). The four dispatched states are 0x11..0x14; this is the handler for
 *   state 0x11 — dispatch index 0 — the first state a freshly-seeded hunter sits in. In it the
 *   hunter has no move script yet: it simply drifts along its vertical axis at a fixed per-frame
 *   step until the whole group has risen to the top row, at which point the group graduates to its
 *   scripted flight all at once.
 *
 * ROLE IN THE MACHINE
 *   The gate between "seeded, gathering" and "flying its script". While the hunter's 16-bit
 *   vertical position stays below the top row this handler keeps nudging it upward and reports the
 *   normal (keep-sweeping) result. The frame a hunter's position finally crosses the top-row
 *   threshold, this handler stops being a per-record step and becomes a group event: it walks the
 *   entire hunter record span and promotes every record still waiting in state 0x11 into the
 *   move-script state (0x12), arming each with its animation and script cursor, then plays the
 *   arrival sound. So the last climber to reach the top pulls the whole formation into flight
 *   together on that single frame.
 *
 *   This handler is also reached as a guard: the actor state-2 handler
 *   (advanceActorState2AndCapWaveArrival) tail-jumps here on a field-integrity mismatch and
 *   forwards this routine's boolean unchanged.
 *
 * ROM 0x2c58-0x2c84.
 * GROUNDING: this state-0 handler carries no cert entry in the name registry (it is still a
 *   loc_ dispatch-table handler); its grounding is not yet recorded there. The records it touches
 *   are the [seen] ENEMY_ACTOR_TABLE, and the helpers it invokes are separately registered.
 *
 * LIVE-OUT: the boolean return is the whole contract — a caller-skip flag. true = still climbing,
 *   so the per-frame hunter sweep keeps visiting the remaining records; false = reached-top, which
 *   aborts the rest of this frame's sweep (the group has just been re-armed en masse, so the
 *   remaining records are not visited again this frame). Every other effect is memory; no register
 *   survives as a consumed output.
 */

// ---------------------------------------------------------------------------
// Actor-record field offsets and the group geometry this handler works with.
//
// A hunter lives in one fixed-layout record. This state reads its 16-bit
// vertical position (low/high) and the per-frame step it climbs by, and compares
// the high byte against the top-row threshold. RECORD_STRIDE / HUNTER_RECORD_COUNT
// describe the record array it sweeps once the top row is reached.
// ---------------------------------------------------------------------------
const POS_LO = 0x05; //   16-bit vertical position, low byte (rec+0x05)
const POS_HI = 0x06; //   16-bit vertical position, high byte (rec+0x06)
const POS_STEP = 0x09; //  per-frame climb step added to the position each tick (rec+0x09)
const TOP_ROW = 0x12; //  high byte at/above which the hunter has reached the top row
const RECORD_STRIDE = 0x18; // byte stride between consecutive records in the pool
const HUNTER_RECORD_COUNT = 0x11; // number of hunter records swept when the top row is reached (17)

export function loc_2c58(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // STEP THE ANIMATION — advance this record's on-screen animation by one frame first, independent
  // of any movement: the object animation sequencer walks the record's own tile/attribute stream
  // (rec+0x0c..0x10) and reseeds its frame-hold, so the climbing hunter keeps cycling its picture.
  advanceObjectAnimationFrame(m, rec); // step this record's animation frame

  // ADVANCE THE VERTICAL POSITION — add the per-frame step (rec+0x09) onto the position low byte
  // (rec+0x05). The position is 16-bit little-endian across rec+0x05/0x06, and the low byte is an
  // 8-bit cell, so an overflow past 0xff carries up into the high byte (rec+0x06). The full sum is
  // then written back to the low byte (stored into an 8-bit cell, it keeps only its low 8 bits).
  let low = mem8[rec + POS_LO] + mem8[rec + POS_STEP];
  if (low > 0xff) mem8[rec + POS_HI] = mem8[rec + POS_HI] + 1; // carry into the high byte
  mem8[rec + POS_LO] = low;

  // STILL CLIMBING? — compare the position high byte against the top-row threshold. While it sits
  // below TOP_ROW (0x12) the hunter has not yet reached the top, so report the normal result and
  // let the sweep move on to the next record. This is the common per-frame path.
  if (mem8[rec + POS_HI] < TOP_ROW) return true; // still climbing

  // REACHED THE TOP — the moment a climber crosses the top row it graduates the whole group. Walk
  // the hunter record span from the base of ENEMY_ACTOR_TABLE (0x8ae0), stride RECORD_STRIDE
  // (0x18), and run the per-record promotion on each: any record still parked in the climb state
  // (0x11) is advanced to the move-script state (0x12), armed with its animation, and given a fresh
  // script cursor. Records not in the climb state are passed over untouched, so this blind sweep
  // only affects the hunters that were still gathering.
  let sweep = ENEMY_ACTOR_TABLE;
  for (let i = 0; i < HUNTER_RECORD_COUNT; i++) {
    advanceRecordStateAndSeedMoveScript(m, sweep);
    sweep += RECORD_STRIDE;
  }

  // ARRIVAL SOUND — hand the fixed sound-command code 0x12 to the sound-command ring; a later
  // once-per-frame drain forwards it to the audio processor. This is the cue that marks the whole
  // formation reaching the top and beginning its flight.
  queueSoundCommand12(m); // queue the arrival sound

  // CALLER-SKIP — report the reached-top result. Because the group was just re-armed en masse, the
  // per-frame hunter sweep is aborted here: the records after this one are not visited again this
  // frame (a guard caller that tail-jumped in forwards this same boolean).
  return false; // caller-skip: abort the dispatch loop
}
