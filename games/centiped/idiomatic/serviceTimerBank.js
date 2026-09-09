// SPDX-License-Identifier: GPL-3.0-only
import { loc_34, loc_41, loc_43, loc_d7, loc_ef, FIELD_SCAN_PTR_LO, FIELD_SCAN_PTR_HI, loc_00 } from "./names.js";

const TIMER_BASE = loc_34; // base of the 14 countdown-timer bytes

/**
 * serviceTimerBank — the master of the three periodic clocks: one per-frame sweep over a bank of
 * 14 general-purpose countdown timers plus the slow $43 frame/step counter.
 *
 * Role in the machine: this is the timing subsystem's heartbeat. It ages a block of 14 timer bytes
 * based at $34, and when the master timer (top slot) expires it refreshes the folded key $41 that
 * `tickSpawnCadence` range-tests — that refresh is what couples the timer bank to the spawn cadence.
 * After the sweep it drives a coarse, slow counter $43 that, on the single frame it tops out, kicks
 * off the playfield cell-stream scan by seeding its 16-bit pointer.
 *
 * Timer encoding (the counterintuitive part): a timer counts *up* through 0xFA..0xFF toward a 0x00
 * expiry, so a byte near 0xF9 is nearly done, not nearly full. Per byte (index 13..0):
 *   - value < 0xF9 is resting: left alone, so idle timers cost nothing;
 *   - value == 0xF9 is a "just expired" marker: not decremented, but requests a master re-arm;
 *   - value >= 0xFA is a live countdown: decremented, and requests a re-arm if it lands on zero.
 * The re-arm request acts only on the master slot (index 0x0D) and only while $43 & 0xAF is clear.
 *
 * 6502 quirk carried faithfully: `inc` leaves A holding the PRE-increment value, so the wrap test
 * on $43 compares the OLD count, and the scan-pointer seed fires on the 0x27-valued frame (the one
 * that moves $43 to 0x28), not after $43 already reads 0x28.
 *
 * Cells: $34.. the 14 timer bytes; $43 the slow frame/step counter; $d7/$ef folded into $41 on
 * re-arm; $00 the frame counter (for the every-4th-frame gate); $da/$db the field-scan pointer.
 *
 * Grounding: [code]. Live-out: the $34 timer block, $41 (on re-arm), $43, and $da/$db (on top-out).
 */
export function serviceTimerBank(m) {
  const { mem8 } = m;

  // Sweep the 14 timer bytes from the master slot (0x0D) down to 0x00. Descending order matters:
  // the master is index 0x0D, hit on the first iteration, and only it can request the re-arm.
  for (let x = 0x0d; x >= 0; x--) {
    const cell = (TIMER_BASE + x) & 0xff;
    const y = mem8[cell];
    if (y < 0xf9) continue; // resting timer -- leave it

    // Classify the near-expiry byte and decide whether it asks the master to re-arm.
    let armMaster = false;
    if (y < 0xfa) {
      armMaster = true; // y == 0xF9: expired marker, no decrement
    } else {
      // Live countdown (0xFA..0xFF): step it up toward the 0x00 expiry. Landing on 0x00 this pass
      // is the expiry, which requests the re-arm.
      const dec = (y - 1) & 0xff;
      mem8[cell] = dec;
      if (dec === 0) armMaster = true; // hit zero this pass
    }

    // The re-arm fires only on the master slot and only while $43's 0xAF bits are clear. When it
    // fires it refreshes the shared folded key $41 from $d7 ^ $ef — the exact value the spawn
    // cadence later range-tests, which is how this bank paces segment spawns.
    if (armMaster && x === 0x0d && (mem8[loc_43] & 0xaf) === 0) {
      mem8[loc_41] = mem8[loc_d7] ^ mem8[loc_ef];
    }
  }

  // Now drive the slow master counter $43, under three guards. First: $43 is inactive unless its
  // 0xAF mask is nonzero (note the opposite polarity from the re-arm gate above, which fired when
  // the mask was clear) — if inactive, stop here.
  if ((mem8[loc_43] & 0xaf) === 0) return;   // counter inactive
  // Second: it only ticks on every 4th frame, tested against the frame counter's low two bits,
  // stretching $43 into a coarse clock rather than a per-frame one.
  if ((mem8[loc_00] & 0x03) !== 0) return;   // only every 4th frame
  const counter = mem8[loc_43];
  // Third: once $43 reaches 0x28 it is clamped and climbs no further.
  if (counter >= 0x28) return;                     // clamped

  // All three permit: advance $43 by one. `counter` still holds the PRE-increment value (the 6502
  // `inc` quirk), so the wrap test below compares the old count.
  mem8[loc_43] = counter + 1;        // inc $43 (A keeps the pre-inc value)
  if (counter !== 0x27) return;                    // fired only as 0x27 -> 0x28

  // One-shot on the frame that carries $43 from 0x27 to 0x28: seed the 16-bit playfield cell-stream
  // scan pointer to 0x0400 (lo=0x00, hi=0x04), kicking off `scanForRangedCellAndSeed`'s field walk
  // exactly once as the counter tops out.
  mem8[FIELD_SCAN_PTR_LO] = 0x00;
  mem8[FIELD_SCAN_PTR_HI] = 0x04;
}
