// SPDX-License-Identifier: GPL-3.0-only
/**
 * commitMoveAcrossPlayerX -- object-AI horizontal target picker that aims an attacker at the far side of
 * the player, then commits the move toward that target.
 *
 * WHAT IT IS
 *   One of the shared motion-planning primitives beneath the object-AI state handlers. Given an object
 *   record (defaulting to IX, the object the driver is currently servicing), it reads the player-X
 *   reference loc_4202 and the actor's own X (record+4), then chooses a horizontal target on the OPPOSITE
 *   side of the player from the actor -- a crossover move that sends a diving attacker sweeping past the
 *   ship rather than straight at it. It tail-calls commitMoveToTargetX (0x0df6) to set up the run.
 *
 * ROLE IN THE MACHINE
 *   Called from state 2 (advanceActorPhaseAndCommitMove) and the shared object-AI tail
 *   beginObjectCrossPlayerMove, and reached from commitMoveToStoredOrPlayerTargetX when an object has no
 *   stored target of its own. loc_4202 is the single cell that holds the ship's X and doubles as the
 *   anchor every attacker aims at.
 *
 * ARITHMETIC (faithful to the Z80)
 *   gap = (actorX - refX) & 0xff is a byte subtraction: when the actor is left of the reference the borrow
 *   makes the high bits set, which after a logical halve is re-imposed as bit 7 (| 0x80) to sign-extend.
 *   The signed-halved gap is biased by 16 and clamped into a band on the far side.
 *
 * ROM 0x0ddd.  Grounding: [seen] (loc_4202's player-X role is [code]-inferred).
 *
 * LIVE-OUT: whatever commitMoveToTargetX writes into the record's move fields for the chosen target X.
 */
import { commitMoveToTargetX } from "./commitMoveToTargetX.js";
import { loc_4202 } from "./names.js";

// Halved-gap bias, and the two clamp bands: aim right (144-208) when the actor is left of the reference,
// aim left (48-112) when it is at or right of it -- either way the target lands across the player.
const BIAS = 16;
const RIGHT_LO = 144, RIGHT_HI = 208; // band chosen when the actor is left of the reference
const LEFT_LO = 48, LEFT_HI = 112;    // band chosen when the actor is at or right of the reference

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export function commitMoveAcrossPlayerX(m, record = m.regs.ix) {
  const { mem8 } = m;
  // Player-X reference (ship position / target anchor) and this actor's current X (record+4).
  const refX = mem8[loc_4202];
  const actorX = mem8[record + 0x04];
  const gap = (actorX - refX) & 0xff; // borrow (actor left of reference) rides bit 7 after halving

  let target;
  if (actorX < refX) {
    // Actor left of the reference: sign-extend the halved gap, subtract the bias, aim right.
    target = clamp((((gap >> 1) | 0x80) - BIAS) & 0xff, RIGHT_LO, RIGHT_HI);
  } else {
    // Actor at or right of the reference: halve the gap, add the bias, aim left.
    target = clamp(((gap >> 1) + BIAS) & 0xff, LEFT_LO, LEFT_HI);
  }

  // Commit the run toward the chosen crossover target through the shared mover.
  return commitMoveToTargetX(m, target, record);
}
