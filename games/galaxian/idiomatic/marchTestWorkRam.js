// SPDX-License-Identifier: GPL-3.0-only
/**
 * marchTestWorkRam -- the power-on work-RAM test, then on into the video-RAM test.
 *
 * WHAT IT IS
 *   A pattern test over the 1KB of work RAM (0x4000-0x43ff). For each seed, counting down to 1, it writes a
 *   stepped pattern (each byte the previous + 0x2f, bumped by 1 at every page boundary, starting from the
 *   seed) and reads it back. Changing the seed each pass shifts every cell's value, so a stuck or shorted
 *   bit cannot survive all passes. The watchdog is kicked after each verified pass.
 *
 * ROLE IN THE MACHINE
 *   Reached from the hardware wipe with 32 seeds. A read-back mismatch means a real RAM fault, which cannot
 *   happen on good hardware; it is raised as an error by name rather than reproduced as the diagnostic
 *   screen. When every pass is clean it runs the same test over video RAM.
 *
 *   The pattern helpers are shared with the video-RAM test.
 *
 * ROM 0x1a9a (through 0x1ac9).  Grounding: [seen]. Cells: WORK_RAM_BASE (0x4000), WATCHDOG_RESET (0x7800).
 *
 * LIVE-OUT: work RAM holds the seed-1 pattern; one watchdog kick per pass; returns the main-loop generator.
 */
import { WORK_RAM_BASE, WATCHDOG_RESET } from "./names.js";
import { marchTestVideoRam } from "./marchTestVideoRam.js";

const TESTED_PAGES = 4;
const PAGE = 0x100;
const PATTERN_STEP = 0x2f;
const VIDEO_TEST_SEEDS = 32;

/** Write the stepped pattern for `seed` across four pages from `base`. */
export function writeMarchPattern(m, base, seed) {
  const { mem8 } = m;
  let v = seed;
  for (let page = 0; page < TESTED_PAGES; page++) {
    for (let i = 0; i < PAGE; i++) {
      v = (v + PATTERN_STEP) & 0xff;
      mem8[base + page * PAGE + i] = v;
    }
    v = (v + 1) & 0xff; // the pattern shifts by one at every page boundary
  }
}

/** Read the same pattern back; a mismatch is a hardware RAM fault. */
export function verifyMarchPattern(m, base, seed, what) {
  const { mem8 } = m;
  let v = seed;
  for (let page = 0; page < TESTED_PAGES; page++) {
    for (let i = 0; i < PAGE; i++) {
      v = (v + PATTERN_STEP) & 0xff;
      const at = base + page * PAGE + i;
      if (mem8[at] !== v) throw new Error(`${what} test: read-back mismatch at ${at.toString(16)} (RAM fault, unreachable on good RAM)`);
    }
    v = (v + 1) & 0xff;
  }
}

export function marchTestWorkRam(m, seeds = m.regs.c) {
  // The seed counts down to 0 in 8 bits, so a count of 0 runs all 256 seeds.
  let seed = seeds & 0xff;
  do {
    writeMarchPattern(m, WORK_RAM_BASE, seed);
    verifyMarchPattern(m, WORK_RAM_BASE, seed, "work RAM");
    void m.mem8[WATCHDOG_RESET]; // kick the watchdog once the pass is verified
    seed = (seed - 1) & 0xff;
  } while (seed !== 0);

  return marchTestVideoRam(m, VIDEO_TEST_SEEDS);
}
