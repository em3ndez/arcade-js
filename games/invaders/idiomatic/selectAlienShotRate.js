// SPDX-License-Identifier: GPL-3.0-only
import { ALIEN_SHOT_RATE_TABLE, ALIEN_SHOT_RATE_THRESHOLDS, loc_20cf } from "./names.js";
import { currentPlayerRecordPtr } from "./currentPlayerRecordPtr.js";

// selectAlienShotRate — choose how often the aliens fire, scaled to the active player's score.
//
// WHAT IT IS
//   Reads a score key for the active player, finds which band it falls in via a four-entry threshold
//   table, and publishes the matching cadence value into the cell the per-frame alien-shot stepper reads.
//   A higher score selects a faster shot cadence.
//
// ROLE IN THE MACHINE
//   The key is the second byte of the active player's descriptor — the HIGH byte of that player's BCD
//   score accumulator (the four-byte record is a BCD score word then its two-byte screen address).
//   currentPlayerRecordPtr() returns PLAYER1_OBJ_DESC (0x20f8) or PLAYER2_OBJ_DESC (0x20fc) by the
//   active-player bit, and +1 is that descriptor's second byte. As the score climbs it crosses the
//   ascending thresholds, stepping the rate up. The scan walks the four-entry threshold table ALIEN_SHOT_RATE_THRESHOLDS
//   (0x1cb8) to the first entry >= the key, and copies the PARALLEL byte from ALIEN_SHOT_RATE_TABLE
//   (0x1aa1) into loc_20cf (0x20cf). The alien-shot stepper (stepAlienShot) later reads 0x20cf as its
//   firing cadence, so this routine is the policy that sets the rate; the stepper is the mechanism that
//   applies it.
//
// ROM 0x170e.  Grounding: [seen].
//
// LIVE-OUT: none read by callers — the effect is the cadence byte written to loc_20cf.
export function selectAlienShotRate(m) {
  // Fetch the score key: byte +1 of the active player's descriptor — the high byte of the player's BCD
  // score (the descriptor address itself is chosen by the active-player bit inside currentPlayerRecordPtr).
  const key = m.mem8[currentPlayerRecordPtr(m) + 1];
  // Find the band: advance the index while the current threshold is still below the key, so it lands on
  // the first threshold that is >= the key. If the key exceeds all four thresholds the index stops at 4,
  // selecting the fifth (default / fastest) parallel table entry.
  let i = 0;
  while (i < 4 && m.mem8[ALIEN_SHOT_RATE_THRESHOLDS + i] < key) i++;
  // Publish the parallel cadence byte where the per-frame shot stepper will read it.
  m.mem8[loc_20cf] = m.mem8[ALIEN_SHOT_RATE_TABLE + i];
}
