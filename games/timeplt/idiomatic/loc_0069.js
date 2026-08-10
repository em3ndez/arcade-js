// SPDX-License-Identifier: GPL-3.0-only
/** loc_0069 — cold-start clear: kick the watchdog, wipe two sprite-bank runs and the whole 2 KB of
 * work RAM, then fold a fixed program run into one total; anything but a genuine image's total runs
 * the frame service out of band, and either way it hands off to the screen-RAM clear and verify.
 * LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { clearScreenRamAndVerifyImageThenColdInit } from "./clearScreenRamAndVerifyImageThenColdInit.js";
import { loc_00d8 } from "./loc_00d8.js";

const WATCHDOG = 0xc200;
const SPRITE_RUN_HIGH = 0xb411;
const SPRITE_RUN_LOW = 0xb410;
const SPRITE_RUN_BYTES = 0x30;
const WORK_RAM = 0xa800;
const WORK_RAM_BYTES = 0x800;
const CHECK_BLOCK = 0x00d8;
const CHECK_BYTES = 0x100;
const GENUINE_TOTAL = 0x87;

export function loc_0069(m) {
  const { mem8 } = m;

  mem8[WATCHDOG] = 0;
  for (let i = 0; i < SPRITE_RUN_BYTES; i++) mem8[u16(SPRITE_RUN_HIGH + i)] = 0;
  mem8[WATCHDOG] = 0;
  for (let i = 0; i < SPRITE_RUN_BYTES; i++) mem8[u16(SPRITE_RUN_LOW + i)] = 0;
  mem8[WATCHDOG] = 0;

  for (let i = 0; i < WORK_RAM_BYTES; i++) mem8[u16(WORK_RAM + i)] = 0;
  mem8[WATCHDOG] = 0;

  let total = 0;
  for (let i = 0; i < CHECK_BYTES; i++) total = u8(total + mem8[u16(CHECK_BLOCK + i)]);
  if (u8(total - GENUINE_TOTAL) !== 0) loc_00d8(m);

  return clearScreenRamAndVerifyImageThenColdInit(m);
}
