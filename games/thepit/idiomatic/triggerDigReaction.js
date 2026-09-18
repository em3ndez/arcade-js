// SPDX-License-Identifier: GPL-3.0-only
/**
 * triggerDigReaction — classify the tile under a digging actor and stage its reaction.
 *
 * The dig-arm of the actor-movement classifier, reached from its tile-boundary sibling once
 * that arm declines the tile it found. Given the tile code under the actor, the position
 * accumulator (low 3 bits = sub-cell offset) and the current-cell pointer, it sorts the code
 * into four outcomes: codes 54..57 defer to another arm; a short "always a hit" set arms the
 * reaction latch outright (code 196 and 150..153 only when the offset has bit 2 set); diggable
 * codes 113..153 look up the tile the cell is expected to hold — a match keeps moving, a
 * mismatch stages the reaction (and, off a boundary, records the neighbour cell's expected
 * tile) then arms the latch; anything else keeps moving. The latch fires only for an already-
 * armed actor, advancing its arm state and requesting the reaction sound. Every outcome hands
 * off to the record builder or the movement continuation, whose return unwinds to our caller.
 */

import { PLAYER_FACING, NEXT_TILE, REACTION_STATE, DIG_COLLISION_STATE, DIG_OBJ_TIMER, REACTION_PERIOD, AHEAD_TILE_RAW, REACTION_TIMER, EXPECTED_TILE } from "./names.js";
import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";
import { advanceActorWalk } from "./advanceActorWalk.js";

// Tables of the tile each cell is expected to hold (current cell, and neighbour cell).
const EXPECTED_TILE_TABLE = 0x1e48;
const NEIGHBOUR_TILE_TABLE = 0x1fb0;

// Classifier scratch (roles not pinned).
const REACTION_PARAM = REACTION_TIMER;

const REACTION_SPRITE_FRAME = 54; // the sprite frame the actor shows while reacting
const REACTION_SOUND = 20; // sound requested when an armed reaction fires

export function triggerDigReaction(m, tileCode = m.regs.b, positionAccumulator = m.regs.e, actorCellPtr = m.regs.ix) {
  const { mem8 } = m;
  const subCell = positionAccumulator & 7;

  // Codes 54..57 belong to a sibling arm — defer the frame with the plain record.
  if (tileCode >= 54 && tileCode < 58) {
    stageObjectSpriteRecord(m);
    return;
  }

  // Codes that are always a hit — arm the reaction latch outright.
  if (tileCode === 42 || tileCode === 43 || tileCode === 65 || tileCode === 193 || tileCode === 149) {
    return armReactionLatch(m);
  }

  // Code 196 and band 150..153 hit only when the sub-cell offset has bit 2 set.
  if (tileCode === 196 || (tileCode >= 150 && tileCode < 154)) {
    if (positionAccumulator & 4) return armReactionLatch(m);
  }

  // Only diggable codes 113..153 look up a tile reaction; anything else keeps moving.
  if (tileCode < 113 || tileCode >= 154) return movementContinuation(m);

  // Look up the tile this cell is expected to hold and record it.
  const expected = mem8[EXPECTED_TILE_TABLE + (tileCode - 113) * 8 + subCell];
  mem8[EXPECTED_TILE] = expected;

  // Expected tile still matches what's there — nothing changed, keep moving.
  if (expected === tileCode) return movementContinuation(m);

  // Mismatch: the actor has run into a tile it must react to. Stage the reaction.
  mem8[REACTION_PARAM] = mem8[REACTION_PERIOD];
  mem8[REACTION_STATE] = 3;
  mem8[PLAYER_FACING] = REACTION_SPRITE_FRAME;

  // Exactly on a cell boundary — no neighbour to consider; go straight to the latch.
  if (subCell === 0) return armReactionLatch(m);

  // Off the boundary: record the neighbour cell's tile, and its expected tile when diggable.
  const neighbourTile = mem8[actorCellPtr + 1];
  mem8[AHEAD_TILE_RAW] = neighbourTile;
  if (neighbourTile >= 113 && neighbourTile < 154) {
    mem8[NEXT_TILE] = mem8[NEIGHBOUR_TILE_TABLE + (neighbourTile - 113) * 8 + subCell];
  }
  return armReactionLatch(m);
}

/** Movement continuation: advance the actor and build its record. */
function movementContinuation(m) {
  return advanceActorWalk(m);
}

/** Fire the reaction for an armed actor, then build the deferral record. */
function armReactionLatch(m) {
  const { mem8 } = m;
  if (mem8[DIG_COLLISION_STATE] !== 0) {
    mem8[DIG_COLLISION_STATE] = 2;
    mem8[DIG_OBJ_TIMER] = 64;
    enqueueSoundCommand(m, REACTION_SOUND);
  }
  stageObjectSpriteRecord(m);
}
