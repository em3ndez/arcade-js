// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceBarrelTileAnimation — step one barrel record's animation prescaler and, on the visit it
 * runs out, swap the barrel's sprite to the other tile of an adjacent pair; then hand the frame on
 * to the shared object-sprite tail.
 *
 * Reads and writes the record's animation prescaler (+0x0f). Reads and writes OBJ_SPRITE_CODE,
 * but ONLY on the visit the prescaler expires on. Nothing else in the record is touched, and the
 * routine holds no address of its own — the record arrives in the caller's index register.
 *
 * The prescaler is stepped as a BYTE, so a prescaler of 0 goes to 255 rather than expiring; only a
 * result of exactly zero is expiry. On expiry the tile code's LOWEST bit is flipped and the
 * prescaler reloads to VISITS_PER_TILE, so the barrel holds one tile for four visits and the other
 * for the next four. The walk above visits an active record once a frame, so four visits is four
 * frames in practice.
 *
 * The lowest bit is a CHOICE OF TILE, not a way of drawing one: the raster flip lives in bit 7 of
 * the same byte and this routine never touches it.
 *
 * NOT CLAIMED: what the two tiles of a pair depict, and whether any reachable state delivers a
 * prescaler outside 1..4. The byte wrap at 0 is reproduced because the frozen behaviour has it and
 * the gate crafts it, not because it was observed. Record offset +0x0f is NOT a field with one
 * meaning across the object arrays — elsewhere the same offset is a height — so the prescaler
 * reading is scoped to the records this walk drives, and the offset stays a file-local constant
 * rather than earning a registered name.
 *
 * LIVE-OUT: memory, the guest pc and SP, and the propagated return value. No register and no flag.
 */

import { u8 } from "../../../core/int.js";
import { OBJ_SPRITE_CODE } from "./names.js";

/** Object-record field: the animation prescaler this routine steps. It carries no shared name. */
const OBJ_ANIM_PRESCALER = 0x0f;
/** Visits per animation step — what the prescaler is reloaded with when it expires. */
const VISITS_PER_TILE = 4;
/** The bit of the tile code that selects which tile of the adjacent pair is drawn. */
const TILE_PAIR_BIT = 1;

/**
 * @param {object} m  the machine. The object record arrives in the machine's index register and is
 *   deliberately NOT a parameter: the shared tail this hands off to re-reads that register itself,
 *   so a caller passing a different record would be obeyed by the two writes here and ignored one
 *   call later. It becomes an honest parameter once that tail is a readable routine.
 * @returns {*} whatever the shared tail's chain returns — propagated rather than swallowed, so a
 *   skip further down the walk cannot be lost here.
 */
export function advanceBarrelTileAnimation(m) {
  const { mem8 } = m;
  const record = m.regs.ix;

  // One visit off the prescaler, as a byte: 0 becomes 255 and is NOT expiry.
  let remaining = u8(mem8[record + OBJ_ANIM_PRESCALER] - 1);

  if (remaining === 0) {
    // Expired: show the other tile of the pair, and start the next step's countdown.
    mem8[record + OBJ_SPRITE_CODE] = mem8[record + OBJ_SPRITE_CODE] ^ TILE_PAIR_BIT;
    remaining = VISITS_PER_TILE;
  }
  mem8[record + OBJ_ANIM_PRESCALER] = remaining;

  // On into the shared object-sprite tail.
  return m.call(0x21ba);
}
