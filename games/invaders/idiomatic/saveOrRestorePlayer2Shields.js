// SPDX-License-Identifier: GPL-3.0-only
import { drawOrSaveShields } from "./drawOrSaveShields.js";
import { PLAYER2_SHIELD_BUFFER } from "./names.js";

/**
 * saveOrRestorePlayer2Shields — run the shared shield save/restore for player 2's buffer.
 *
 * WHAT IT IS
 *   A thin seater: it points the shield-buffer base at player 2's backup buffer and hands off to the
 *   common four-block shield body, which either captures the four on-screen bunkers into the buffer or
 *   paints them back — the direction chosen by the caller's mode byte.
 *
 * ROLE IN THE MACHINE
 *   Each player owns a bunker backup buffer inside their own RAM page; player 2's is PLAYER2_SHIELD_BUFFER
 *   (0x2242) (see mechanisms.md "Shields"). drawOrSaveShields (0x021e) records the caller's A into the
 *   mode flag SHIELD_SAVE_RESTORE_MODE and walks four 0x16-column-by-2-byte screen rectangles from
 *   SHIELD_VRAM_BASE, DRAW_BLOCK_STRIDE apart: A nonzero = SAVE (captureScreenRect into the buffer),
 *   A zero = RESTORE (orBlitBitmap back onto the screen). The direction-forcing entries savePlayer2Shields
 *   (A=1) and restorePlayer2Shields (A=0) reach the shared body through this seater; it fires around the
 *   player switch and round setup so player 2's accumulated bunker damage persists across turns.
 *
 * ROM 0x0214.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: memory only — the buffer on a save, or video RAM on a restore. `a` (the mode) defaults from
 *   the register when the caller omits it.
 */
export function saveOrRestorePlayer2Shields(m, a = m.regs.a) {
  // Seat DE at player 2's shield buffer base, then save-or-draw the four shield blocks per the mode in A.
  drawOrSaveShields(m, a, PLAYER2_SHIELD_BUFFER);
}
