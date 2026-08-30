// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { PLAYER1_LIVES, FRAME_COUNTER, TAMPER_CKSUM_TOP_ADDR, TAMPER_STRIKES_ROM } from "./names.js";
/**
 * loc_7e6d — periodic anti-tamper ROM integrity guard. [seen]
 *
 * ROM 0x7e6d-0x7e93. A leaf: one gated pass over a span of the program ROM, calling nothing.
 *
 * WHAT IT IS. A self-protection check the board runs against its own program image. It walks a run
 * of ROM bytes, folds them into a running 8-bit sum, and separately counts how many times that sum
 * overflowed past 0xff. It then combines the two into a signature; a genuine, unmodified ROM lands
 * on a signature the check treats as clean, while a bootleg or patched ROM almost certainly does
 * not. On a miss it does not halt — it quietly bumps a strike counter, letting other code degrade
 * the game later so the failure is hard to trace back to a single check.
 *
 * ROLE IN THE MACHINE. This is a copy-protection / conversion deterrent, common on early-80s
 * boards. It is deliberately cheap and infrequent, so it costs little during play yet still bites a
 * tampered board over time.
 *
 * WHEN IT RUNS. Two gates keep it rare. PLAYER1_LIVES (0x8988) must be >= 4: the DSW default is 3
 * lives, so the guard only arms on the 4- or 5-life dip-switch settings, an oblique trigger a
 * cracker is unlikely to notice. FRAME_COUNTER (0x8a5f) is the free-running vblank down-counter, and
 * the check only fires on its zero crossing — once every 256 frames, roughly four seconds.
 *
 * THE SUMMED SPAN. It sums DOWNWARD from TAMPER_CKSUM_TOP_ADDR (0x64be) until it meets a 0x34
 * SENTINEL byte, so the span is defined by its top address and that terminator rather than a length.
 *
 * THE SIGNATURE. carries (overflow count) + sum, masked with 0xb0: if any of those three bits is
 * set the image is deemed tampered. An intact ROM is arranged so this masks to zero.
 *
 * LIVE-OUT: none — writes only the tamper-strike counter, and only on a detected miss; the caller
 * reads no register or flag back.
 */
const SENTINEL = 0x34; // byte that ends the summed span

export function loc_7e6d(m) {
  const { mem8 } = m;

  // First gate: only arm on the 4/5-life dip-switch settings. The default is 3, so a normal board
  // never runs the check — an intentionally obscure trigger.
  if (mem8[PLAYER1_LIVES] < 0x04) return; // gate: fewer than four lives

  // Second gate: run only on the vblank counter's zero crossing, i.e. once per 256 frames (~4s), so
  // the scan is cheap over the life of a game.
  if (mem8[FRAME_COUNTER] !== 0) return; // gate: only at the frame-counter zero crossing

  // Fold the ROM span into an 8-bit running sum and count the carries. Walk downward from
  // TAMPER_CKSUM_TOP_ADDR (0x64be); each byte is added, the sum kept to 8 bits, and every overflow
  // past 0xff tallied separately. The walk ends when the next byte down is the 0x34 sentinel.
  let sum = 0;
  let carries = 0;
  let p = TAMPER_CKSUM_TOP_ADDR;
  for (;;) {
    const t = mem8[p] + sum;
    p = u16(p - 1); // step down one byte (16-bit wrap)
    if (t > 0xff) carries = (carries + 1) & 0xff; // tally an 8-bit overflow
    sum = t & 0xff;
    if (mem8[p] === SENTINEL) break; // reached the terminator: span complete
  }

  // Form the signature and test it: (carries + sum) & 0xb0. An intact image masks to zero and is
  // waved through; any set bit means the summed bytes changed.
  if (((carries + sum) & 0xb0) === 0) return; // no tamper signature

  // Tamper detected: bump the strike counter (0x89ef) rather than halting, so the effect surfaces
  // elsewhere and is hard to trace back here.
  mem8[TAMPER_STRIKES_ROM] = mem8[TAMPER_STRIKES_ROM] + 1; // mem8 truncates to 8 bits
}
