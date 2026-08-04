// SPDX-License-Identifier: GPL-3.0-only
/**
 * publish50mObjectYToSprite — mirror the byte at a source pointer into one of two sprite
 * slots, selected by bit 3 of the pointer.
 *
 * Reads the byte at the source address and stores it into one of two fixed cells in the
 * sprite shadow buffer. Bit 3 of the source address's low byte chooses the slot: clear picks
 * the lower-ADDRESSED cell, set picks the higher-addressed one. ("Lower/higher" here is
 * about addresses, not the screen.) Both cells are the +3 (Y) field of a 4-byte sprite
 * record inside SPRITE_BUFFER — records 17 and 18, the two slots at addresses just below
 * Mario's — so the store refreshes an on-screen sprite's Y straight from the source byte.
 * Larger Y is lower on screen, so raising the copied byte drops the sprite down the display.
 *
 * Its two callers are the moving arms of the 50m object state machine, and each hands it a
 * pointer to an object record's position counter, so the drawn sprite tracks that counter.
 * The selector works because the two object records' bases differ by 8, which makes bit 3 of
 * the low byte the record index.
 *
 * THE RECORD-TO-SPRITE IDENTITY IS LAGGED, not same-frame: the sprite cell holds the object
 * record's value as of the PREVIOUS frame, so sampling both within one frame disagrees while
 * the object is moving. On the boards this machine does not run, the two sprite records are
 * all-zero (25m and 100m) or seeded but frozen (75m).
 *
 * WHAT THE NAME DOES NOT CLAIM: the name says "Y", not what the sprite depicts. The sprite
 * itself is isolated — one clean 10x16 box per record, tile 0x46 with attribute 0x03, one at
 * the far left and one at the far right of the playfield — and it reads as a ladder graphic,
 * side-rails with rungs, whose upper section vanishes when the record is blanked while
 * static tilemap rungs remain below. The name still says "object" for one reason: "ladder"
 * is a reading of a picture, and which of the 50m cast's ladders this is — retracting, or
 * something else that travels — was not settled.
 *
 * A LEAF: reads one source byte, writes one sprite cell; calls nothing, returns nothing.
 *
 * LIVE-OUT: memory-only — the single store is the only observable effect. The source pointer
 * is left untouched, and both callers overwrite the copied byte immediately.
 */

import { SPRITE_BUFFER } from "./names.js";

// The two candidate destinations: the +3 (Y) field of two adjacent 4-byte sprite records
// inside SPRITE_BUFFER — records 17 and 18, at addresses just below Mario's record. Bit 3 of
// the source pointer's low byte picks which one is refreshed, because the two object
// records' bases differ by 8 and that bit is therefore the record index. Neither destination
// cell carries a shared name.
const DEST_BIT3_CLEAR = SPRITE_BUFFER + 17 * 4 + 3;
const DEST_BIT3_SET = SPRITE_BUFFER + 18 * 4 + 3;

/**
 * @param {object} m       the machine (uses m.mem only).
 * @param {number} srcAddr the source pointer — the byte read is copied to the selected slot,
 *                         and bit 3 of this address's low byte selects which slot.
 * @returns {void}
 */
export function publish50mObjectYToSprite(m, srcAddr) {
  const { mem } = m;

  const value = mem.read8(srcAddr);
  const dest = (srcAddr & 0x08) !== 0 ? DEST_BIT3_SET : DEST_BIT3_CLEAR;
  mem.write8(dest, value);
}
