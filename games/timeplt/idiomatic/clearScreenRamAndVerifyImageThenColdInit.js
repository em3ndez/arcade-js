// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearScreenRamAndVerifyImageThenColdInit — cold-start clear, then verify the program image and hand off to init.
 * Fills colour RAM with 0x10 and video RAM with 0xf1 (bases from two image pointers), then sums the
 * program image and subtracts the stored total: zero hands off to init, else derails into data.
 * LIVE-OUT: the two fills and the watchdog kicks (after fill one, then once per summed byte), then the handoff.
 */

import { initColdStartRamThenSeedConfig } from "./initColdStartRamThenSeedConfig.js";
import { trampolineToSeatTheStackAndSettleTheControlLatch_ADDR, COLOUR_RAM_BASE_WORD, VIDEO_RAM_BASE_WORD, loc_59d7, WATCHDOG_RESET } from "./names.js";

const COLOUR_FILL = 0x10;
const VIDEO_FILL = 0xf1;
const FILL_BYTES = 0x400;
const FIRST_PAGE_PAST_ROM = 0x60;
const GENUINE_TOTAL = 0xaf;

const u8 = (x) => x & 0xff;
const u16 = (x) => x & 0xffff;

export function clearScreenRamAndVerifyImageThenColdInit(m) {
  const { mem8, mem16 } = m;

  const colourBase = mem16[COLOUR_RAM_BASE_WORD];
  for (let i = 0; i < FILL_BYTES; i++) mem8[u16(colourBase + i)] = COLOUR_FILL;
  mem8[WATCHDOG_RESET] = 0;

  const videoBase = mem16[VIDEO_RAM_BASE_WORD];
  for (let i = 0; i < FILL_BYTES; i++) mem8[u16(videoBase + i)] = VIDEO_FILL;

  let addr = trampolineToSeatTheStackAndSettleTheControlLatch_ADDR;
  let total = mem8[trampolineToSeatTheStackAndSettleTheControlLatch_ADDR];
  for (;;) {
    total = u8(total + mem8[addr]);
    addr = u16(addr + 1);
    if (((addr >> 8) & 0xff) >= FIRST_PAGE_PAST_ROM) break;
    mem8[WATCHDOG_RESET] = total; // ⚠ the watchdog port ignores this value; only the kick counts
  }

  if (u8(total - GENUINE_TOTAL) !== 0) return m.call(loc_59d7);
  return initColdStartRamThenSeedConfig(m);
}
