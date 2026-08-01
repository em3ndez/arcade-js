// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2e84 — object update state 4: advance the object's Y by 3, deactivating it
 * once it passes the travel limit, then mirror its position to its sprite.  ROM 0x2E84.
 *
 * One state of the per-object update loop (entry_2e04), dispatched by obj_2e12 when the
 * object's state field is 4. Each call moves the object 3 units along Y. If the new Y is
 * still below the travel limit (248) the object simply keeps moving; once it reaches or
 * passes that limit it is retired — its X is cleared and its active flag is cleared, so it
 * stops being drawn and processed. Either way the object's position is then mirrored into
 * its paired sprite record and both scan cursors advance to the next object, via the shared
 * tail mirrorObjectPositionToSprite. On the retire path the just-cleared X (0) is what gets
 * mirrored, so the sprite is pulled to X=0 the same frame the object goes inactive.
 *
 * NAME: kept as loc_2e84. The mechanism is clear (step Y by 3, deactivate at the limit,
 * mirror to sprite), but the object's game role and the direction the step represents are
 * not grounded here — larger Y is lower on screen — so the effect-level name is left for a
 * clarify/grounding pass rather than guessing "rise"/"fall" from the oracle header.
 *
 * The object record is addressed by the object-scan cursor, carried in registers by the
 * still-translated scan loop (a genuine oracle boundary); the paired sprite cursor is passed
 * straight through, untouched, to the mirror tail.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2e84.test.js.
 * GATE:     crafted + captured. The Y field is swept over all 256 values at a real object/
 *           sprite record pair (pins the +3 step, the exact 248 limit, and both branches),
 *           the X field swept over 256 in each branch (copied when moving, forced to 0 when
 *           retiring); the exact in-game cursor sequence is grid-cross-producted; an
 *           independence sweep varies the ignored registers and RAM; and 10 real captured
 *           0x2e84 dispatches from a steered full entry_2e04 loop (five objects below the
 *           limit, five at it) replay oracle vs candidate. Attract never reaches the loop.
 * LIVE-OUT: the object's Y (always) and, on the retire path, its X and active flag, plus the
 *           two sprite-position writes the mirror tail makes; and the registers that tail
 *           leaves — object cursor +16, sprite cursor +4, remaining-object count preserved,
 *           step value 4. The scratch byte the oracle leaves in the accumulator is dead: the
 *           loop reloads it for the next object before any test, and no exit successor reads it.
 * NAMES:    OBJ_ACTIVE (+0), OBJ_X (+3), OBJ_Y (+5) — record-field offsets from ram.js,
 *           indexed off the object-scan cursor.
 */

import { u8 } from "../../../core/int.js";
import { OBJ_ACTIVE, OBJ_X, OBJ_Y } from "./ram.js";
import { mirrorObjectPositionToSprite } from "./mirrorObjectPositionToSprite.js"; // ROM 0x2E6C

// Y limit: once the object reaches this it is retired instead of moving further.
const TRAVEL_LIMIT = 248;

/**
 * @param {object} m  the machine. The object-scan cursor arrives in a register; the paired
 *                    sprite cursor is passed through to the mirror tail unchanged.
 * @returns {void}
 */
export function loc_2e84(m) {
  const { regs, mem } = m;

  // Step the object 3 units along Y and store it back.
  const newY = u8(mem.read8(regs.ix + OBJ_Y) + 3);
  mem.write8(regs.ix + OBJ_Y, newY);

  // Reached the travel limit: retire the object — clear its X and its active flag, so it is
  // no longer drawn or processed. (Below the limit it just keeps moving.)
  if (newY >= TRAVEL_LIMIT) {
    mem.write8(regs.ix + OBJ_X, 0);
    mem.write8(regs.ix + OBJ_ACTIVE, 0);
  }

  // Mirror the object's position into its sprite record and advance both scan cursors.
  mirrorObjectPositionToSprite(m);
}
