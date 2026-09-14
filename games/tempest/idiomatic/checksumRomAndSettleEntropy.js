// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  TABLE_CURSOR, WORK_PTR_LO, WORK_PTR_HI, SEG_SPREAD_A_LO_2, SEG_SPREAD_A_LO_3, SEG_SPREAD_A_LO_5,
  WATCHDOG_CLEAR, POKEY1_AUDF3, POKEY1_AUDC3, POKEY1_RANDOM, POKEY2_RANDOM,
} from "./names.js";
import { runSelfTestLoop } from "./runSelfTestLoop.js";

/**
 * checksumRomAndSettleEntropy — power-on ROM checksum + entropy settle. ROM 0xda0a.
 *
 * Role in the machine: this runs at power-on, before the game proper, as part of the board self-test.
 * It verifies the program ROMs by folding every byte into per-bank checksums, arms an error tone if the
 * first bank fails, then reads the two POKEY random registers until they read stable — giving the game a
 * trustworthy entropy seed. It then continues into the self-test loop.
 *
 * Behavior: it walks 12 banks of 8 pages each. For each bank it seeds a running checksum with the bank
 * index and XORs every byte of all eight 256-byte pages into it, strobing the watchdog cell once per
 * page. The page pointer high byte starts at 0x30 for banks 0..1, then jumps to the high window 0x90 at
 * bank 2. The 12 finished checksums land in consecutive cells from SEG_SPREAD_A_LO_5. If bank 0's
 * checksum is nonzero (a bad ROM image) it arms the error tone by writing POKEY1_AUDF3=0x40 /
 * POKEY1_AUDC3=0xa4. It then settles each POKEY entropy register (POKEY1_RANDOM→SEG_SPREAD_A_LO_2,
 * POKEY2_RANDOM→SEG_SPREAD_A_LO_3): it samples once and stores the sample only if six consecutive
 * re-reads all match, leaving the destination untouched on any mismatch. Finally it tail-delegates to
 * runSelfTestLoop.
 *
 * Live-out: the 12 bank checksums from SEG_SPREAD_A_LO_5, the error-tone POKEY registers (only on a bad
 * bank 0), the two settled entropy cells SEG_SPREAD_A_LO_2/_3, and whatever runSelfTestLoop leaves.
 * Grounding: [seen].
 */
export function checksumRomAndSettleEntropy(m) {
  const { mem8 } = m;

  mem8[WORK_PTR_LO] = 0;      // bank pointer low byte (stays 0 -- pages are 256-aligned)
  mem8[WORK_PTR_HI] = 0x30;   // bank pointer high byte -> first bank

  let offset = 0;        // byte offset within a page, shared across banks (always 0 at bank entry)
  let bank = 0;
  do {
    mem8[TABLE_CURSOR] = 8;    // pages remaining in this bank
    let checksum = bank; // seed the running checksum with the bank index
    do {
      do {
        // Fold every byte of this page into the checksum.
        const base = mem8[WORK_PTR_LO] | (mem8[WORK_PTR_HI] << 8);
        checksum ^= mem8[u16(base + offset)];
        offset = u8(offset + 1);
      } while (offset !== 0);   // wraps back to 0 after 256 bytes
      mem8[WORK_PTR_HI] = mem8[WORK_PTR_HI] + 1; // advance to the next page
      mem8[WATCHDOG_CLEAR] = checksum;       // watchdog strobe (value ignored by the device)
      mem8[TABLE_CURSOR] = mem8[TABLE_CURSOR] - 1;
    } while (mem8[TABLE_CURSOR] !== 0);       // eight pages per bank

    mem8[SEG_SPREAD_A_LO_5 + bank] = checksum;    // store this bank's checksum
    bank = bank + 1;
    if (bank === 2) mem8[WORK_PTR_HI] = 0x90; // banks 2..11 live in the high window
  } while (bank < 12);

  if (mem8[SEG_SPREAD_A_LO_5] !== 0) {            // bank-0 checksum bad -> arm the error tone
    mem8[POKEY1_AUDF3] = 0x40;
    mem8[POKEY1_AUDC3] = 0xa4;
  }

  // Settle both POKEY entropy registers into their destination cells.
  settleRandom(mem8, POKEY1_RANDOM, SEG_SPREAD_A_LO_2);
  settleRandom(mem8, POKEY2_RANDOM, SEG_SPREAD_A_LO_3);

  return runSelfTestLoop(m);                      // continue into the self-test loop
}

// Sample an entropy register once, then re-read it up to six times; store the sample only if every
// re-read still matches (a bail on the first mismatch leaves the destination untouched).
function settleRandom(mem8, srcCell, destCell) {
  const sample = mem8[srcCell];   // one sample of the entropy register
  let retries = 5;
  let stable = true;
  do {
    if (sample !== mem8[srcCell]) { stable = false; break; }  // bail on any mismatch
    retries = retries - 1;
  } while (retries >= 0);
  if (stable) mem8[destCell] = sample;   // commit only a fully-stable sample
}
