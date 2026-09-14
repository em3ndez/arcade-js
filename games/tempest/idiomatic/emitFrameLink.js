// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { DRAW_CURSOR_LO, DRAW_CURSOR_HI, POINTER_PARITY, SCORE_DISPLAY_TIMER, VEC_LIST_HEADER_LO, VECHEAD0_PLAY, DRAW_PTR_EVEN_LO, DRAW_PTR_TABLE_A } from "./names.js";

/**
 * emitFrameLink -- emit a frame-link record, guarded against a mid-frame source change. ROM 0xb332.
 *
 * Role in the machine: called from the per-frame vector housekeeping (buildFrameVectors) as it stitches
 * the finished display list together. Between the moment the frame's checksum was folded and now, the
 * live source header (0xcec4) can change; this routine detects that race and asks the caller to redo the
 * frame rather than emit a stale link. When the source is stable it splices a two-byte pointer record
 * into the list and relinks the working draw cursor to the next record.
 *
 * Behavior: read the source header (VECHEAD0_PLAY, 0xcec4). If it differs from the checkpoint copy
 * (VEC_LIST_HEADER_LO, 0x2000), latch the new value into the checkpoint and return carry set -- the
 * caller re-runs the frame. Otherwise pick a record offset from the pointer-parity mode flag (0x08 when
 * nonzero, else 0x02), clear the score-display timer (0x16e), copy the selected two-byte word from the
 * even-pointer table (0xce9e+x) through the working draw cursor 0x74, then reload cursor lo/hi from a
 * second table (0xce68+x) so the next record chains on. Return carry clear.
 *
 * Live-out: on the change path, the checkpoint 0x2000. On the copy path, two bytes at the draw cursor,
 * SCORE_DISPLAY_TIMER cleared, and the draw cursor 0x74/0x75 repointed. Grounding: [seen].
 */
export function emitFrameLink(m) {
  const { mem8 } = m;
  const src = mem8[VECHEAD0_PLAY];
  if (src !== mem8[VEC_LIST_HEADER_LO]) {   // source moved since the checkpoint was taken
    mem8[VEC_LIST_HEADER_LO] = src;         // re-latch the checkpoint
    return true;  // carry set (the caller redoes the frame)
  }
  const x = mem8[POINTER_PARITY] !== 0 ? 0x08 : 0x02;   // mode flag picks the record slot
  const ptr = mem8[DRAW_CURSOR_LO] | (mem8[DRAW_CURSOR_HI] << 8); // working draw cursor as a 16-bit address
  mem8[SCORE_DISPLAY_TIMER] = 0;
  mem8[u16(ptr)] = mem8[u16(DRAW_PTR_EVEN_LO + x)];      // copy the selected word's low byte
  mem8[u16(ptr + 1)] = mem8[u16(DRAW_PTR_EVEN_LO + x + 1)]; // ...and its high byte
  mem8[DRAW_CURSOR_LO] = mem8[u16(DRAW_PTR_TABLE_A + x)];    // relink cursor from the second table
  mem8[DRAW_CURSOR_HI] = mem8[u16(DRAW_PTR_TABLE_A + x + 1)];
  return false;  // carry clear (the copy path ran)
}
