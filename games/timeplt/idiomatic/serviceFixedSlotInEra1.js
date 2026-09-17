// SPDX-License-Identifier: GPL-3.0-only
/** serviceFixedSlotInEra1 — service one fixed object slot, and only while the era index holds one particular
 * value; every other era leaves without touching a thing. The slot's record and the sprite entry
 * that goes with it are constants here, so this entry is a guard plus the choice of that one
 * pair. What servicing amounts to is not decided here. The guard reads the era byte and steps it
 * down by one to test it, so both exits leave that stepped value and the flags of the step; on the
 * serviced exit those are handed to the slot servicer, which decides the final state.
 * LIVE-OUT: memory; the stepped era byte and the flags of stepping it; on the serviced path the two
 * base pointers and whatever the servicer leaves. */

import { u8 } from "../../../core/int.js";
import { F_C, F_S, F_Z, F_H, F_N, F_PV, F_F3, F_F5 } from "../../../core/cpu/z80.js";
import { serviceSlotByHeadByte } from "./serviceSlotByHeadByte.js";
import { ERA_INDEX, ERA_OBJECT_ENTRY_SLOT2, ERA_OBJECT_RECORD_SLOT2 } from "./names.js";

// The era test steps the era byte down by one. That leaves sign, zero and even the two high copies
// from the stepped result, the half-borrow when its low nibble ran out, the subtract flag set, the
// overflow only where the step crossed 0x80, and the carry untouched from entry.
function stepFlags(result, entryF) {
  return (entryF & F_C) |
    (result & 0x80 ? F_S : 0) |
    (result === 0 ? F_Z : 0) |
    (result & (F_F3 | F_F5)) |
    F_N |
    ((result & 0x0f) === 0x0f ? F_H : 0) |
    (result === 0x7f ? F_PV : 0);
}

export function serviceFixedSlotInEra1(m, entryF = m.regs.f) {
  const { regs, mem8 } = m;
  // `dec a / ret nz` on the era byte: the serviced era is the one value that steps down to zero.
  const stepped = u8(mem8[ERA_INDEX] - 1);
  if (stepped !== 0) return (regs.a = stepped, regs.f = stepFlags(stepped, entryF), undefined);
  return (regs.a = stepped, regs.f = stepFlags(stepped, entryF), regs.ix = ERA_OBJECT_RECORD_SLOT2, regs.iy = ERA_OBJECT_ENTRY_SLOT2, serviceSlotByHeadByte(m));
}
