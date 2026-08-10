// SPDX-License-Identifier: GPL-3.0-only
/** stepDriftingCountdownObjectByEraFrames — run one frame of an object whose life is a countdown at its base. At or above the
 * reset mark the state is re-stamped and its sound requested; then the object drifts with the
 * world and the count falls by one. At zero the slot retires. Below the animation window nothing
 * more happens; otherwise the count picks a frame from one of two fixed tables — the choice made
 * on the era index — and that frame plus a fixed sprite state are written to the sprite entry.
 * LIVE-OUT: memory, and the object/sprite cursors the caller keeps walking. */

import { stampObjectStateByte3bThenRequestSound } from "./stampObjectStateByte3bThenRequestSound.js";
import { driftWithWorldScroll } from "./driftWithWorldScroll.js";
import { retireSlot } from "./retireSlot.js";
import { fetchTableByte } from "./fetchTableByte.js";
import { ERA_INDEX } from "./names.js";

const COUNT = 0;
const RESET_MARK = 0x3c;
const WINDOW_FLOOR = 0x1c;
const FINAL_ERA = 0x04;
const NEAR_TABLE = 0x416e;
const FAR_TABLE = 0x4183;
const SPRITE_CODE = 1;
const SPRITE_STATE = 0x30;
const NEAR_STATE = 0x0d;
const FAR_STATE = 0x02;

export function stepDriftingCountdownObjectByEraFrames(m) {
  const { regs, mem8 } = m;
  const object = regs.ix;

  if (mem8[object + COUNT] >= RESET_MARK) stampObjectStateByte3bThenRequestSound(m);
  driftWithWorldScroll(m);

  const count = (mem8[object + COUNT] - 1) & 0xff;
  mem8[object + COUNT] = count;
  if (count === 0) return retireSlot(m);
  if (count < WINDOW_FLOOR) return;

  const frame = ((count - WINDOW_FLOOR) >> 2) & 0x07;
  const far = mem8[ERA_INDEX] >= FINAL_ERA;
  regs.hl = far ? FAR_TABLE : NEAR_TABLE;
  regs.a = frame;
  const sprite = regs.iy;
  mem8[sprite + SPRITE_CODE] = fetchTableByte(m);
  mem8[sprite + SPRITE_STATE] = far ? FAR_STATE : NEAR_STATE;
}
