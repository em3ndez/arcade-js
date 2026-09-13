// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  TABLE_CURSOR, WORK_PTR_LO, WORK_PTR_HI, SEG_SPREAD_A_LO_2, SEG_SPREAD_A_LO_3, SEG_SPREAD_A_LO_5,
  WATCHDOG_CLEAR, POKEY1_AUDF3, POKEY1_AUDC3, POKEY1_RANDOM, POKEY2_RANDOM,
} from "./names.js";
import { loc_da62 } from "./loc_da62.js";

// Power-on checksum + entropy settle. Walks 12 banks (8 pages each), XORing every byte into a per-bank
// checksum seeded with the bank index; the pointer high byte starts at 0x30, then jumps to the high
// window at bank 2. Each page strobes the watchdog cell. The 12 checksums land in consecutive cells from
// SEG_SPREAD_A_LO_5; if bank 0's is nonzero it arms the error tone. Then it settles each entropy register: sample
// once, and store it only if six consecutive re-reads all match. Tail-delegates to the self-test loop.
export function loc_da0a(m) {
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
        const base = mem8[WORK_PTR_LO] | (mem8[WORK_PTR_HI] << 8);
        checksum ^= mem8[u16(base + offset)];
        offset = u8(offset + 1);
      } while (offset !== 0);
      mem8[WORK_PTR_HI] = mem8[WORK_PTR_HI] + 1; // advance to the next page
      mem8[WATCHDOG_CLEAR] = checksum;       // watchdog strobe (value ignored by the device)
      mem8[TABLE_CURSOR] = mem8[TABLE_CURSOR] - 1;
    } while (mem8[TABLE_CURSOR] !== 0);

    mem8[SEG_SPREAD_A_LO_5 + bank] = checksum;    // store this bank's checksum
    bank = bank + 1;
    if (bank === 2) mem8[WORK_PTR_HI] = 0x90; // banks 2..11 live in the high window
  } while (bank < 12);

  if (mem8[SEG_SPREAD_A_LO_5] !== 0) {            // bank-0 checksum bad -> arm the error tone
    mem8[POKEY1_AUDF3] = 0x40;
    mem8[POKEY1_AUDC3] = 0xa4;
  }

  settleRandom(mem8, POKEY1_RANDOM, SEG_SPREAD_A_LO_2);
  settleRandom(mem8, POKEY2_RANDOM, SEG_SPREAD_A_LO_3);

  return loc_da62(m);
}

// Sample an entropy register once, then re-read it up to six times; store the sample only if every
// re-read still matches (a bail on the first mismatch leaves the destination untouched).
function settleRandom(mem8, srcCell, destCell) {
  const sample = mem8[srcCell];
  let retries = 5;
  let stable = true;
  do {
    if (sample !== mem8[srcCell]) { stable = false; break; }
    retries = retries - 1;
  } while (retries >= 0);
  if (stable) mem8[destCell] = sample;
}
