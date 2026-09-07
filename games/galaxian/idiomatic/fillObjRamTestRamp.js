// SPDX-License-Identifier: GPL-3.0-only
// fillObjRamTestRamp — power-on self-test colour-ramp fill of the object hardware page.
//
// WHAT IT IS
//   The write half of the OBJRAM RAM test. Starting from the current PRNG seed byte, it writes a
//   stepped colour ramp across the whole 256-byte object hardware page at OBJRAM_HW_BASE (0x5800):
//   cell i receives seed + i*0x2f (mod 256). It then reloads the seed from RNG_SEED (0x401e) and
//   tail-calls the scan half, which reads the ramp straight back and verifies every cell.
//
// ROLE IN THE MACHINE
//   During boot the frame is diverted whenever SELFTEST_MODE (0x401a) is non-zero: the vblank handler
//   dispatchSelfTestMode (ROM 0x1bcd) is a one-of-four dispatch, and mode value 3 falls through into
//   this routine (see mechanisms.md "One frame: the vblank interrupt"). It takes the object hardware
//   base and the live random seed at 0x401e as the ramp's starting point, stepping the colour +0x2f
//   per cell across the 256-byte OBJRAM page. Writing a seed-dependent pattern and reading it back is
//   the classic exercise that shakes out stuck or shorted address/data lines in the sprite RAM.
//
// ROM 0x1be3.  Grounding: [seen].
//
// LIVE-OUT: OBJRAM_HW_BASE..+0xff filled with the ramp; control passes to
// scanObjRamTestRampAndFinishSelfTest, whose return value is forwarded on.
import { OBJRAM_HW_BASE, RNG_SEED } from "./names.js";
import { scanObjRamTestRampAndFinishSelfTest } from "./scanObjRamTestRampAndFinishSelfTest.js";

const RAMP_STEP = 0x2f; // colour step laid between successive OBJRAM cells

export function fillObjRamTestRamp(m, seed = m.regs.a) {
  const { mem8 } = m;
  // The ramp begins at the seed byte handed in via A (the current PRNG value at call time).
  let v = seed & 0xff;
  // Walk all 256 OBJRAM cells, writing the running colour and stepping it +0x2f (wrapping in 8 bits)
  // so no two adjacent cells share a value — a data pattern the scan half re-derives and checks exactly.
  for (let i = 0; i < 0x100; i++) {
    mem8[OBJRAM_HW_BASE + i] = v;
    v = (v + RAMP_STEP) & 0xff;
  }
  // Reload the ramp's starting value from RNG_SEED (0x401e) and hand off to the scan/verify half, which
  // re-walks the identical +0x2f ramp, faults on any mismatch (a RAM fault), then finishes this phase.
  return scanObjRamTestRampAndFinishSelfTest(m, mem8[RNG_SEED]); // reload the seed and scan the ramp back
}
