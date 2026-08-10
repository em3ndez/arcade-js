// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearScreenRamAndVerifyImageThenColdInit — cold-start clear, then verify the program image and hand off to init.
 * Fills colour RAM with 0x10 and video RAM with 0xf1 (bases from two image pointers), then sums the
 * program image and subtracts the stored total: zero hands off to init, else derails into data.
 * LIVE-OUT: the two fills and the watchdog kicks (after fill one, then once per summed byte), then the handoff.
 */

import { initColdStartRamThenSeedConfig } from "./initColdStartRamThenSeedConfig.js";

const COLOUR_FILL = 0x10;
const VIDEO_FILL = 0xf1;
const FILL_BYTES = 0x400;
const WATCHDOG = 0xc200;
const COLOUR_BASE_PTR = 0x2581;
const VIDEO_BASE_PTR = 0x4a37;
const FIRST_PAGE_PAST_ROM = 0x60;
const GENUINE_TOTAL = 0xaf;
const DERAIL = 0x59d7;

const u8 = (x) => x & 0xff;
const u16 = (x) => x & 0xffff;

export function clearScreenRamAndVerifyImageThenColdInit(m) {
  const { mem8, mem16 } = m;

  const colourBase = mem16[COLOUR_BASE_PTR];
  for (let i = 0; i < FILL_BYTES; i++) mem8[u16(colourBase + i)] = COLOUR_FILL;
  mem8[WATCHDOG] = 0;

  const videoBase = mem16[VIDEO_BASE_PTR];
  for (let i = 0; i < FILL_BYTES; i++) mem8[u16(videoBase + i)] = VIDEO_FILL;

  let addr = 0x0000;
  let total = mem8[0x0000];
  for (;;) {
    total = u8(total + mem8[addr]);
    addr = u16(addr + 1);
    if (((addr >> 8) & 0xff) >= FIRST_PAGE_PAST_ROM) break;
    mem8[WATCHDOG] = total; // ⚠ the watchdog port ignores this value; only the kick counts
  }

  if (u8(total - GENUINE_TOTAL) !== 0) return m.call(DERAIL);
  return initColdStartRamThenSeedConfig(m);
}
