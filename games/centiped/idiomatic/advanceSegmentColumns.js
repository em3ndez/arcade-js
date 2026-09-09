// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  IN1,
  SEGMENT_ROW_THRESHOLD_TABLE,
  loc_c5,
  SEGMENT_MOVE_ACCUM_B,
  SEGMENT_MOVE_ACCUM,
  SEGMENT_ROW_CROSS_COUNT,
  SEGMENT_COL_LIFE_TIMER,
  SEGMENT_COL_BODY,
  SEGMENT_RELOAD_TIMER,
  loc_d3,
  SEGMENT_MOVE_FRAME_COUNTER,
} from "./names.js";
import { stepPhasedCountersAndWrapCells } from "./stepPhasedCountersAndWrapCells.js";

/**
 * advanceSegmentColumns — step every column of one centipede-body strip and fold the motion into the
 * shared movement accumulator.
 *
 * Called with a column index X, this walks X down a column at a time. For each column it advances that
 * column's body byte, services the per-column life timer and the shared reload timer, and — when the
 * column's carry gate fires — folds a small per-column "row delta" into the two accumulator bytes and
 * bumps the column's progress counter. After the last column it subtracts a per-row threshold from the
 * accumulator and hands off to the phased-counter tail.
 *
 * A per-column control bit selected out of the IN1 port (bit 7 for columns >= 2, bit 6 for column 1,
 * bit 5 for column 0) decides whether the column steps forward normally or takes the wrap/reset branch.
 */
export function advanceSegmentColumns(m, x = m.regs.x) {
  const { mem8, mem16 } = m;

  // Store the column body then run the per-column life/reload timers; returns the carry gate
  // that decides whether this column contributes to the accumulator.
  const storeAndTick = (col, value) => {
    mem8[u8(SEGMENT_COL_BODY + col)] = value;
    // Reload the shared timer to 0xf0 unless IN1 bit4 is set.
    if ((mem8[IN1] & 0x10) === 0) mem8[SEGMENT_RELOAD_TIMER] = 0xf0;
    // While the reload timer is running, tick it and blank this column's body + life timer.
    if (mem8[SEGMENT_RELOAD_TIMER] !== 0) {
      mem8[SEGMENT_RELOAD_TIMER] = u8(mem8[SEGMENT_RELOAD_TIMER] - 1);
      mem8[u8(SEGMENT_COL_BODY + col)] = 0x00;
      mem8[u8(SEGMENT_COL_LIFE_TIMER + col)] = 0x00;
    }
    // The carry gate fires only when the per-column life timer decrements exactly to zero.
    const life = mem8[u8(SEGMENT_COL_LIFE_TIMER + col)];
    if (life === 0) return false;
    const dec = u8(life - 1);
    mem8[u8(SEGMENT_COL_LIFE_TIMER + col)] = dec;
    return dec === 0;
  };

  for (;;) {
    // Select this column's control bit out of the IN1 port: bit 7 for columns >= 2, bit 6 for column 1,
    // bit 5 for column 0.
    const in1 = mem8[IN1];
    const bit = x === 0 ? 5 : x === 1 ? 6 : 7;
    const control = ((in1 >> bit) & 1) !== 0;
    const stepped = mem8[u8(SEGMENT_COL_BODY + x)] & 0x1f; // the column's low-5-bit step index

    let carry;
    if (!control) {
      // Normal step: nudge the step index toward its clamp, then run the timers.
      let value = stepped;
      if (value !== 0) {
        if (value >= 0x1b) {
          value = u8(value - 1); // past the high clamp: back off one
        } else if ((mem8[SEGMENT_MOVE_FRAME_COUNTER] & 0x07) === 0x07) {
          value = u8(value - 1); // every 8th frame (low bits all set): back off one
        }
      }
      carry = storeAndTick(x, value);
    } else {
      // Control branch: the step index wraps by 0x20, else re-arms to the 0x1f clamp with a fresh life.
      if (stepped >= 0x1b) {
        carry = storeAndTick(x, 0x1f); // already past clamp: reset to 0x1f and run the timers
      } else {
        const full = mem8[u8(SEGMENT_COL_BODY + x)];
        const sum = full + 0x20;
        const wrapped = u8(sum);
        if (sum <= 0xff) {
          carry = storeAndTick(x, wrapped); // no overflow: store the +0x20 body and run the timers
        } else if (wrapped === 0) {
          carry = storeAndTick(x, 0x1f); // overflow to exactly 0: clamp to 0x1f and run the timers
        } else {
          // Overflow with a nonzero low byte: re-arm to 0x1f and reload the life timer to 0x78 directly,
          // bypassing the shared reload/tick; the carry gate fires when a life timer was already running.
          mem8[u8(SEGMENT_COL_BODY + x)] = 0x1f;
          carry = mem8[u8(SEGMENT_COL_LIFE_TIMER + x)] !== 0;
          mem8[u8(SEGMENT_COL_LIFE_TIMER + x)] = 0x78;
        }
      }
    }

    // Carry gate set: fold this column's row delta into the accumulator and bump its progress counter.
    if (carry) {
      let delta;
      if (x === 0) delta = 0;
      else if (x === 1) delta = mem8[loc_d3] & 0x10 ? 1 : 0;
      else {
        const t = (mem8[loc_d3] & 0x0c) >> 2;
        delta = t === 0 ? 0 : t + 2;
      }
      mem8[SEGMENT_MOVE_ACCUM] = u8(delta + mem8[SEGMENT_MOVE_ACCUM] + 1);
      mem8[SEGMENT_MOVE_ACCUM_B] = u8(delta + mem8[SEGMENT_MOVE_ACCUM_B] + 1);
      mem8[u8(loc_c5 + x)] = u8(mem8[u8(loc_c5 + x)] + 1);
    }

    x = u8(x - 1);
    if (x & 0x80) break; // DEX past 0 -> last column done, run the threshold tail
  }

  // Last-column threshold: subtract the per-row threshold from the accumulator. A borrow (negative
  // result) exits without committing; otherwise commit, bump the crossing counter, and bump it once
  // more on the top row (Y == 3).
  const y = mem8[loc_d3] >> 5;
  const diff = u8(mem8[SEGMENT_MOVE_ACCUM] - mem8[u16(SEGMENT_ROW_THRESHOLD_TABLE + y)]);
  if (diff & 0x80) return stepPhasedCountersAndWrapCells(m);
  mem8[SEGMENT_MOVE_ACCUM] = diff;
  mem8[SEGMENT_ROW_CROSS_COUNT] = u8(mem8[SEGMENT_ROW_CROSS_COUNT] + 1);
  if (y !== 0x03) return stepPhasedCountersAndWrapCells(m);
  mem8[SEGMENT_ROW_CROSS_COUNT] = u8(mem8[SEGMENT_ROW_CROSS_COUNT] + 1);
  if (mem8[SEGMENT_ROW_CROSS_COUNT] === 0) {
    throw new Error(
      "advanceSegmentColumns: threshold tail fell into the SEGMENT_ROW_THRESHOLD_TABLE DATA table -- a dead arm, trapped",
    );
  }
  return stepPhasedCountersAndWrapCells(m);
}
