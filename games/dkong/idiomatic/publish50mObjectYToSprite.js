// SPDX-License-Identifier: GPL-3.0-only
/**
 * publish50mObjectYToSprite — mirror the byte at a source pointer into one of two sprite slots,
 * selected by bit 3 of the pointer.  ROM 0x22BD.
 *
 * Reads the byte at the source address and stores it into one of two fixed cells in
 * the sprite shadow buffer. Bit 3 of the source address's low byte chooses the slot:
 * clear -> the lower cell (0x6947), set -> the upper cell (0x694b). Both cells are the
 * +3 (position) field of a 4-byte sprite record inside SPRITE_BUFFER — records 17 and
 * 18, the two slots just below Mario's record (0x694C) — so the store refreshes an
 * on-screen sprite's position straight from the source byte.
 *
 * Its two callers (ROM 0x2259 and 0x22A2, the arms of the 0x2207 object state machine)
 * both label the call "display mirror" and hand it a pointer to an object record's
 * counter byte (base+3), so the sprite position tracks that counter. [guess] the two
 * slots are that object's on-screen markers; the specific game object is not confirmed,
 * so the routine keeps the neutral loc_ name.
 *
 * A LEAF: reads one source byte, writes one sprite cell; calls nothing, returns nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-22bd.test.js.
 * GATE:     crafted, exhaustive by factorisation — attract never dispatches 0x22BD (0 in
 *           3000 frames), so real captures are unavailable; the observable space is tiny
 *           and swept in full on real attract-base states. (A) all 256 source-pointer low
 *           bytes with a fixed value cover the destination selection for every low byte;
 *           (B) all 256 byte values on each arm (bit 3 clear / set) cover the exact copy
 *           into both cells. Teeth: a wrong-selector-bit twin, an inverted-selector twin,
 *           and a value-corrupting twin.
 * LIVE-OUT: memory-only — the single store is the only observable effect. Both callers
 *           overwrite the copied byte immediately (their `regs.a = 0x78` / `0x68` right
 *           after the call), never read the destination address it computes, and reuse
 *           the source pointer, which this routine leaves untouched; the oracle's residual
 *           registers/flags and its terminal `ret` are dead ABI.
 * NAMES:    SPRITE_BUFFER (0x6900) from ram.js. The two destination cells (0x6947, 0x694b)
 *           are the +3 field of records 17/18 inside it and have no individual ram.js name
 *           — kept as local consts for the lead to name later.
 */

import { SPRITE_BUFFER } from "./ram.js";

// The two candidate destinations: the +3 (position) field of two adjacent 4-byte sprite
// records inside SPRITE_BUFFER — records 17 and 18, the slots just below Mario's record at
// 0x694C. Bit 3 of the source pointer's low byte picks which one is refreshed. Neither cell
// has its own name in ram.js.
const DEST_BIT3_CLEAR = SPRITE_BUFFER + 17 * 4 + 3; // 0x6947
const DEST_BIT3_SET = SPRITE_BUFFER + 18 * 4 + 3; // 0x694b

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
