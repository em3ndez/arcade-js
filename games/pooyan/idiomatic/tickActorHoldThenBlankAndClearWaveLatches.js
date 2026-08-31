// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { LANE_SPAWN_COUNTDOWN, LAUNCH_ARM_LATCH, loc_8d76 } from "./names.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";
/**
 * tickActorHoldThenBlankAndClearWaveLatches — actor frame-hold tick.
 *
 * WHAT IT IS
 *   ROM 0x3536-0x3552 (falls straight through into the sprite-band blank at 0x3553).
 *   Grounding: [seen].
 *
 *   One of the per-record state handlers for an enemy/object actor. Every moving thing the game
 *   draws lives as a fixed-stride "actor record" in work RAM, and each record carries a state
 *   index that selects which handler runs it this frame. This is the handler for the "holding"
 *   state: the actor is sitting on a single animation frame, waiting out a countdown before it is
 *   taken off screen. Each tick advances the actor's animation and spends one frame of the hold;
 *   while the hold is still running the current picture stays put. Once the hold lapses the actor
 *   is erased — and, for a specially flagged actor, the same lapse also winds down the wave's
 *   spawn/launch machinery so the wave can end.
 *
 * ROLE IN THE MACHINE
 *   Reached from the enemy-actor record state dispatch when a record is parked in its hold state.
 *   For most records it is just a frame-timer that eventually blanks the sprite. But a record
 *   whose flag byte carries a set high nibble is the marker for the tail of a spawn wave: each of
 *   its hold-lapses ticks a shared tally, and the third such lapse clears the two latches that keep
 *   the wave's spawner alive — the lane-spawn pacer and the arrow/rope launch arm — which is what
 *   lets the next wave arm. So this routine doubles as one of the end-of-wave cleanup paths.
 *
 * LIVE-OUT: none consumed by the caller — the record-walk that invokes this tick keeps its own
 *   loop registers and reads nothing back from here. Every effect lands in memory: the record's
 *   decremented hold field; for a flagged actor at its third lapse, the two cleared wave latches;
 *   and, on every non-holding exit, the blanked sprite band.
 */

// rec+0x11: this handler's own frame-hold countdown, separate from the +0x0e picture-hold that the
// animation sequencer runs. It measures how many more frames the actor stays parked in the hold
// state before it is blanked.
const HOLD_FIELD = 0x11; // frame-hold countdown field in the record
// rec+0x07: the actor record's flag/band-kind byte. Only when its high nibble is set does this
// record take part in the wave-latch bookkeeping below (it marks the wave-tail actor); a plain
// actor with a clear high nibble just holds and then blanks.
const FLAG_FIELD = 0x07; // record flag byte; its high nibble gates the tally bump
const HIGH_NIBBLE = 0xf0;
// The shared tally at 0x8d76 is compared against this: once three flagged hold-lapses have
// accumulated, the wave's lane-spawn pacer and launch-arm latch are cleared together.
const TALLY_RESET_AT = 0x03; // tally value at which the lane/launch latches clear

export function tickActorHoldThenBlankAndClearWaveLatches(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Step the record's animation program by one frame: the shared sequencer at ROM 0x4006 counts
  // down the picture-hold at rec+0x0e and, when it expires, pulls the next {tile, attribute, hold}
  // entry from this record's animation script. The actor keeps animating for as long as it holds.
  advanceObjectAnimationFrame(m, rec); // advance the record's animation
  // Spend one frame of this handler's own hold countdown (rec+0x11). Byte arithmetic wraps, so a
  // hold already sitting at 0 rolls to 0xff and keeps the actor holding rather than falling through.
  mem8[rec + HOLD_FIELD] = u8(mem8[rec + HOLD_FIELD] - 1);
  // Still counting down: the actor stays parked on its current frame this tick and nothing is
  // erased. Only a hold that reaches exactly zero proceeds to the teardown below.
  if (mem8[rec + HOLD_FIELD] !== 0) return; // still holding this frame

  // Hold has lapsed. A record whose flag byte (rec+0x07) has any high-nibble bit set is the marker
  // for the tail of a spawn wave; only that record drives the wave-latch bookkeeping.
  if ((mem8[rec + FLAG_FIELD] & HIGH_NIBBLE) !== 0) {
    // Bump the shared wave-tail tally at 0x8d76 (the cell that sits one byte above the lane-spawn
    // countdown 0x8d75). It accumulates hold-lapses of the flagged wave-tail actor.
    mem8[loc_8d76] = u8(mem8[loc_8d76] + 1);
    // On the third accumulated lapse, close the wave out by clearing both latches that keep its
    // spawner alive:
    if (mem8[loc_8d76] >= TALLY_RESET_AT) {
      // LANE_SPAWN_COUNTDOWN (0x8d75): the wave's spawn pacer, counted down from the lane count
      // while a lane-spawn sequence runs and, being nonzero, suppressing enemy fire. Zeroing it
      // ends the lane-spawn sequence.
      mem8[LANE_SPAWN_COUNTDOWN] = 0x00;
      // LAUNCH_ARM_LATCH (0x8f20): the arrow/rope launch arm latch, whose nonzero value blocks the
      // launch flag from re-arming. Clearing it (in lockstep with the lane countdown) frees the
      // next wave to arm its launch.
      mem8[LAUNCH_ARM_LATCH] = 0x00;
    }
  }
  // Every non-holding exit ends by erasing the actor: blank its sprite band (ROM 0x3553) so the
  // hardware sprite stops being drawn from the next frame on.
  return blankActorSpriteBand(m, rec); // blank the actor's sprite band
}
