// SPDX-License-Identifier: GPL-3.0-only
/**
 * flagTamperOnRound5ChecksumMiss — anti-tamper program-ROM checksum guard, armed only at round 5.
 *
 * ROM 0x5b06-0x5b2b. Grounding: [seen].
 *
 * WHAT IT IS. One of the machine's scattered self-integrity checks: a routine that re-sums a
 * fixed span of its own program ROM and, if the sum does not match the value baked into an
 * intact image, records a tamper strike. Bootleg boards and modified images (patched-out
 * difficulty, added credits, etc.) fail these checks; the accumulated strikes are what later
 * make the game degrade rather than crash outright, so the tampering is hard to trace.
 *
 * WHEN IT FIRES. Only when ROUND_COUNTER (ROM 0x8907) reads exactly 5. Spreading the checks
 * across different rounds means a tamperer who patches out the check they hit on round 1 still
 * trips this one several rounds later. At any other round the routine returns having done
 * nothing.
 *
 * WHAT IT CHECKS. Six consecutive program bytes at ROM 0x1553. It sums them as an 8-bit
 * accumulator (low byte) while counting how many times the add carried past 0xff. An intact
 * image is tuned so that (low sum + carry count + 0x7f) wraps back to 0 in eight bits. If it
 * does, the span is untouched and the routine returns. If it does not, the image was altered,
 * so it increments TAMPER_FREEZE_FLAG (ROM 0x881e) — the strike tally whose nonzero value
 * downstream code reads to freeze enemy spawns, abort actor updates, and skip HUD setup.
 *
 * LIVE-OUT: memory only. The caller ignores the accumulator and flags; the sole effect a reader
 * sees is the possible increment of TAMPER_FREEZE_FLAG.
 */
import { ROUND_COUNTER, TAMPER_FREEZE_FLAG } from "./names.js";
import { u8 } from "../../../core/int.js";

const GUARDED_ROUND = 0x05; // the check is armed only at this round value
const CHECKSUM_LEN = 0x06; // six program bytes are summed
const CHECKSUM_BIAS = 0x7f; // an intact image is tuned so (low sum + carry count + bias) wraps to 0

// The six-byte span the sum covers, at ROM 0x1553. In the machine the base address is not loaded
// directly: it is assembled byte-swapped from a pointer whose halves are 0x15 (high) and 0x53
// (low), yielding 0x1553. Reproduced here as the same constant.
const CHECKSUM_SRC = (0x15 << 8) | 0x53;

export function flagTamperOnRound5ChecksumMiss(m) {
  const { mem8 } = m;

  // Arm-gate: run the check only while the round counter reads exactly 5; otherwise leave
  // everything untouched.
  if (mem8[ROUND_COUNTER] !== GUARDED_ROUND) return;

  // Sum the six program bytes at 0x1553 into an 8-bit accumulator (lowSum), counting each
  // overflow past 0xff separately (carryCount). Together they carry the full weight of the sum
  // the way the hardware's add-with-carry does.
  let lowSum = 0;
  let carryCount = 0;
  for (let i = 0; i < CHECKSUM_LEN; i++) {
    const total = lowSum + mem8[CHECKSUM_SRC + i];
    if (total > 0xff) carryCount = u8(carryCount + 1); // count this overflow
    lowSum = u8(total); // keep only the low byte
  }

  // Verdict: an intact span makes (low sum + carry count + 0x7f) wrap to exactly 0 in eight
  // bits. When it does, the image is untouched and the routine returns. Any other result means
  // the six bytes were altered, so record a tamper strike by bumping TAMPER_FREEZE_FLAG.
  if (u8(lowSum + carryCount + CHECKSUM_BIAS) === 0) return; // checksum balances -> not tampered
  mem8[TAMPER_FREEZE_FLAG] = mem8[TAMPER_FREEZE_FLAG] + 1;
}
