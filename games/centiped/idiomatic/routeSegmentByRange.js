// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  loc_34, loc_35, loc_54, loc_61, loc_62, loc_64, loc_71, loc_72, loc_73,
  loc_80, loc_8b, loc_8d, loc_9f, loc_a1, loc_d7, loc_ef, loc_f0,
  SFX_TIMER_CH4,
} from "./names.js";
import { foldSignedMagnitude } from "./foldSignedMagnitude.js";
import { loadObjectTileInputs } from "./loadObjectTileInputs.js";
import { resolveTileCellAtXY } from "./resolveTileCellAtXY.js";
import { decrementActiveObjectDelay } from "./decrementActiveObjectDelay.js";
import { stampEmptyTileCell } from "./stampEmptyTileCell.js";
import { loc_3037 } from "./loc_3037.js";
import { loc_303e } from "./loc_303e.js";
import { loc_3046 } from "./loc_3046.js";
import { advanceSegmentSlotLoop } from "./advanceSegmentSlotLoop.js";

/**
 * routeSegmentByRange -- range- and collision-test one segment slot, then route it. Gates the slot's
 * X coordinate and its folded distance to the head; measures the vertical and horizontal deltas
 * (as magnitudes) and, per slot class, dispatches to the mover-seed spine, the redraw tail, the
 * next-slot loop, or updates a shared limit. [code]
 */
export function routeSegmentByRange(m, x = m.regs.x) {
  const { mem8 } = m;

  // Coarse X-band gate on the slot coordinate.
  const coord = mem8[(loc_34 + x) & 0xff];
  if (!(coord < 0x76 || (coord >= 0xb9 && coord < 0xf8))) return advanceSegmentSlotLoop(m, x); // next slot

  // Folded horizontal distance to the head; too far and this slot is skipped.
  const h = mem8[(loc_64 + x) & 0xff] ^ mem8[loc_f0];
  if (h >= 0xf8) return advanceSegmentSlotLoop(m, x); // next slot
  const dx = u8(mem8[(loc_64 + x) & 0xff] - mem8[loc_72]);
  let y = foldSignedMagnitude(m, dx, (dx & 0x80) !== 0);

  // The active head slot ($0c) has extra near/wide gates that can skip the tighter y-window test.
  let viaWindow = true;
  if (x === 0x0c) {
    const near = (mem8[(loc_34 + x) & 0xff] ^ mem8[loc_ef]) < 0x20;
    const wide = (mem8[loc_80] ^ mem8[loc_f0]) >= 0x04;
    if (near && wide) {
      if (y >= 0x07) return advanceSegmentSlotLoop(m, x); // next slot
      viaWindow = false;
    }
  }
  if (viaWindow && y >= 0x05) return advanceSegmentSlotLoop(m, x); // next slot

  // Folded vertical distance, then dispatch by slot class.
  const dy = u8(mem8[(loc_54 + x) & 0xff] - mem8[loc_62]);
  y = foldSignedMagnitude(m, dy, (dy & 0x80) !== 0);

  if (x === 0x0d) {
    if (y >= 0x0a) return advanceSegmentSlotLoop(m, x); // next slot
    return finishBallistic(m, y);
  }

  if (x < 0x0c) {
    // Trailing slot: tick the delay, clear a heading bit, resolve/stamp its cell, then redraw.
    if (y >= 0x06) return advanceSegmentSlotLoop(m, x); // next slot
    mem8[loc_8b] = 0x00;
    let step = 0x10;
    if ((mem8[(loc_34 + x) & 0xff] & 0x40) === 0) {
      step = 0x00;
      mem8[loc_8b] = u8(mem8[loc_8b] + 1);
    }
    decrementActiveObjectDelay(m, x, step); // pass the step into the delay/advance spine explicitly
    if (x !== 0x0b && (mem8[(loc_35 + x) & 0xff] & 0x80) === 0) {
      mem8[(loc_35 + x) & 0xff] = mem8[(loc_35 + x) & 0xff] & 0xbf;
    }
    loadObjectTileInputs(m, x);
    resolveTileCellAtXY(m);
    mem8[loc_8d] = x;
    stampEmptyTileCell(m);
    return loc_303e(m, mem8[loc_8d]);
  }

  // Head slot ($0c): steer a nearby collision or bump the shared column limit.
  if ((mem8[(loc_34 + x) & 0xff] ^ mem8[loc_ef]) < 0x20) {
    if (y >= 0x06) return advanceSegmentSlotLoop(m, x); // next slot
    if (mem8[loc_80] !== 0x04) {
      mem8[loc_80] = 0x04;
      return loc_3046(m);
    }
    return loc_3037(m, 0x02);
  }
  if (y >= 0x0a) return advanceSegmentSlotLoop(m, x); // next slot
  return loc_3037(m, 0x10);
}

// The ballistic (last) slot: seed the shot origin, tri-state the redraw index by the fired distance,
// arm the sweep cells and clamp the shared vertical limit into [0x10, 0xf0] before the mover seed.
function finishBallistic(m, y) {
  const { mem8 } = m;
  mem8[loc_d7] = 0xb6;
  const d = u8(mem8[loc_71] - mem8[loc_73]);
  const dist = foldSignedMagnitude(m, d, (d & 0x80) !== 0);
  let step = 0x03;
  if (dist < 0x40) {
    mem8[loc_d7] = u8(mem8[loc_d7] + 1);
    step = 0x09;
    if (dist >= 0x16) {
      mem8[loc_d7] = u8(mem8[loc_d7] + 1);
      step = 0x06;
    }
  }
  mem8[loc_9f] = 0x80;
  mem8[loc_a1] = 0x80;
  mem8[SFX_TIMER_CH4] = 0x00;
  if (0xf0 >= mem8[loc_61]) {
    if (0x10 < mem8[loc_61]) return loc_3037(m, step);
    mem8[loc_61] = 0x10;
  } else {
    mem8[loc_61] = 0xf0;
  }
  return loc_3037(m, step);
}
