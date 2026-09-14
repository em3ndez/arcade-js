// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { GAME_MODE, MODE_DISPATCH_SEL, GAME_MODE_PENDING, FRAME_COUNTER, PREV_Y_LO, PREV_Y_HI, PREV_X_LO, PREV_X_HI, DRAW_CURSOR_LO, DRAW_CURSOR_HI } from "./names.js";
import { advanceDisplayCursor } from "./advanceDisplayCursor.js";

/**
 * emitObjectPositionVector / emitObjectPositionRecord — emit a moving object's six-byte position record
 * into the vector list. ROM 0xc772 (entry) / 0xc774 (record body).
 *
 * Role in the machine: this is how a moving object (an enemy or shot riding the tube) gets its absolute
 * screen position into the display list. Given an object slot index X, it writes a fixed record header then
 * that object's X and Y coordinate words, pulled from four parallel zero-page tables, and caches the raw
 * bytes as the "previous point" that later relative/delta records draw from. emitObjectPositionVector is the
 * public entry: it starts the write at cursor offset 0; emitObjectPositionRecord is the inner body that
 * takes an explicit starting offset Y.
 *
 * Behaviour: form the write base from the draw cursor DRAW_CURSOR_LO/HI (loc_74/loc_75). Write the fixed
 * header pair {0x40,0x80}. Then the X word: low byte from GAME_MODE_PENDING+x (loc_2,x) cached to PREV_X_LO
 * (loc_6c), high byte from FRAME_COUNTER+x (loc_3,x) cached to PREV_X_HI (loc_6d) and stored masked to 5
 * bits (& 0x1f). Then the Y word: low byte from GAME_MODE+x (loc_00,x) cached to PREV_Y_LO (loc_6a), high
 * byte from MODE_DISPATCH_SEL+x (loc_1,x) cached to PREV_Y_HI (loc_6b) and stored masked to 5 bits. Each
 * store advances the running offset Y. Finally advance the display cursor past the six emitted bytes.
 *
 * Live-out: six bytes appended at the cursor; the previous-point cache PREV_X_LO/HI + PREV_Y_LO/HI
 * (loc_6a..loc_6d); and the draw cursor advanced by advanceDisplayCursor. Grounding: [seen].
 */
export function emitObjectPositionVector(m, x = m.regs.x) {
  return emitObjectPositionRecord(m, x, 0); // public entry: start the write at cursor offset 0
}

export function emitObjectPositionRecord(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  const base = mem8[DRAW_CURSOR_LO] | (mem8[DRAW_CURSOR_HI] << 8); // write base = draw cursor loc_74/loc_75

  mem8[u16(base + y)] = 0x40; y = u8(y + 1);    // fixed header byte 0
  mem8[u16(base + y)] = 0x80; y = u8(y + 1);    // fixed header byte 1

  const xLo = mem8[u8(GAME_MODE_PENDING + x)];  // X low  <- loc_2,x
  mem8[PREV_X_LO] = xLo;                         // cache as previous-point X low (loc_6c)
  mem8[u16(base + y)] = xLo; y = u8(y + 1);

  const xHi = mem8[u8(FRAME_COUNTER + x)];       // X high <- loc_3,x
  mem8[PREV_X_HI] = xHi;                         // cache as previous-point X high (loc_6d)
  mem8[u16(base + y)] = xHi & 0x1f;              // stored clamped to 5 bits

  const yLo = mem8[u8(GAME_MODE + x)];           // Y low  <- loc_00,x
  mem8[PREV_Y_LO] = yLo; y = u8(y + 1);          // cache as previous-point Y low (loc_6a)
  mem8[u16(base + y)] = yLo;

  const yHi = mem8[u8(MODE_DISPATCH_SEL + x)];   // Y high <- loc_1,x
  mem8[PREV_Y_HI] = yHi; y = u8(y + 1);          // cache as previous-point Y high (loc_6b)
  mem8[u16(base + y)] = yHi & 0x1f;              // stored clamped to 5 bits

  return advanceDisplayCursor(m, y);            // advance loc_74/loc_75 past the six bytes
}
