// SPDX-License-Identifier: GPL-3.0-only
import { loc_34, loc_41, loc_43, loc_d7, loc_ef, FIELD_SCAN_PTR_LO, FIELD_SCAN_PTR_HI, loc_00 } from "./names.js";

const TIMER_BASE = loc_34; // base of the 14 countdown-timer bytes

/**
 * serviceTimerBank — per-service pass over the 14 countdown-timer bytes plus the
 * $43 frame/step counter and its wrap arming. For each timer byte (index 13..0):
 *   - value < 0xF9 is resting: left alone;
 *   - value == 0xF9 is a "just expired" marker: no decrement, re-arms the master;
 *   - value >= 0xFA is a live countdown: decrement, and re-arm the master at 0.
 * Re-arm acts only on the master slot (index 0x0D) while $43 & 0xAF is clear. After
 * the scan, when nonzero, every 4th frame and while $43 < 0x28 it advances $43 by
 * one; the step that carries it to 0x28 arms the $da/$db pair. 6502 quirk: `inc`
 * leaves A holding the PRE-increment value, so the wrap test compares the OLD $43.  [code]
 */
export function serviceTimerBank(m) {
  const { mem8 } = m;

  for (let x = 0x0d; x >= 0; x--) {
    const cell = (TIMER_BASE + x) & 0xff;
    const y = mem8[cell];
    if (y < 0xf9) continue; // resting timer -- leave it

    let armMaster = false;
    if (y < 0xfa) {
      armMaster = true; // y == 0xF9: expired marker, no decrement
    } else {
      const dec = (y - 1) & 0xff;
      mem8[cell] = dec;
      if (dec === 0) armMaster = true; // hit zero this pass
    }

    if (armMaster && x === 0x0d && (mem8[loc_43] & 0xaf) === 0) {
      mem8[loc_41] = mem8[loc_d7] ^ mem8[loc_ef];
    }
  }

  if ((mem8[loc_43] & 0xaf) === 0) return;   // counter inactive
  if ((mem8[loc_00] & 0x03) !== 0) return;   // only every 4th frame
  const counter = mem8[loc_43];
  if (counter >= 0x28) return;                     // clamped

  mem8[loc_43] = counter + 1;        // inc $43 (A keeps the pre-inc value)
  if (counter !== 0x27) return;                    // fired only as 0x27 -> 0x28

  mem8[FIELD_SCAN_PTR_LO] = 0x00;
  mem8[FIELD_SCAN_PTR_HI] = 0x04;
}
