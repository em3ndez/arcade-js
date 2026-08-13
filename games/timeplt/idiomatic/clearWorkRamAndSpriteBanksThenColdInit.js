// SPDX-License-Identifier: GPL-3.0-only
/** clearWorkRamAndSpriteBanksThenColdInit — cold-start clear: kick the watchdog, wipe two sprite-bank runs and the whole 2 KB of
 * work RAM, then fold a fixed program run into one total; anything but a genuine image's total runs
 * the frame service out of band, and either way it hands off to the screen-RAM clear and verify.
 * LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { clearScreenRamAndVerifyImageThenColdInit } from "./clearScreenRamAndVerifyImageThenColdInit.js";
import { saveAccumulatorForFrameInterrupt } from "./saveAccumulatorForFrameInterrupt.js";
import { PLAYER_STATE, SPRITE_BANK1_BASE, SPRITE_BANK1_SLOT0_Y, loc_c200, saveAccumulatorForFrameInterrupt_ADDR } from "./names.js";

const SPRITE_RUN_BYTES = 0x30;
const WORK_RAM_BYTES = 0x800;
const CHECK_BYTES = 0x100;
const GENUINE_TOTAL = 0x87;

export function clearWorkRamAndSpriteBanksThenColdInit(m) {
  const { mem8 } = m;

  mem8[loc_c200] = 0;
  for (let i = 0; i < SPRITE_RUN_BYTES; i++) mem8[u16(SPRITE_BANK1_SLOT0_Y + i)] = 0;
  mem8[loc_c200] = 0;
  for (let i = 0; i < SPRITE_RUN_BYTES; i++) mem8[u16(SPRITE_BANK1_BASE + i)] = 0;
  mem8[loc_c200] = 0;

  for (let i = 0; i < WORK_RAM_BYTES; i++) mem8[u16(PLAYER_STATE + i)] = 0;
  mem8[loc_c200] = 0;

  let total = 0;
  for (let i = 0; i < CHECK_BYTES; i++) total = u8(total + mem8[u16(saveAccumulatorForFrameInterrupt_ADDR + i)]);
  if (u8(total - GENUINE_TOTAL) !== 0) saveAccumulatorForFrameInterrupt(m);

  return clearScreenRamAndVerifyImageThenColdInit(m);
}
