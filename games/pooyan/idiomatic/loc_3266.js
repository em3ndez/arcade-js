// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { FORMATION_GUARD_BASE } from "./names.js";
/**
 * loc_3266 — hunter-formation dispatch state 2: a ROM self-check (anti-tamper guard).
 * ROM 0x3266. [seen]
 *
 * WHAT IT IS. One of the states the hunter-formation dispatcher can select. When it runs, its
 * whole job is to prove that a fixed 0x20-byte block of the game's own program image is intact.
 * Pooyan (like other Konami boards of the era) sprinkles these self-checks through the state
 * machinery so that a patched or bit-rotted ROM diverges from the original instead of playing on:
 * an intact image sums to a known constant, and any other value drops the machine into a guard
 * region rather than continuing.
 *
 * WHAT IT DOES. It reads GUARD_BLOCK_LEN (0x20) consecutive program bytes starting at
 * FORMATION_GUARD_BASE (ROM 0x0799) and keeps a running 8-bit sum (wrapping, exactly as the
 * hardware's accumulator does). A genuine, unmodified image sums to GUARD_SENTINEL (0xdc). If the
 * sum matches, the block is trusted and control falls through to the shared dispatcher epilogue —
 * modelled here as a plain return. If it does not match, the original code jumped back INTO the
 * guarded region at 0x0799 (executing that block as code, an unrecoverable divert); that path is
 * unreachable with a valid ROM, so it is modelled as a thrown integrity trap.
 *
 * LIVE-OUT: none. It reads constant program bytes only, writes no RAM, and leaves nothing its
 * caller consumes — the dispatcher resumes at its shared epilogue regardless.
 */
const GUARD_BLOCK_LEN = 0x20; // number of program bytes folded into the checksum
const GUARD_SENTINEL = 0xdc; // 8-bit sum an intact image at FORMATION_GUARD_BASE produces

export function loc_3266(m) {
  const { mem8 } = m;

  // Fold the guarded block into an 8-bit running sum. Walk GUARD_BLOCK_LEN bytes forward from
  // FORMATION_GUARD_BASE (ROM 0x0799), adding each into `sum` and masking to a byte so the total
  // WRAPS at 0x100 — the same overflow the original accumulator gives, which is what makes 0xdc the
  // expected result rather than the true arithmetic sum. The pointer steps with 16-bit wrap.
  let sum = 0;
  let p = FORMATION_GUARD_BASE;
  for (let i = 0; i < GUARD_BLOCK_LEN; i++) {
    sum = (sum + mem8[p]) & 0xff;
    p = u16(p + 1);
  }

  // Verdict. An intact image sums to GUARD_SENTINEL (0xdc) and the routine simply returns to the
  // shared dispatcher epilogue. Any other sum means the guarded block has been altered; the frozen
  // code answered that by re-entering the guarded region at 0x0799, an integrity divert that a valid
  // ROM never reaches, so it surfaces here as a thrown trap.
  if (sum !== GUARD_SENTINEL) {
    throw new Error("loc_3266: ROM-integrity/sanity trap unreachable with a valid ROM");
  }
}
