// SPDX-License-Identifier: GPL-3.0-only
/**
 * marchTestVideoRam -- the power-on video-RAM test, then on into the ROM checksum.
 *
 * WHAT IT IS
 *   The same stepped-pattern test as the work-RAM one, run over the 1KB tilemap (0x5000-0x53ff): for each
 *   seed down to 1, write the pattern, kick the watchdog, read it back, kick the watchdog again.
 *
 * ROLE IN THE MACHINE
 *   Reached from the work-RAM test with 32 seeds. A read-back mismatch is a real RAM fault and is raised as
 *   an error by name. When every pass is clean it moves on to the ROM checksum, which also blanks the
 *   pattern off the screen.
 *
 * ROM 0x1aca (through 0x1afa).  Grounding: [seen]. Cells: VRAM_BASE (0x5000), WATCHDOG_RESET (0x7800).
 *
 * LIVE-OUT: VRAM holds the seed-1 pattern; two watchdog kicks per pass; returns the main-loop generator.
 */
import { VRAM_BASE, WATCHDOG_RESET } from "./names.js";
import { writeMarchPattern, verifyMarchPattern } from "./marchTestWorkRam.js";
import { checksumRomAndSeedWorkRam } from "./checksumRomAndSeedWorkRam.js";

export function marchTestVideoRam(m, seeds = m.regs.c) {
  // The seed counts down to 0 in 8 bits, so a count of 0 runs all 256 seeds.
  let seed = seeds & 0xff;
  do {
    writeMarchPattern(m, VRAM_BASE, seed);
    void m.mem8[WATCHDOG_RESET]; // kick between the write and the read-back
    verifyMarchPattern(m, VRAM_BASE, seed, "video RAM");
    void m.mem8[WATCHDOG_RESET];
    seed = (seed - 1) & 0xff;
  } while (seed !== 0);

  return checksumRomAndSeedWorkRam(m);
}
