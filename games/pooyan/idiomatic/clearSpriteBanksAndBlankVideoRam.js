// SPDX-License-Identifier: GPL-3.0-only
import { fillByteRun } from "./fillByteRun.js";
import { SPRITE1_CLEAR_BASE, SPRITE0_CLEAR_BASE, VIDEO_RAM_BLANK_START } from "./names.js";
/**
 * clearSpriteBanksAndBlankVideoRam — one of the power-on init steps that wipes the display
 * hardware to a known-empty picture before the first frame is ever built.
 *
 * WHAT IT IS
 *   ROM 0x01EA-0x020E. Grounding: [seen].
 *   Two things happen here, both driven by the byte handed in through A (`fill`):
 *     1. the working tops of BOTH sprite banks are flooded with that byte, and
 *     2. the tile-code plane of video RAM is painted over with the blank/erase tile.
 *   Together these guarantee that when the machine first lets the display run, there is no
 *   leftover garbage on screen — no stray sprite from an unrelated cell, no random tile in
 *   the playfield — only a clean field that the game logic then draws onto.
 *
 * ITS ROLE IN THE MACHINE
 *   The display is built from two independent devices. Moving objects live in two 256-byte
 *   sprite banks (bank 0 at 0x9000, bank 1 at 0x9400); the hardware reads a sprite's two
 *   halves from the SAME offset in the two banks and walks the active records from offset
 *   0x10 upward. The static picture lives in the tile-code plane of video RAM (0x8400-0x87FF),
 *   one tile byte per cell of the 32x32 grid. There is no video-enable line on this board —
 *   the screen is always scanned out — so anything left in those two devices at power-on would
 *   be visible immediately. This routine is what makes the very first scanned frame blank.
 *
 * THE DROPPED SETTLE DELAY
 *   After the two clears the original spends a long 256x256 nested countdown doing nothing but
 *   burning time, petting the hardware watchdog once per outer pass so the board does not reset
 *   during the wait. That loop moves no game state — it only lets things settle — so the
 *   cycle-free layer omits it entirely.
 *
 * LIVE-OUT: none — a boot init whose caller reloads every register on return.
 */

// The three shapes of the wipe. All are fixed constants baked into the boot code.
const BANK_CLEAR_LEN = 0x30; // bytes cleared at the top of each sprite bank (covers the active record window that begins at offset 0x10)
const BLANK_TILE = 0x1e; //     the erase tile code — the "nothing here" cell the whole playfield is painted with
const BLANK_LEN = 0x3c0; //     cells blanked: the full tile plane from 0x40 in through its end at 0x87ff

export function clearSpriteBanksAndBlankVideoRam(m, fill = m.regs.a) {
  const { mem8 } = m;

  // --- Sprite banks: erase the working record window in both banks ---------------------------
  // Each bank's live records start at offset 0x10; flooding 0x30 bytes from there with `fill`
  // wipes the region the per-frame sprite copy will later populate, so no half-written or stale
  // record can flicker on screen before the first real display list is staged. Bank 1 first
  // (SPRITE1_CLEAR_BASE = 0x9410), then bank 0 (SPRITE0_CLEAR_BASE = 0x9010); the two halves of
  // every sprite record sit at matching offsets across the banks, so both must be cleared.
  fillByteRun(m, SPRITE1_CLEAR_BASE, fill, BANK_CLEAR_LEN);
  fillByteRun(m, SPRITE0_CLEAR_BASE, fill, BANK_CLEAR_LEN);

  // --- Video RAM: blank the playfield tile plane ---------------------------------------------
  // Paint the erase tile (0x1e) across the tile-code plane, starting 0x40 cells into it
  // (VIDEO_RAM_BLANK_START = 0x8440) and running 0x3c0 cells through the end of video RAM at
  // 0x87ff. This leaves every playfield cell showing the blank tile, a uniform empty background
  // the game logic then overwrites cell by cell as it builds each screen.
  for (let i = 0; i < BLANK_LEN; i++) mem8[VIDEO_RAM_BLANK_START + i] = BLANK_TILE;
}
