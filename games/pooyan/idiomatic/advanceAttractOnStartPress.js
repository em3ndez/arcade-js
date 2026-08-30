// SPDX-License-Identifier: GPL-3.0-only
import { IN0_PORT, ATTRACT_SUBSTATE, VIDEO_RAM_BASE } from "./names.js";
/**
 * advanceAttractOnStartPress — poll the start button during the attract loop and, on a
 * press, kick the attract sequence toward game start and blank the screen.
 *
 * ROM: 0x0c2a. Grounding: [code].
 *
 * ROLE. While the machine is showing its attract-mode demo, one of the attract handlers
 * watches the coin/start input port for the player pressing START. The start line sits
 * at IN0 (port 0xa080) bit 3, and like the rest of that port it is active-low: the bit
 * reads 1 while the button is up and drops to 0 while it is held. So a set bit means
 * "not pressed" and the routine returns, leaving the demo running; a clear bit means the
 * player has pressed START this frame and the routine commits to leaving attract.
 *
 * On that press it does two things. First it forces the attract sub-state (ATTRACT_SUBSTATE,
 * 0x8e51 — the selector the attract dispatcher steps through) to 9, the entry the sequence
 * uses to tear down the demo and hand off toward gameplay. Second it wipes the tile video
 * RAM (VIDEO_RAM_BASE, 0x8400) to the blank tile so the demo imagery clears before the
 * next screen paints. The fill covers 1023 of the page's 1024 cells — it stops one cell
 * short of the full tile page, matching the ROM's loop bound.
 *
 * LIVE-OUT: memory only — ATTRACT_SUBSTATE and the blanked tile RAM. A void poll; the
 * caller reads nothing back.
 */
const FILL_CELLS = 1023; // one short of the 1024-cell tile page — leaves the final cell untouched
const BLANK_TILE = 0x10; // the space/blank tile written into every cleared cell
const ATTRACT_START_SUBSTATE = 0x09; // sub-state the attract sequence jumps to on a start press

export function advanceAttractOnStartPress(m) {
  const { mem8 } = m;

  // IN0 bit 3 is the active-low START line: 1 = button up. While it is still set the
  // player has not pressed START, so do nothing and let the demo keep running.
  if ((mem8[IN0_PORT] & 0x08) !== 0) return;

  // START was pressed. Advance the attract dispatcher's selector to the game-start entry.
  mem8[ATTRACT_SUBSTATE] = ATTRACT_START_SUBSTATE;

  // Blank the tile video RAM so the attract demo clears before the next screen paints.
  for (let i = 0; i < FILL_CELLS; i++) mem8[VIDEO_RAM_BASE + i] = BLANK_TILE;
}
