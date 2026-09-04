// SPDX-License-Identifier: GPL-3.0-only
import { TASK_FLAGS, ANIM_DONE_FLAG } from "./names.js";

// Arm an interrupt-driven attract animation task and wait for it to finish: raise the task flag, then
// yield each frame (strobing the shift port) until the handler raises ANIM_DONE_FLAG, then clear the
// task. Generator; memory + IO.
export function* runAttractAnimTask(m) {
  m.mem8[TASK_FLAGS] = 0x02;
  while (m.mem8[ANIM_DONE_FLAG] === 0) {
    m.io.portOut(0x06, 0x02);
    yield;
  }
  m.mem8[TASK_FLAGS] = 0x00;
}
