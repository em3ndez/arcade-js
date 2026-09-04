// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SHIELD_SAVE_RESTORE_MODE, SHIELD_VRAM_BASE, DRAW_BLOCK_STRIDE } from "./names.js";
import { captureScreenRect } from "./captureScreenRect.js";
import { orBlitBitmap } from "./orBlitBitmap.js";

// drawOrSaveShields — the shared body that either SAVES the four bunker shields off the screen or
// RESTORES them back onto it, chosen by a mode flag.
//
// WHAT IT IS
//   Walks the four on-screen bunkers, one block per pass. Each block is a 0x16-column by 2-byte screen
//   rectangle (0x2c bytes — the same size as one shield-buffer slot). The caller's A byte picks the
//   direction: nonzero = SAVE (capture the screen rectangle into the buffer at DE), zero = RESTORE
//   (OR-merge the buffer bitmap back onto the screen). Successive blocks sit DRAW_BLOCK_STRIDE apart.
//
// ROLE IN THE MACHINE
//   The direction byte is recorded in SHIELD_SAVE_RESTORE_MODE (0x2081) and re-read every pass. Video
//   walk starts at SHIELD_VRAM_BASE (0x2806); each block advances by DRAW_BLOCK_STRIDE (0x02e0) — which
//   works out to 0x17 columns, the on-screen spacing between the four bunkers. On a SAVE, captureScreenRect
//   gathers the B-column-by-C-byte rectangle into the contiguous buffer stream (DE); on a RESTORE, orBlitBitmap
//   ORs the stored bitmap back so the bunkers reappear without wiping the background under them. The four
//   public entries fix the direction and the buffer: savePlayer1/2Shields force A=1 (save) and
//   restorePlayer1/2Shields force A=0 (restore), each seating DE at its player's buffer base first. These
//   fire around the player switch / round setup, so each player's accumulated bunker damage persists
//   across turns.
//
// ROM 0x021e.  Grounding: [seen].
//
// LIVE-OUT: HL/DE advanced by the last block's copy; no caller reads them back — the effect is in memory
// (the buffer on a save, video RAM on a restore).
export function drawOrSaveShields(m, a = m.regs.a, de = m.regs.de) {
  // Record the direction byte where every pass re-reads it. The ROM re-reads the flag each block rather
  // than branching once, so it is stored to RAM (0x2081) up front, not just held in a register.
  m.mem8[SHIELD_SAVE_RESTORE_MODE] = a;
  // Block geometry: 0x16 columns wide by 2 bytes tall == 0x2c bytes, matching one shield-buffer slot and one
  // template copy. HL starts at the first bunker's screen rectangle.
  const rows = 0x16, cols = 0x02;
  let hl = SHIELD_VRAM_BASE;
  for (let pass = 0; ; pass++) {
    // Re-read the mode each pass and branch. SAVE: pull the screen rectangle into the buffer (DE advances
    // through the contiguous byte stream, HL to the next screen column base). RESTORE: OR the buffer's
    // bitmap onto the screen. captureScreenRect returns [de, hl]; orBlitBitmap returns [hl, de] — hence
    // the swapped destructuring so `hl` always tracks the screen pointer.
    if (m.mem8[SHIELD_SAVE_RESTORE_MODE] !== 0) {
      [de, hl] = captureScreenRect(m, hl, de, rows, cols);
    } else {
      [hl, de] = orBlitBitmap(m, hl, de, rows, cols);
    }
    // Four bunkers total: stop after the fourth block (pass 3) BEFORE adding another stride, so HL is not
    // walked past the last bunker.
    if (pass === 3) break;
    // Step HL to the next bunker's screen origin — 0x02e0 further down, i.e. 0x17 columns over.
    hl = u16(hl + DRAW_BLOCK_STRIDE);
  }
}
