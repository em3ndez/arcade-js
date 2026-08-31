// SPDX-License-Identifier: GPL-3.0-only
import { seedFourRecordsAndCopyDisplayTiles } from "./seedFourRecordsAndCopyDisplayTiles.js";
import { TAMPER_STRIKES_STATE10, SHAPE_TABLE_26C1 } from "./names.js";
/**
 * dropLeadActorAfterDelay — the lead actor's state-1 handler.  ROM 0x2473-0x2496.  Grounding: [seen].
 *
 * WHAT IT IS
 *   Every moving thing on screen owns one fixed-width (0x18-byte) record in the actor arena based at
 *   ACTOR_TABLE (0x8a80); slot 0 is the player / lead actor.  Each record carries a small state machine:
 *   the byte at +0x02 is the record's state index, and the per-record dispatcher routes it through a jump
 *   table to the handler for that state.  This routine is the handler for state 1.  It runs once per
 *   frame while the lead actor sits in state 1 and paces a single animated step of the actor's descent by
 *   counting down a frame-delay field before committing the step.
 *
 * ROLE IN THE MACHINE
 *   The lead actor's opening animation is a short chain of timed states.  In this one the actor holds its
 *   current frame for a fixed number of frames, then — in one burst — advances to the next state, drops
 *   its vertical position by a fixed step, and repaints its on-screen shape.  The frame-delay field at
 *   +0x11 is the pacing timer the lead-actor handlers share; this handler ticks it down and only acts on
 *   the frame it reaches zero, so the transition happens once rather than every frame.
 *
 * LIVE-OUT (expiry path, inherited from the shape loader)
 *   IX past the copied run, B = 0, HL = the board-clear flag, A = 0.  The early frame-delay return
 *   (the timer has not yet reached zero) leaves the registers untouched — only the +0x11 field changed.
 */
const DELAY_RESEED = 0x10; // frames the delay timer is reloaded to once it expires, pacing the next transition
const BASE_Y_STEP = 0x10; // amount the actor's base Y (+0x04) advances — moves the actor down the screen one step

export function dropLeadActorAfterDelay(m, rec = m.regs.ix, bc = m.regs.bc) {
  const { mem8 } = m;

  // Tick the frame-delay pacing timer (record field +0x11) down by one.  While it has not yet reached
  // zero the actor keeps holding this animation frame, so return immediately and leave the rest of the
  // record — and every register — untouched.  Only when the timer expires does the transition below run.
  mem8[rec + 0x11] = (mem8[rec + 0x11] - 1);
  if (mem8[rec + 0x11] !== 0) return; // frame delay not yet expired — hold and wait for the next frame

  // The timer has expired.  Which arm runs is gated on the state-10 ROM-checksum strike counter at
  // TAMPER_STRIKES_STATE10 (0x8a39): in untampered play it is always zero, so the else arm (the real
  // transition) runs.  A nonzero value is an anti-tamper condition that does not occur in normal play;
  // the ROM reaches its handling by jumping into the middle of the `inc (ix+0x02)` instruction below, so
  // that instruction's operand byte decodes instead as a store of the strike value to (BC) — corrupting
  // memory rather than advancing the actor cleanly.
  const tamper = mem8[TAMPER_STRIKES_STATE10];
  if (tamper !== 0) {
    mem8[bc] = tamper; // anti-tamper overlap arm — write the strike value to (BC); unreached in normal play
  } else {
    mem8[rec + 0x11] = DELAY_RESEED; // reload the frame-delay timer for the next state's pacing
    mem8[rec + 0x02] = (mem8[rec + 0x02] + 1); // advance the record's state index to the next handler
  }

  // Both arms converge here to commit the visible step of the transition.
  // Move the actor down the screen: its base Y coordinate lives at record field +0x04, advanced by one
  // fixed step each time this handler fires.
  mem8[rec + 0x04] = (mem8[rec + 0x04] + BASE_Y_STEP);
  // Clear the record's +0x1e scratch field as part of the state advance.
  mem8[rec + 0x1e] = 0;
  // Repaint the actor's shape: the pattern-A shape loader copies the four bytes of the ROM shape table
  // SHAPE_TABLE_26C1 (0x26c1) into the +0x0f display byte of this record and the three that follow it,
  // restyling the group of four actors in one step.
  return seedFourRecordsAndCopyDisplayTiles(m, SHAPE_TABLE_26C1, rec);
}
