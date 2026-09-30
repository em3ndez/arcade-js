// SPDX-License-Identifier: GPL-3.0-only
/**
 * checksumRomAndSeedWorkRam -- verify the program ROM, lay down the initial work RAM, start the machine.
 *
 * WHAT IT IS
 *   The last stage of power-on. It blanks the screen, sums the 10KB program ROM (0x0000-0x27ff) byte by
 *   byte in 8 bits (the ROM is built so the sum is 0), and then seeds work RAM: everything below the stack
 *   area is zeroed except the 64-byte command-queue ring at 0x40c0, whose slots are filled with 0xff (free).
 *   It clears the screen flips and the direction flag 0x4018, sets the self-test mode to 3 (the object-RAM
 *   colour-ramp pass the vblank interrupt runs next), arms the 0x4008 pass counter to 32, points both the
 *   command-queue write head and the display-list read cursor at the ring floor 0xc0, turns the starfield
 *   on, and finally enables the vblank interrupt.
 *   The original also stores 0 to 0x7005 and 1 to 0x7002/0x7003; no device on the board decodes those addresses, so they are left out.
 *
 * ROLE IN THE MACHINE
 *   Reached when the video-RAM test passes. A non-zero checksum means a bad ROM, which a verified image
 *   cannot produce; it is raised as an error by name rather than reproduced as the diagnostic screen. The
 *   top 0x60 bytes (0x43a0-0x43ff) are not seeded and keep the RAM test's last pattern. From here control passes to the main loop
 *   for good.
 *
 * ROM 0x1b70 (through 0x1bcc).  Grounding: [seen]. Cells: WORK_RAM_BASE (0x4000), IRQ_ENABLE (0x7001),
 * FLIP_SCREEN_X/Y (0x7006/7), loc_4018, WATCHDOG_RESET (0x7800), loc_4008, SELFTEST_MODE (0x401a),
 * loc_40a0, DISPLAY_LIST_CURSOR (0x40a1), STARS_ENABLE (0x7004).
 *
 * LIVE-OUT: memory and the hardware latches above; returns the main-loop generator.
 */
import {
  WORK_RAM_BASE, WATCHDOG_RESET, IRQ_ENABLE, FLIP_SCREEN_X, FLIP_SCREEN_Y, STARS_ENABLE, SELFTEST_MODE,
  DISPLAY_LIST_CURSOR, loc_4018, loc_4008, loc_40a0,
} from "./names.js";
import { blankVideoRam } from "./blankVideoRam.js";
import { fillMemoryBlock } from "./fillMemoryBlock.js";
import { enterMainLoop } from "./enterMainLoop.js";

const ROM_PAGES = 0x28;
const PAGE = 0x100;
const QUEUE_FREE = 0xff;
const QUEUE_FLOOR = 0xc0;
const SELFTEST_OBJRAM_RAMP = 3;
const SELFTEST_PASSES = 0x20;

// Work RAM below the stack, as consecutive [length, value] spans from WORK_RAM_BASE: low RAM, the queue
// ring, then the rest up to 0x43a0.
const WORK_RAM_SPANS = [[0xc0, 0], [0x40, QUEUE_FREE], [0x100, 0], [0x100, 0], [0xa0, 0]];

export function checksumRomAndSeedWorkRam(m) {
  const { mem8 } = m;

  blankVideoRam(m);

  let sum = 0;
  for (let page = 0; page < ROM_PAGES; page++) {
    for (let i = 0; i < PAGE; i++) sum = (sum + mem8[page * PAGE + i]) & 0xff;
    void mem8[WATCHDOG_RESET]; // kick the watchdog after each page
  }
  if (sum !== 0) throw new Error(`program ROM checksum is ${sum}, not 0 (bad ROM, unreachable on a verified image)`);

  let at = WORK_RAM_BASE;
  for (const [length, value] of WORK_RAM_SPANS) {
    fillMemoryBlock(m, at, value, length & 0xff); // a 256-byte span is a count of 0
    at += length;
  }

  mem8[IRQ_ENABLE] = 0;
  mem8[FLIP_SCREEN_X] = 0;
  mem8[FLIP_SCREEN_Y] = 0;
  mem8[loc_4018] = 0;
  void mem8[WATCHDOG_RESET];

  mem8[loc_4008] = SELFTEST_PASSES;
  mem8[SELFTEST_MODE] = SELFTEST_OBJRAM_RAMP;
  mem8[loc_40a0] = QUEUE_FLOOR;
  mem8[DISPLAY_LIST_CURSOR] = QUEUE_FLOOR;

  mem8[STARS_ENABLE] = 1;
  mem8[IRQ_ENABLE] = 1; // the vblank interrupt runs from here on

  return enterMainLoop(m);
}
