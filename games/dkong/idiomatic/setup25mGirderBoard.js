// SPDX-License-Identifier: GPL-3.0-only
/**
 * setup25mGirderBoard — the 25m (board 1) board-setup arm: select the 25m girder layout
 * table, queue the 25m background tune, then hand off to the shared board-setup tail.  ROM 0x0CD4.
 *
 * One of four sibling arms the in-game board-setup dispatcher selects on the board
 * type; this is the 25m (girder) arm. It does two things and then converges on the
 * tail all four arms share:
 *
 *   1. Point the layout selector at the 25m girder table in ROM. The shared tail
 *      walks that table to draw the board's girders and ladders.
 *   2. Queue the 25m background tune for the sound driver to start.
 *
 * The 25m sibling of setup50mConveyorBoard / setUp75mBoard; the 100m arm is the loc_0cb6
 * fall-through. Then it hands off to loc_0cc6 — the tail every arm converges on (walk the selected
 * table into the playfield, the 100m-only rivet stamp, and the rest of board setup).
 * loc_0cc6's eventual return is this routine's return; nothing is done after it.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0cd4.test.js.
 * GATE:     crafted-entry — attract builds the 25m board, so it dispatches 0x0CD4
 *           naturally (the board-1 setup arm); every real dispatch is replayed
 *           against the oracle through the whole shared tail. Teeth: the wrong tune
 *           queued and the wrong layout table selected — each caught in game-visible
 *           RAM (the tune latch / the drawn tilemap) after the tail runs.
 * LIVE-OUT: memory-only. Reached by a tail hand-off from the board-setup dispatcher,
 *           whose caller consumes no return value. The layout-table pointer is a
 *           register live-IN handed to the shared tail (the tail's record walk reads
 *           it from the register image), not a live-out of this routine. SP/pc are the
 *           dropped stack model (the oracle's tail jump becomes a direct JS call).
 * NAMES:    SND_BGM (0x6089) from ram.js — the background-tune latch source. The ROM
 *           layout-table address stays hex (a ROM data pointer, not work RAM).
 */

import { loc_0cc6 } from "./loc_0cc6.js"; // ROM 0x0CC6 — the shared board-setup tail
import { SND_BGM } from "./ram.js";

// The 25m girder layout table in ROM; the shared tail (drawBoardLayout, reached through
// loc_0cc6) walks it as a 0xAA-terminated list of girder/ladder segment records.
const LAYOUT_TABLE_25M = 0x3ae4;

export function setup25mGirderBoard(m) {
  const { regs, mem } = m;

  // Select the 25m girder layout table for the shared tail to walk. The tail's record
  // walk reads this pointer from the register image, so hand it over there — it is a
  // register live-in to the tail, not a value this routine keeps.
  regs.de = LAYOUT_TABLE_25M;

  // Queue the 25m background tune for the sound driver.
  mem.write8(SND_BGM, 8);

  // Hand off to the shared board-setup tail; its return is this routine's return.
  loc_0cc6(m);
}
