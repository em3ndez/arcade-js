// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { PLAYER1_LIVES, FRAME_COUNTER, TAMPER_CKSUM_TOP_ADDR, TAMPER_STRIKES_ROM } from "./names.js";
/**
 * loc_7e6d — periodic anti-tamper checksum. Runs only when PLAYER1_LIVES >= 4 and the frame counter
 * is at its zero crossing. It sums the program image downward from TAMPER_CKSUM_TOP_ADDR to the 0x34
 * sentinel byte, accumulating both the byte sum and a count of the sum's carries. If (carries + sum) has
 * any bit of 0xb0 set, the image is deemed tampered and the strike counter is bumped.
 *
 * LIVE-OUT: none — writes only the tamper-strike counter, and only on a detected miss; the caller
 * reads no register or flag back.
 */
const SENTINEL = 0x34; // byte that ends the summed span

export function loc_7e6d(m) {
  const { mem8 } = m;
  if (mem8[PLAYER1_LIVES] < 0x04) return; // gate: fewer than four lives
  if (mem8[FRAME_COUNTER] !== 0) return; // gate: only at the frame-counter zero crossing

  let sum = 0;
  let carries = 0;
  let p = TAMPER_CKSUM_TOP_ADDR;
  for (;;) {
    const t = mem8[p] + sum;
    p = u16(p - 1);
    if (t > 0xff) carries = (carries + 1) & 0xff;
    sum = t & 0xff;
    if (mem8[p] === SENTINEL) break;
  }

  if (((carries + sum) & 0xb0) === 0) return; // no tamper signature
  mem8[TAMPER_STRIKES_ROM] = mem8[TAMPER_STRIKES_ROM] + 1; // mem8 truncates to 8 bits
}
