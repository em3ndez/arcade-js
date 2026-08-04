// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampScorePopupSprite — stamp a 4-byte sprite record, then cue a board-gated sound.
 *
 * The shared tail of the effect-sprite state machine. It commits one hardware sprite
 * record into POPUP_SPRITE from three caller-supplied bytes plus a hard-coded attribute,
 * then — ONLY on the boards whose bit is set in the applicability mask 0x05 (bit 0 = 25m,
 * bit 2 = 75m) — asserts a sound latch:
 *
 *   POPUP_SPRITE +0 = the caller's X byte      +1 = the caller's sprite-code byte
 *   POPUP_SPRITE +2 = 0x07, fixed attribute    +3 = the caller's Y byte
 *
 * POPUP_SPRITE is a TRANSIENT slot: the companion state of the same effect machine blanks
 * it again once the effect's timed hold expires, so what this routine stamps is on screen
 * for a bounded stretch and then gone.
 *
 * The board gate is the routine's ONLY conditional. It opens on 25m and 75m and closes on
 * 50m and 100m, where the sound cue is simply not issued; the four record bytes are stored
 * unconditionally on every board.
 *
 * NOT CLAIMED: which on-screen effect this sprite depicts, which sound the latch plays, or
 * why only two of the four boards cue it.
 *
 * LIVE-OUT: memory-only — the four POPUP_SPRITE bytes always, plus the sound latch when the
 * board gate is open.
 */
import { boardBitGate } from "./boardBitGate.js";
import { POPUP_SPRITE } from "./names.js";

const SPRITE_ATTR = 0x07;     // record byte +2, hard-coded
const BOARD_MASK = 0x05;      // board applicability mask: bit0 25m, bit2 75m
const SOUND_LATCH = 0x6085;   // storing 3 asserts this sound for 3 frames

export function stampScorePopupSprite(m) {
  const { regs, mem } = m;

  // Commit the 4-byte sprite record {X, code, 0x07, Y} into POPUP_SPRITE (unconditional).
  mem.write8(POPUP_SPRITE + 0, regs.a);
  mem.write8(POPUP_SPRITE + 1, regs.b);
  mem.write8(POPUP_SPRITE + 2, SPRITE_ATTR);
  mem.write8(POPUP_SPRITE + 3, regs.c);

  // Board gate: the mask selects the current board's applicability bit. Closed on
  // 50m/100m, and the sound cue below is then skipped.
  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return; // gate closed -> no sound cue

  mem.write8(SOUND_LATCH, 0x03); // gate open (25m/75m) -> cue the sound (3-frame assert)
}
