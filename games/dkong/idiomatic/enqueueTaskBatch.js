// SPDX-License-Identifier: GPL-3.0-only
/**
 * enqueueTaskBatch — post a fixed batch of seven messages onto the task ring: one [0x04, 0x00] then
 * six [0x03, 0x14..0x19]. The dispatcher masks the opcode to its low 5 bits; handler #3 draws screen
 * text.
 *
 * LIVE-OUT: memory-only — the task ring and its tail pointer.
 */

import { enqueueTask } from "./enqueueTask.js";

export function enqueueTaskBatch(m) {
  enqueueTask(m, 0x04, 0x00);

  for (let arg = 0x14; arg <= 0x19; arg++) {
    enqueueTask(m, 0x03, arg);
  }
}
