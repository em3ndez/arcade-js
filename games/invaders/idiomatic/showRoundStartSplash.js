// SPDX-License-Identifier: GPL-3.0-only
import { drawSpriteList } from "./drawSpriteList.js";
import { drawSprite8x8 } from "./drawSprite8x8.js";
import { currentPlayerRecordPtr } from "./currentPlayerRecordPtr.js";
import { drawScoreRecord } from "./drawScoreRecord.js";
import { clearScreenStrip } from "./clearScreenStrip.js";
import { ACTIVE_PLAYER_PAGE, FRAME_DELAY_TIMER, ROUND_START_BANNER_TEXT, ROUND_START_SPLASH_VRAM, ROUND_START_EXTRA_SPRITE_VRAM, PLAYER1_SCORE_STRIP_VRAM, loc_391c } from "./names.js";

/**
 * showRoundStartSplash — the "PLAY PLAYER<n>" round-start banner with a flashing score.
 *
 * WHAT IT IS
 *   Paints the fixed round-start banner sprite row, adds one extra sprite for player 2, then holds for
 *   0xb0 (176) displayed frames. During the hold the active player's score flashes on and off in step
 *   with the frame counter, giving the familiar blinking round-start splash.
 *
 * ROLE IN THE MACHINE
 *   The first stage of the round-start chain startRoundFlow feeds (mechanisms.md, the in-game frame
 *   loop). drawSpriteList blits 0x0e (14) consecutive sprite ids from the ROM strip ROUND_START_BANNER_TEXT to the
 *   screen at ROUND_START_SPLASH_VRAM (the banner); when ACTIVE_PLAYER_PAGE (0x2067) bit0 is clear (player 2) it draws
 *   one more sprite (id 0x1c) at ROUND_START_EXTRA_SPRITE_VRAM. FRAME_DELAY_TIMER (0x20c0) is seeded to 0xb0 and drained one
 *   per frame by the vblank interrupt, so this generator yields once per displayed frame and the loop
 *   ends when the counter hits 0. The flash is driven by bit 2 of that counter: while bit 2 is set the
 *   score strip is blanked (clearScreenStrip over a 0x20-wide strip at PLAYER1_SCORE_STRIP_VRAM for player 1 / loc_391c
 *   for player 2), and while it is clear the active player's score is repainted (drawScoreRecord on
 *   currentPlayerRecordPtr) -- so the score toggles every 4 frames. Mirrors ROM routine loc_088d
 *   (0x088d-0x08ce). Grounding: [seen] leaf routines; the splash is described in mechanisms.md.
 *
 * LIVE-OUT: memory + IO; yields one frame per pass until the counter drains.
 */
export function* showRoundStartSplash(m) {
  // Lay down the banner: 14 sprite ids from the ROM strip ROUND_START_BANNER_TEXT onto the screen at ROUND_START_SPLASH_VRAM...
  drawSpriteList(m, ROUND_START_BANNER_TEXT, 0x0e, ROUND_START_SPLASH_VRAM);
  // ...and one extra sprite (id 0x1c) at ROUND_START_EXTRA_SPRITE_VRAM when the active page is player 2 (bit0 clear).
  if (!(m.mem8[ACTIVE_PLAYER_PAGE] & 1)) drawSprite8x8(m, 0x1c, ROUND_START_EXTRA_SPRITE_VRAM);
  // Seed the vblank-drained frame counter to 0xb0 frames; the interrupt decrements it each frame.
  m.mem8[FRAME_DELAY_TIMER] = 0xb0;
  while (m.mem8[FRAME_DELAY_TIMER] !== 0) {
    if (m.mem8[FRAME_DELAY_TIMER] & 0x04) {
      // Counter bit 2 set: blank the score strip (player 1 at PLAYER1_SCORE_STRIP_VRAM, player 2 at loc_391c) -- the
      // "off" half of the flash.
      const addr = (m.mem8[ACTIVE_PLAYER_PAGE] & 1) ? PLAYER1_SCORE_STRIP_VRAM : loc_391c;
      clearScreenStrip(m, 0x20, addr);
    } else {
      // Counter bit 2 clear: repaint the active player's score -- the "on" half of the flash.
      drawScoreRecord(m, currentPlayerRecordPtr(m));
    }
    // Hold one displayed frame; the interrupt drains FRAME_DELAY_TIMER while we are suspended.
    yield;
  }
}
