// SPDX-License-Identifier: GPL-3.0-only
/** loc_4243 — on this object's one turn of the eight-frame round, and only once the shared spawn
 * cooldown has run out, walk the object-record bank for a free slot; when one sits far enough from
 * either of two fixed lines, stash its record and paired-entry pointers, hand the caller's facing to
 * the launcher, and pick the aligned-facing launcher on era zero or the heading-follows one on the
 * rest. Otherwise it counts the cooldown down or leaves untouched. LIVE-OUT: memory, and the facing
 * byte in C the launcher reads. */

import { setTheLaunchFacingInsideOneAimWindow } from "./setTheLaunchFacingInsideOneAimWindow.js";
import { loc_42b7 } from "./loc_42b7.js";
import { u8 } from "../../../core/int.js";

const FRAME_COUNTER = 0xa980;
const COOLDOWN = 0xa8f4;
const RECORD_BASE = 0xa8c0;
const ENTRY_BASE = 0xaa28;
const SLOT_COUNT = 0xa8c6;
const NEW_RECORD = 0xa991;
const NEW_ENTRY = 0xa993;
const MARGIN = 0xa8d6;
const ERA = 0xad04;

const PHASE_BIAS = 5;
const RECORD_STRIDE = 0x10;
const FIRST_LINE = 0x78;
const SECOND_LINE = 0x84;

export function loc_4243(m) {
  const { regs, mem8 } = m;

  if ((mem8[FRAME_COUNTER] & 7) + PHASE_BIAS !== mem8[regs.ix + 0x0f]) return;

  if (mem8[COOLDOWN] !== 0) {
    mem8[COOLDOWN] = mem8[COOLDOWN] - 1;
    return;
  }

  let count = mem8[SLOT_COUNT];
  if (count === 0) return;

  let record = RECORD_BASE;
  let entry = ENTRY_BASE;
  let free = false;
  for (; count > 0; count--) {
    if (mem8[record] === 0) { free = true; break; }
    record = (record & 0xff00) | u8(record + RECORD_STRIDE); // step L only; the bank never carries into H
    entry = (entry + 2) & 0xffff;
  }
  if (!free) return;

  m.mem16[NEW_RECORD] = record;
  m.mem16[NEW_ENTRY] = entry;

  const margin = mem8[MARGIN];
  const window = u8(margin + margin);
  const along = u8(FIRST_LINE - mem8[regs.iy + 0x31] + margin);
  if (along < window) {
    const across = u8(SECOND_LINE - mem8[regs.iy + 0x00] + margin);
    if (across < window) return;
  }

  regs.c = mem8[regs.ix + 0x02];
  if (mem8[ERA] === 0) return setTheLaunchFacingInsideOneAimWindow(m);
  return loc_42b7(m);
}
