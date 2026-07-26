// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_191f — classify the tile under a digging actor and stage its reaction.  ROM 0x191f.
 *
 * The dig-arm of the actor-movement classifier, reached from its tile-boundary sibling
 * (loc_18cf) once that arm declines the tile it found. It takes the tile code currently
 * under the actor, the actor's position accumulator (whose low 3 bits are the sub-cell
 * offset within the tile column), and the pointer to the actor's current cell, and
 * sorts the tile code into one of four outcomes:
 *
 *   - Codes 54..57 are handled by another arm — just build the deferral record and defer.
 *   - A short list of "always a hit" codes (42, 43, 65, 193, 149) arm the reaction latch
 *     immediately. Code 196 and the band 150..153 are conditional: they only hit when the
 *     sub-cell offset has bit 2 set, otherwise they fall through.
 *   - Diggable codes 113..153 look up the tile the cell is EXPECTED to hold in a ROM table
 *     (indexed by (code - 113) * 8 + sub-cell offset) and record it. If the expected tile
 *     matches the one actually there, nothing has changed — keep moving. If it differs, the
 *     actor has run into a tile it must react to: stage the reaction (copy a parameter,
 *     mark the reaction step, set the reaction sprite frame), and — unless the actor is
 *     exactly on a cell boundary — also look up the NEIGHBOURING cell's expected tile from a
 *     second ROM table and record it, then arm the reaction latch.
 *   - Everything else (codes below 113, or 154 and up) has nothing to react to — keep moving.
 *
 * The reaction latch fires only for an already-armed actor: if the per-actor arm state is
 * clear it just builds the record; otherwise it advances that state, sets its companion
 * byte, requests the reaction sound, and builds the record. Every outcome ultimately hands
 * off to the record builder (loc_1b5b) or the movement continuation (0x19d0), each of whose
 * own return unwinds to this routine's caller.
 *
 * Memory-equivalent to the frozen oracle — equivalence-191f.test.js.
 * GATE:     crafted-entry + real dispatches — memory-equivalence over 263 real attract
 *           dispatches (excluding the dead stack scratch just below the entry stack pointer,
 *           where the oracle's sound-path pushes park six bytes the stack-free JS never
 *           writes) plus crafted entries forcing every branch: the escape band, each
 *           always-hit code, the bit-2 gate, the diggable lookup (match / mismatch /
 *           neighbour / boundary / neighbour-out-of-range), and the armed sound path.
 *           Dispatched naturally during the attract demo.
 * LIVE-OUT: memory-only — the staged reaction bytes, the per-actor arm state, its companion,
 *           the requested sound, and the record loc_1b5b builds. The registers/flags the
 *           oracle leaves behind (from its tail into loc_1b5b or the sound enqueue) are dead
 *           ABI no caller reads; the keep-moving path stays the frozen 0x19d0, so it
 *           reproduces the oracle's registers exactly.
 * NAMES:    SPRITE_CODE, NEXT_TILE from ram.js. The classifier scratch bytes 0x80a2-0x80a7,
 *           the per-actor arm state 0x80c1 and its companion 0x80b1, and the two ROM lookup
 *           tables at 0x1e48 / 0x1fb0 stay hex — their roles are not yet grounded.
 */

import { SPRITE_CODE, NEXT_TILE, REACTION_STATE } from "./ram.js";
import { loc_1b5b } from "./loc_1b5b.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

// ROM tables of the tile a cell is expected to hold, one per diggable code (113..153) and
// sub-cell offset (0..7): the current cell's table, and the neighbouring cell's table.
const EXPECTED_TILE_TABLE = 0x1e48;
const NEIGHBOUR_TILE_TABLE = 0x1fb0;

// Classifier scratch + per-actor reaction state (roles not yet grounded — kept as addresses).
const REACTION_PARAM_SRC = 0x80a3; // parameter copied into REACTION_PARAM on a reaction
const REACTION_PARAM = 0x80a4;
const EXPECTED_TILE = 0x80a7; // the current cell's expected tile, recorded for the reaction
const NEIGHBOUR_TILE = 0x80a6; // the neighbouring cell's tile code, recorded for the reaction
const ARM_STATE = 0x80c1; // per-actor reaction arm state (0 = not armed)
const ARM_COMPANION = 0x80b1;

const REACTION_SPRITE_FRAME = 54; // the sprite frame the actor shows while reacting
const REACTION_SOUND = 20; // sound requested when an armed reaction fires

export function loc_191f(m, tileCode = m.regs.b, positionAccumulator = m.regs.e, actorCellPtr = m.regs.ix) {
  const { mem } = m;
  const subCell = positionAccumulator & 7;

  // Codes 54..57 belong to a sibling arm — defer the frame with the plain record.
  if (tileCode >= 54 && tileCode < 58) {
    loc_1b5b(m);
    return;
  }

  // Codes that are always a hit — arm the reaction latch outright.
  if (tileCode === 42 || tileCode === 43 || tileCode === 65 || tileCode === 193 || tileCode === 149) {
    return armReactionLatch(m);
  }

  // Code 196 and the band 150..153 hit only when the sub-cell offset has bit 2 set;
  // with it clear they fall through to the diggable-range test below.
  if (tileCode === 196 || (tileCode >= 150 && tileCode < 154)) {
    if (positionAccumulator & 4) return armReactionLatch(m);
  }

  // Only diggable codes 113..153 look up a tile reaction; anything else keeps moving.
  if (tileCode < 113 || tileCode >= 154) return movementContinuation(m);

  // Look up the tile this cell is expected to hold and record it.
  const expected = mem.read8(EXPECTED_TILE_TABLE + (tileCode - 113) * 8 + subCell);
  mem.write8(EXPECTED_TILE, expected);

  // Expected tile still matches what's there — nothing changed, keep moving.
  if (expected === tileCode) return movementContinuation(m);

  // Mismatch: the actor has run into a tile it must react to. Stage the reaction.
  mem.write8(REACTION_PARAM, mem.read8(REACTION_PARAM_SRC));
  mem.write8(REACTION_STATE, 3);
  mem.write8(SPRITE_CODE, REACTION_SPRITE_FRAME);

  // Exactly on a cell boundary — no neighbour to consider; go straight to the latch.
  if (subCell === 0) return armReactionLatch(m);

  // Off the boundary: record the neighbouring cell's tile, and when it too is diggable,
  // record its expected tile from the neighbour table.
  const neighbourTile = mem.read8(actorCellPtr + 1);
  mem.write8(NEIGHBOUR_TILE, neighbourTile);
  if (neighbourTile >= 113 && neighbourTile < 154) {
    mem.write8(NEXT_TILE, mem.read8(NEIGHBOUR_TILE_TABLE + (neighbourTile - 113) * 8 + subCell));
  }
  return armReactionLatch(m);
}

/** The movement continuation (still the frozen oracle at 0x19d0): advance the actor and
 *  build its record. Its own return unwinds to loc_191f's caller. */
function movementContinuation(m) {
  return m.call(0x19d0);
}

/** Fire the reaction for an armed actor, then build the deferral record. An unarmed actor
 *  (arm state 0) only builds the record. */
function armReactionLatch(m) {
  const { mem } = m;
  if (mem.read8(ARM_STATE) !== 0) {
    mem.write8(ARM_STATE, 2);
    mem.write8(ARM_COMPANION, 64);
    enqueueSoundCommand(m, REACTION_SOUND);
  }
  loc_1b5b(m);
}
