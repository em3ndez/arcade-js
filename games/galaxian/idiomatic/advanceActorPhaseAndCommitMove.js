// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceActorPhaseAndCommitMove — the object-AI state-2 handler: tick an actor's phase counter and
 * commit its next horizontal move.
 *
 * WHAT IT IS
 *   One entry in the object-AI state table (the 0x0ce6 dispatch, index 2). Each frame the object is in
 *   this state, it bumps the actor's phase/animation counter and then picks a horizontal-move handler
 *   by the record's kind field: one kind uses the stored/player target selector, every other kind uses
 *   the cross-player selector.
 *
 * ROLE IN THE MACHINE
 *   The object records live in the 32-byte-stride array; byte 3 is the sprite-related phase/anim
 *   counter that handlers tick, and byte 7 carries the direction bit and the kind/type nibbles. Here
 *   the kind is byte 7 masked by 0x70: value 0x60 routes to commitMoveToStoredOrPlayerTargetX (aim at a
 *   stored or the player target), any other value routes to commitMoveAcrossPlayerX, which picks a
 *   target on the far side of the ship reference X (loc_4202 0x4202) so divers cross over the player.
 *
 * ROM 0x0dd1.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: the tail move handler's result; the record's phase counter (byte 3) plus whatever that
 * handler commits are written.
 */
import { commitMoveToStoredOrPlayerTargetX } from "./commitMoveToStoredOrPlayerTargetX.js";
import { commitMoveAcrossPlayerX } from "./commitMoveAcrossPlayerX.js";

// Kind is byte 7 masked by 0x70; the 0x60 value selects the stored/player-target move handler.
const KIND_MASK = 0x70;
const KIND_STORED_TARGET = 0x60;

export function advanceActorPhaseAndCommitMove(m, record = m.regs.ix) {
  const { mem8 } = m;
  // Advance the actor's phase/animation counter (byte 3) one step this frame.
  mem8[record + 0x03] = mem8[record + 0x03] + 1; // phase/anim counter

  // Route by kind (byte 7 & 0x70): kind 0x60 aims at the stored/player target; any other kind commits
  // a cross-player move (target on the opposite side of the ship reference X).
  if ((mem8[record + 0x07] & KIND_MASK) === KIND_STORED_TARGET) {
    return commitMoveToStoredOrPlayerTargetX(m, record);
  }
  return commitMoveAcrossPlayerX(m, record);
}
