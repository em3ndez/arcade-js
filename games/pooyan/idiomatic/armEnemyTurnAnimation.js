// SPDX-License-Identifier: GPL-3.0-only
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { queueSoundCommand02 } from "./queueSoundCommand02.js";
import { ANIM_SEQ_TABLE_4076 } from "./names.js";
/**
 * armEnemyTurnAnimation — enter an enemy record's turn/select animation state.
 *
 * WHAT IT IS
 *   ROM 0x3d99-0x3db2. A one-shot transition applied to a single 0x18-byte actor
 *   record (addressed by `rec`, which defaults to the record cursor the per-frame
 *   sweep leaves in IX). When an enemy reaches the point in its behaviour where it
 *   must turn around / commit to a chosen approach, this routine swaps in the
 *   matching turn animation, primes the record's motion and state fields for that
 *   turn, and cues the accompanying sound effect.
 *
 * ROLE IN THE MACHINE
 *   Enemies march across the arena as records in the stride-0x18 actor array; each
 *   record's +0x02 byte is its position in a per-record state machine that the sweep
 *   dispatches every frame. This is the arming step that pushes a record into its
 *   turn/select state: it is entered from the object movement/dispatch handlers when
 *   an actor hits a turn boundary, and it leaves the record fully set up so that the
 *   next per-frame dispatch runs it as a turning enemy.
 *
 * GROUNDING: [seen] — role confirmed by observed RAM behaviour.
 *
 * LIVE-OUT: none the caller reads. Everything this routine produces is written into
 *   the actor record (its animation pointer, velocity byte and state byte) and into
 *   the sound-command ring. The final step hands control to the sound-enqueue helper,
 *   whose result is discarded, so the routine's whole effect lives in memory.
 */

// --- Actor-record field offsets (all relative to the record base `rec`) --------
// A record packs one actor's per-frame state into 0x18 bytes; every sweep that
// visits it reads these same offsets with these same meanings.
const SELECT_FIELD = 0x07; // record +0x07: facing / animation-variant flag; low 2 bits pick the turn animation (values 1..3)
const SELECT_MASK = 0x03; // keep only bits 0-1 of the variant flag (the animation selector)
const VELOCITY_FIELD = 0x09; //  record +0x09: entry velocity / motion byte
const STATE_FIELD = 0x02; //     record +0x02: state-machine index (masked to 5 bits when dispatched)
const ENTRY_VELOCITY = 0x40; // motion byte the turn state runs with
const ENTRY_STATE = 0x0f; // state index (15) the record is advanced into on turn entry

export function armEnemyTurnAnimation(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Pick which of the three turn animations this record wants.
  // The variant flag at +0x07 carries the selector in its low two bits; the three
  // live turn/select variants are encoded as 1, 2 and 3, so masking off bits 0-1
  // and subtracting one maps them onto table indices 0, 1 and 2. The `& 0xff`
  // keeps the result an 8-bit quantity (a variant of 0 would wrap to 0xff, but the
  // routine is only entered for the 1..3 turn variants).
  const index = ((mem8[rec + SELECT_FIELD] & SELECT_MASK) - 1) & 0xff;

  // Look up the animation-sequence descriptor for that variant.
  // ANIM_SEQ_TABLE_4076 (ROM 0x4076) is a table of little-endian pointers, one per
  // turn variant; fetchWordFromTableIndex returns table[index] — the ROM address of
  // the tile/attribute animation stream this turn should play.
  const animPointer = fetchWordFromTableIndex(m, index, ANIM_SEQ_TABLE_4076);

  // Install the chosen animation on the record and restart it.
  // setActorAnimation stores the descriptor pointer into the record's +0x0c/+0x0d
  // animation-stream cursor and resets its frame progress, so the actor begins the
  // turn animation from its first frame on the next animation tick.
  setActorAnimation(m, rec, animPointer);

  // Prime the record's motion byte for the turn: +0x09 becomes 0x40, the velocity
  // the turn state moves with.
  mem8[rec + VELOCITY_FIELD] = ENTRY_VELOCITY;

  // Advance the record into its turn state: +0x02 becomes 0x0f (state 15), which is
  // the state the per-frame dispatcher will route this record to next frame.
  mem8[rec + STATE_FIELD] = ENTRY_STATE;

  // Cue the turn's sound effect and finish.
  // queueSoundCommand02 pushes the fixed sound command 0x02 into the sound-command
  // ring for the audio CPU. This is the routine's last act — its result is not used.
  return queueSoundCommand02(m); // tail: enqueue the sound command
}
