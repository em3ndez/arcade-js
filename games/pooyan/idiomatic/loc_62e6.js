// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_0020 } from "./loc_0020.js";
import { storeActorAnimationPointer } from "./storeActorAnimationPointer.js";
import { loc_6274 } from "./loc_6274.js";
import { ROUND_COUNTER, POSITION_DELTA_TABLE_6360, ANIM_SCRIPT_634F } from "./names.js";
/**
 * loc_62e6 — match a record by tag, apply its per-round position delta, and re-arm it.
 *
 * Scans up to `count` records (each `stride` apart from the base) for one whose tag byte
 * equals A, stopping on the first match or when the counter drains. Then it looks up a
 * signed position delta in the round-indexed table, adds it into the matched record's
 * delta field, sets bit 5 of its flag field, installs the animation-script pointer, and
 * clears the paired interrupt-parity target record.
 *
 * The paired-record clear is a caller-skip; this routine tail-forwards its boolean (always false
 * = abort) to its own caller. LIVE-OUT: the caller-skip boolean; memory otherwise.
 */

const TAG_OFFSET = 0x14;
const DELTA_FIELD = 0x0a;
const FLAG_FIELD = 0x16;
const REARM_BIT = 0x20; // bit 5

export function loc_62e6(m, tag = m.regs.a, record = m.regs.iy, count = m.regs.c, stride = m.regs.de) {
  const { mem8 } = m;

  let rec = record;
  let remaining = count;
  for (;;) {
    if (mem8[rec + TAG_OFFSET] === tag) break; // match found
    rec = u16(rec + stride);
    remaining = (remaining - 1) & 0xff;
    if (remaining === 0) break; // counter drained -> apply to the last stepped record
  }

  const index = (mem8[ROUND_COUNTER] & 0x07) >> 1;
  const [delta] = loc_0020(m, POSITION_DELTA_TABLE_6360, index);
  mem8[rec + DELTA_FIELD] = (mem8[rec + DELTA_FIELD] + delta);
  mem8[rec + FLAG_FIELD] = mem8[rec + FLAG_FIELD] | REARM_BIT;
  storeActorAnimationPointer(m, rec, ANIM_SCRIPT_634F);

  return loc_6274(m); // tail-forward the paired-record clear's caller-skip boolean (false = abort)
}
