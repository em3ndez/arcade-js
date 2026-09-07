// SPDX-License-Identifier: GPL-3.0-only
/**
 * scanObjRamTestRampAndFinishSelfTest — verify half of the power-on OBJRAM RAM test, and its finish.
 *
 * WHAT IT IS
 *   The read-back/verify partner of fillObjRamTestRamp (ROM 0x1be3). The fill half wrote a stepped colour
 *   ramp across the 256-byte object hardware page (cell i = seed + i*0x2f, mod 256); this half re-walks the
 *   identical ramp and asserts every OBJRAM cell reads back exactly. A mismatch means a stuck or shorted
 *   sprite-RAM line — a genuine RAM fault — and cannot happen on good hardware, so it is raised as a hard
 *   error rather than reproduced as a branch. On a clean pass it pets the watchdog, advances the PRNG, and
 *   counts the self-test passes down; on the last owed pass it clears OBJRAM and seeds the machine into the
 *   next boot phase.
 *
 * ROLE IN THE MACHINE
 *   ROM 0x1bed, tail-reached from fillObjRamTestRamp with the seed reloaded from RNG_SEED. During boot the
 *   frame is diverted whenever SELFTEST_MODE (0x401a) is non-zero: dispatchSelfTestMode (0x1bcd) is a
 *   one-of-four dispatch, and mode value 3 falls through the fill into this scan (mechanisms.md "The
 *   alternate per-frame path"). loc_4008 is the remaining-pass counter; only its final decrement runs the
 *   OBJRAM clear + boot-phase seeding tail.
 *
 *   Grounding: [seen].
 *
 * LIVE-OUT: memory/hardware only — on the final pass OBJRAM is zeroed and a block of boot flags/lamps is
 * latched (SELFTEST_MODE, both start lamps, COIN_LOCKOUT, FRAME_COUNTER, OBJECT_DRAW_SUPPRESS) plus two
 * seed glyphs in VRAM; throws on a RAM fault. No register result the caller reads.
 */
import { OBJRAM_HW_BASE, WATCHDOG_RESET, VRAM_BASE, SELFTEST_MODE, FRAME_COUNTER, OBJECT_DRAW_SUPPRESS,
  START_LAMP_0, START_LAMP_1, COIN_LOCKOUT, loc_4008, loc_4006, loc_4226 } from "./names.js";
import { advanceRandomSeed } from "./advanceRandomSeed.js";

// The colour step laid between successive OBJRAM cells — the same +0x2f the fill half wrote, so no two
// adjacent cells share a value and the exact pattern can be re-derived here for the comparison.
const RAMP_STEP = 0x2f;

export function scanObjRamTestRampAndFinishSelfTest(m, seed = m.regs.a) {
  const { mem8 } = m;
  // The ramp starts at the seed byte handed in via A (the PRNG value reloaded by the fill half).
  let v = seed & 0xff;
  // Re-walk all 256 OBJRAM cells: each must read back the running colour exactly. A mismatch is a stuck/
  // shorted sprite-RAM line — a real RAM fault, unreachable on good RAM — so fail loudly instead of masking.
  for (let i = 0; i < 0x100; i++) {
    if (mem8[OBJRAM_HW_BASE + i] !== v) throw new Error(`self-test ramp mismatch at OBJRAM+${i} (RAM fault, unreachable on good RAM)`);
    v = (v + RAMP_STEP) & 0xff;
  }
  void mem8[WATCHDOG_RESET]; // kick the watchdog
  // Advance the LCG PRNG so the next self-test pass paints (and checks) a differently-seeded ramp.
  advanceRandomSeed(m);
  // Count one self-test pass off the remaining-pass counter (wrapping in 8 bits).
  const remaining = (mem8[loc_4008] - 1) & 0xff;
  mem8[loc_4008] = remaining;
  if (remaining !== 0) return; // more self-test passes owed

  // Final pass: wipe OBJRAM back to zero now that the RAM has proven good.
  for (let i = 0; i < 0x100; i++) mem8[OBJRAM_HW_BASE + i] = 0;
  // Seed the machine into the next boot phase — latch the boot flags, both start-button lamps, the coin
  // lockout, and the object-draw suppress (bit0 gates the object-figure grid draw off during VRAM fills).
  mem8[loc_4006] = 1;
  mem8[SELFTEST_MODE] = 1;
  mem8[START_LAMP_0] = 1;
  mem8[START_LAMP_1] = 1;
  mem8[COIN_LOCKOUT] = 1;
  mem8[loc_4226] = 1;
  mem8[FRAME_COUNTER] = 1;
  mem8[OBJECT_DRAW_SUPPRESS] = 1;
  // Stamp two specific tile glyphs into the character map to prime the boot display.
  mem8[VRAM_BASE + 0x213] = 0x1f;
  mem8[VRAM_BASE + 0x1f3] = 0x1b;
}
