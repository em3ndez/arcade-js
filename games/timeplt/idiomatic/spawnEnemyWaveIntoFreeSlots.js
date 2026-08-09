// SPDX-License-Identifier: GPL-3.0-only
/** spawnEnemyWaveIntoFreeSlots — spawn a wave across a fixed bank of object slots. A count is read (the configured
 * wave size, or five while MOTHER_SHIP_ARMED is set, i.e. a large boss craft is present); the bank is then walked that many times and every
 * free slot is filled from a randomly-picked shape record — its three bytes seat the entry's shape
 * index and two slot fields — while an ordinal within the pass picks a per-slot byte, the step
 * counter is primed, the shape animation is stepped once, and the slot head is marked live. A fixed
 * status byte is stored when the pass ends. LIVE-OUT: memory. */

import { drawRandomByte } from "./drawRandomByte.js";
import { fetchTableByte } from "./fetchTableByte.js";
import { stepShapeAnimation } from "./stepShapeAnimation.js";
import { u8, u16 } from "../../../core/int.js";
import { MOTHER_SHIP_ARMED } from "./names.js";

const SLOT_BANK = 0xa850;
const ENTRY_BANK = 0xaa1a;
const CONFIGURED_COUNT = 0xacc1;
const SLOT_STRIDE = 0x10;
const DEFAULT_COUNT = 5;
const SHAPE_TABLE = 0x3a3b;
const ORDINAL_TABLE = 0x38d2;
const STATUS_CELL = 0xa812;
const STATUS_VALUE = 0xe4;

export function spawnEnemyWaveIntoFreeSlots(m) {
  const { regs, mem8 } = m;
  const configuredCount = mem8[CONFIGURED_COUNT];
  const count = mem8[MOTHER_SHIP_ARMED] === 0 ? configuredCount : DEFAULT_COUNT;

  let slot = SLOT_BANK;
  let entry = ENTRY_BANK;
  // A count of zero walks the whole bank 256 times, not none: the loop steps then wraps at 8 bits.
  let remaining = count;
  do {
    if (mem8[slot] === 0) {
      regs.a = drawRandomByte(m) & 0xfc;
      regs.hl = SHAPE_TABLE;
      const shapeIndex = fetchTableByte(m);
      const record = regs.hl;
      mem8[entry + 0x31] = shapeIndex;
      mem8[entry] = mem8[record + 1];
      const slotField = mem8[record + 2];
      mem8[slot + 0x01] = slotField;
      mem8[slot + 0x02] = slotField;

      regs.a = u8(configuredCount - remaining);
      regs.hl = ORDINAL_TABLE;
      mem8[slot + 0x0a] = fetchTableByte(m);
      mem8[slot + 0x09] = 0x20;

      regs.ix = slot;
      stepShapeAnimation(m);
      mem8[slot + 0x04] = 0x01;
      mem8[slot + 0x0e] = 0x00;
      mem8[slot] = mem8[slot] - 1;
    }
    slot = u16(slot + SLOT_STRIDE);
    entry = u16(entry + 2);
    remaining = u8(remaining - 1);
  } while (remaining !== 0);

  mem8[STATUS_CELL] = STATUS_VALUE;
}
