// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_30db — zero the X byte of Mario's sprite record, then a stride-4 run of six
 * more sprite-shadow records.  ROM 0x30db.
 *
 * A tiny, branch-free preamble. It stores 0x00 to byte +0 (the X coordinate) of
 * Mario's 4-byte hardware sprite record at 0x694C, then FALLS THROUGH into sub_30e4
 * (the idiomatic clearStridedBytes) with HL = 0x6958 and B = 6, which zeros byte +0
 * of six further sprite records at stride 4: 0x6958 / 5C / 60 / 64 / 68 / 6C. Net
 * effect: seven bytes cleared to 0x00 — the leading (X) byte of a run of sprite-buffer
 * slots. The lone 0x694C write is separate because the strided run skips 0x6950/0x6954.
 *
 * The fall-through is NOT a call — sub_30e4 pushes nothing on the way in, so its `ret`
 * returns to loc_30db's OWN caller. The single caller is loc_12de (ROM 0x12DE, the
 * "advance 0x600A, re-arm the gate" sub-state step), which invokes this as its first
 * act. The routine READS no memory and has NO branches: every dispatch clears the same
 * seven fixed addresses, so its behaviour is a constant, independent of entry state.
 *
 * Reached in attract via loc_12de (first at ~frame 2851).
 *
 * Memory-equivalent to the frozen oracle — equivalence-30db.test.js.
 * GATE:     crafted-entry (footprint-pinned) — real captured attract dispatches, plus a
 *           sentinel-filled 0x6900 page that nails the EXACT seven-byte footprint (a
 *           missed / extra / misplaced write bites the RAM gate). Not exhaustive, and it
 *           need not be: the routine reads nothing and never branches, so one footprint
 *           pin is definitive; there are no unreached arms to craft. Teeth: an omit-Mario
 *           twin and an off-by-one-count twin, each caught on the sentinel page.
 * LIVE-OUT: memory-only — the seven zeroed bytes (0x694C + 0x6958/5C/60/64/68/6C). A / HL
 *           / B end at 0x70 / 0x6970 / 0 (clearStridedBytes' live-out) and match the
 *           oracle, but are DEAD: the sole caller loc_12de reloads HL and A immediately
 *           (`ld hl,0x600a` / `ld a,(0x600e)`) and reads no flags. Checked in the gate as
 *           a free extra pin, not required. FLAGS dropped as dead.
 * NAMES:    MARIO_SPRITE_RECORD (0x694C) from ram.js. 0x6958–0x696C kept hex — unnamed
 *           sprite-shadow records inside SPRITE_BUFFER (0x6900), passed to the callee as
 *           HL/B, not fixed game-state fields. Callee: clearStridedBytes (ROM 0x30e4).
 */
import { MARIO_SPRITE_RECORD } from "../optimized/ram.js";
import { clearStridedBytes } from "./clearStridedBytes.js";

export function loc_30db(m) {
  const { regs, mem } = m;

  // ld hl,0x694c / ld (hl),0x00 — zero byte +0 (the X coordinate) of Mario's sprite record.
  mem.write8(MARIO_SPRITE_RECORD, 0x00);

  // ld l,0x58 / ld b,6, then FALL THROUGH into sub_30e4 (clearStridedBytes). H stays 0x69
  // from the 0x694c load and L becomes 0x58, so HL = 0x6958; B = 6 clears byte +0 of six
  // sprite records at stride 4 (0x6958/5c/60/64/68/6c). The callee's `ret` returns to our
  // OWN caller (fall-through, nothing pushed) — modelled as a plain JS return here.
  regs.hl = (MARIO_SPRITE_RECORD & 0xff00) | 0x58; // H preserved (0x69) -> 0x6958
  regs.b = 0x06;
  clearStridedBytes(m);
}
