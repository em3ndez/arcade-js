// SPDX-License-Identifier: GPL-3.0-only
import { advanceEnemyActorToDescentStateOnDelay } from "./advanceEnemyActorToDescentStateOnDelay.js";
import { descendEnemyActorAndSeatSpawnSlot } from "./descendEnemyActorAndSeatSpawnSlot.js";
import { ascendEnemyActorAndLinkedSlotOnTimer } from "./ascendEnemyActorAndLinkedSlotOnTimer.js";
import { reinitRoundArenaAndPlayfieldIfImageIntact } from "./reinitRoundArenaAndPlayfieldIfImageIntact.js";
/**
 * dispatchEnemyActorState — per-frame state dispatcher for one enemy-actor record.
 *
 * WHAT IT IS
 *   ROM 0x66f1. Grounding: [seen].
 *
 *   Every enemy on the playfield is a fixed 0x18-byte record living in the enemy-actor
 *   sub-array ENEMY_ACTOR_TABLE (0x8ae0) — slot 4 of the shared actor arena that begins at
 *   ACTOR_TABLE (0x8a80). Each such actor runs its own tiny four-state life-cycle (wait ->
 *   descend -> ascend -> arena/screen re-init), and this routine is the single step that
 *   drives that life-cycle forward by exactly one frame for the one record it is handed.
 *
 * ROLE IN THE MACHINE
 *   The enemy sweep updateEnemyActorsAndCycleLaunchFlipAnim (0x66c5) walks three enemy-actor
 *   records (base IX, stride 0x18) and hands each one to this dispatcher. The record it is
 *   working on is pointed to by IX, so `rec` is the base of a single 0x18-byte enemy record.
 *   The record's own state byte says which phase that enemy is in this frame; this routine's
 *   whole job is to read that byte and run the matching per-frame handler for it.
 *
 *   The hand-off to the chosen handler is a tail hand-off: no continuation is stacked here, so
 *   whichever handler runs returns straight to the sweep that called us, and nothing in this
 *   routine executes after it. The dispatcher itself neither reads a result back nor mutates the
 *   record — it only routes.
 *
 * LIVE-OUT: memory only — the caller's record-scan loop parks its own loop registers across the
 *   call and reads no register or return value back; every effect is whatever the selected
 *   handler leaves in the record and the wider work RAM.
 */
const STATE_OFFSET = 0x02; // the enemy record's state byte: record+2 selects the handler (0..3)

export function dispatchEnemyActorState(m, rec = m.regs.ix) {
  // The machine's flat byte-addressable memory (work RAM at 0x8xxx, video RAM at 0x84xx, etc.);
  // the enemy record and its state field are read through it.
  const { mem8 } = m;

  // Read the record's state byte at record+2 and route on its value. This is the enemy's phase
  // in its own state machine; the four values 0..3 each name a distinct per-frame handler and
  // there are exactly four (values outside 0..3 are never produced for these records, so the
  // switch has no default: an out-of-range byte simply leaves the actor untouched this frame).
  switch (mem8[rec + STATE_OFFSET]) {
    // State 0 — waiting to drop. Runs the actor's shared phase countdown; when the countdown
    // expires it advances the record's phase and its coupled fields (animation frame + tile id),
    // arming the enemy for its descent.
    case 0: return advanceEnemyActorToDescentStateOnDelay(m, rec);
    // State 1 — descending. Steps the animation and advances the 16-bit sub-position downward;
    // when the actor reaches its landing row it seats a matching free spawn-object slot, then
    // bumps the record's state, reloads the step delay (0x18) and re-arms the animation.
    case 1: return descendEnemyActorAndSeatSpawnSlot(m, rec);
    // State 2 — ascending. A per-object frame update gated by the shared frame-delay timer:
    // when the timer allows, it steps the animation, moves the 16-bit position (and the linked
    // slot) back up, and advances the record's state.
    case 2: return ascendEnemyActorAndLinkedSlotOnTimer(m, rec);
    // State 3 — end-of-cycle round/screen re-init, guarded by a colour-map integrity checksum:
    // it arms the round flags, clears the timer block and the actor arena, and paints the
    // playfield square with the blank tile. If the checksum misses (a tampered image), it
    // instead tails into the per-object frame updater rather than re-initialising the board.
    case 3: return reinitRoundArenaAndPlayfieldIfImageIntact(m, rec);
  }
}
