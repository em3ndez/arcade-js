import { ATTACKER_SPAWN_SLOT_COUNT, ERA_INDEX, ERA_OBJECT_ENTRY_SLOT0, ERA_OBJECT_RECORD_SLOT0, loc_40ea } from "./names.js";
import { F_S, F_Z, F_H, F_PV, F_N, F_C, F_F3, F_F5 } from "../../../core/cpu/z80.js";
// SPDX-License-Identifier: GPL-3.0-only
/** sweepEra2PlusObjectBank — enter the per-slot sweep of an object bank: below the first swept era, or with the bank's
 * slot count zero, do nothing; else seat both cursors and the turn count and run the sweep body.
 * The two do-nothing exits still leave the flags the era test and the zero-count test set, with
 * the tested byte in A. LIVE-OUT: memory, the cursors and the turn count on the sweep path; the
 * tested byte and its flags on each early exit. */

const FIRST_SWEPT_ERA = 2;

export function sweepEra2PlusObjectBank(m) {
  const { mem8 } = m;

  const era = mem8[ERA_INDEX];
  if (era < FIRST_SWEPT_ERA) {
    // the era-versus-threshold comparison, left in the flags with the era standing in A
    const difference = era - FIRST_SWEPT_ERA;
    const remainder = difference & 0xff;
    const flags =
      (remainder & 0x80 ? F_S : 0) |
      (remainder === 0 ? F_Z : 0) |
      (FIRST_SWEPT_ERA & (F_F3 | F_F5)) |
      F_N |
      (difference < 0 ? F_C : 0) |
      (((era ^ FIRST_SWEPT_ERA ^ remainder) & 0x10) ? F_H : 0) |
      (((era ^ FIRST_SWEPT_ERA) & (era ^ remainder) & 0x80) ? F_PV : 0);
    return (m.regs.a = era, m.regs.f = flags, undefined);
  }

  const count = mem8[ATTACKER_SPAWN_SLOT_COUNT];
  if (count === 0) {
    // the cursors are seated first, then a zero count anded on itself: zero in A, Z, H and even parity
    return (m.regs.ix = ERA_OBJECT_RECORD_SLOT0, m.regs.iy = ERA_OBJECT_ENTRY_SLOT0, m.regs.a = count, m.regs.f = F_Z | F_H | F_PV, undefined);
  }

  return (m.regs.ix = ERA_OBJECT_RECORD_SLOT0, m.regs.iy = ERA_OBJECT_ENTRY_SLOT0, m.regs.b = count, m.call(loc_40ea));
}
