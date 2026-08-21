// SPDX-License-Identifier: GPL-3.0-only
import { loc_0010 } from "./loc_0010.js";
import { SPRITE1_CLEAR_BASE, SPRITE0_CLEAR_BASE, VIDEO_RAM_BLANK_START } from "./names.js";
/**
 * loc_01ea — boot clear: fill the top of both sprite banks with the incoming byte, then blank
 * the lower video-RAM tile region to the erase tile. The original follows this with a
 * cycle-burning settle delay (kicking the hardware watchdog once per pass); that spends only
 * time and touches no game state, so the cycle-free layer drops it.
 *
 * LIVE-OUT: none — a boot init whose caller reloads every register on return.
 */

const BANK_CLEAR_LEN = 0x30; // bytes cleared at the top of each sprite bank
const BLANK_TILE = 0x1e; //     erase tile written across the video region
const BLANK_LEN = 0x3c0; //     tiles blanked, from the start through the end of video RAM

export function loc_01ea(m, fill = m.regs.a) {
  const { mem8 } = m;
  loc_0010(m, SPRITE1_CLEAR_BASE, fill, BANK_CLEAR_LEN);
  loc_0010(m, SPRITE0_CLEAR_BASE, fill, BANK_CLEAR_LEN);
  for (let i = 0; i < BLANK_LEN; i++) mem8[VIDEO_RAM_BLANK_START + i] = BLANK_TILE;
}
