// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { emitPresetSound } from "./emitPresetSound.js";
import { loc_5a8a } from "./loc_5a8a.js";
import { loc_5a8c } from "./loc_5a8c.js";
import {
  INPUT_PORT0,
  DRIP_RING_C,
  COIN1_PULSE_COUNT,
  TAMPER_ROM_CHECK_FLAG,
  COINAGE_CONFIG,
} from "./names.js";
/**
 * loc_5a56 — variant-C drip step: rotate one input bit into the ring at DRIP_RING_C and act only
 * on a 3-bit phase of exactly 1. On that phase it emits the preset sound, bumps COIN1_PULSE_COUNT,
 * and steps the coord pair (high byte += 0x10, then a low-nibble carry into COINAGE_CONFIG);
 * once the low nibble tops out it funnels A into the shared accumulate tail (0x63 on full wrap, else
 * the nibble) which clamps the score byte and queues the display command.
 *
 * LIVE-OUT: none (memory only) — a void per-frame drip step; no register survives.
 */
export function loc_5a56(m) {
  const { mem8 } = m;

  const ringCarry = mem8[INPUT_PORT0] & 1; // rrca: carry := bit0 of the input
  mem8[DRIP_RING_C] = u8((mem8[DRIP_RING_C] << 1) | ringCarry); // rl (hl)
  if ((mem8[DRIP_RING_C] & 0x07) !== 1) return; // only phase 1 acts

  emitPresetSound(m);
  mem8[COIN1_PULSE_COUNT] = u8(mem8[COIN1_PULSE_COUNT] + 1);

  const stepped = u8(mem8[TAMPER_ROM_CHECK_FLAG] + 0x10);
  mem8[TAMPER_ROM_CHECK_FLAG] = stepped;
  const cfg = mem8[COINAGE_CONFIG];
  if (cfg >= stepped) return; // sub (hl),b -> ret nc: no borrow means nothing to carry

  const carry = u8(u8(-u8((cfg & 0xf0) + 0x10)) + mem8[TAMPER_ROM_CHECK_FLAG]);
  mem8[TAMPER_ROM_CHECK_FLAG] = carry;

  const nibble = cfg & 0x0f;
  if (nibble !== 0x0f) return loc_5a8c(m, nibble); // add the nibble to the score byte
  return loc_5a8a(m); // full wrap -> seed 0x63 into the accumulate tail
}
