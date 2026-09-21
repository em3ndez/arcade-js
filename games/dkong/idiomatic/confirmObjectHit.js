// SPDX-License-Identifier: GPL-3.0-only
/**
 * confirmObjectHit — confirm an X-matched object slot is also Y-aligned and still eligible, and if
 * so register the hit for the object-interaction state machine.
 *
 * The confirm half of the object-slot collision scan; entered with the matched record's base pointer
 * in HL after an upstream X-match. It passes when Mario's Y equals the record's Y (+3) and bit 3 of
 * the record's flag byte (+1) is clear (not yet consumed); on failure it touches nothing. The record
 * pointer walks its low byte only, so offsets wrap inside the record's own 256-byte page.
 *
 * LIVE-OUT: memory-only — the three effect-subsystem flag cells.
 */
import { page } from "../../../core/int.js";
import { MARIO_Y, EFFECT_STATE, EFFECT_SELECT, EFFECT_PARAM_PTR } from "./names.js";

export function confirmObjectHit(m, record = m.regs.hl) {
  const { mem8, mem16 } = m;

  const pg = page(record);
  const base = record & 0xff;
  const recByte = (off) => mem8[pg | ((base + off) & 0xff)];

  if (mem8[MARIO_Y] !== recByte(3)) return;
  if (recByte(1) & 0x08) return;

  mem16[EFFECT_PARAM_PTR] = record;
  mem8[EFFECT_SELECT] = 0x00;
  mem8[EFFECT_STATE] = 0x01;
}
