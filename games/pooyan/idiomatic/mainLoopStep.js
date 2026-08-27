// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { DISPLAY_CMD_RING_READ_PTR } from "./names.js";
import { loc_0254 } from "./loc_0254.js";
import { loc_039b } from "./loc_039b.js";
import { renderPhaseGauge } from "./renderPhaseGauge.js";
import { loc_03e9 } from "./loc_03e9.js";
import { loc_0496 } from "./loc_0496.js";
import { loc_0552 } from "./loc_0552.js";
import { loc_056b } from "./loc_056b.js";
import { loc_05b2 } from "./loc_05b2.js";
import { loc_05ee } from "./loc_05ee.js";
import { flagHighScoreTableCorruptOnChecksumMiss } from "./flagHighScoreTableCorruptOnChecksumMiss.js";

const RING_PAGE = DISPLAY_CMD_RING_READ_PTR & ~0xff; // the ring lives on the cursor's page
const RING_WRAP = 0xc0; //                              cursor low wraps back to the ring base here

/**
 * mainLoopStep — one iteration of the main-loop state driver. Reads the
 * display-command ring at its read cursor: a worker slot (bit 7 set) runs the per-frame worker and
 * marks the vblank boundary; any other slot consumes one two-byte command, advances and wraps the
 * cursor, and runs the command's handler from the dispatch table.
 *
 * Returns true on the worker/ring-idle iteration (the vblank boundary), false on a command dispatch
 * (the generator keeps draining the ring within the frame).
 */
export function mainLoopStep(m) {
  const { mem8 } = m;
  const cursorLo = mem8[DISPLAY_CMD_RING_READ_PTR];
  const slotAddr = RING_PAGE | cursorLo;
  const slot = mem8[slotAddr];

  if (slot & 0x80) {
    loc_0254(m); // worker slot -> the real vblank boundary
    return true;
  }

  const index = u8(slot << 1) & 0x1f; // (command * 2) & 0x1f -> the even dispatch-table offset
  const param = mem8[u16(slotAddr + 1)];
  mem8[slotAddr] = 0xff; //             free both consumed ring bytes
  mem8[u16(slotAddr + 1)] = 0xff;
  const advanced = u8(cursorLo + 2); // two bytes consumed
  mem8[DISPLAY_CMD_RING_READ_PTR] = advanced >= RING_WRAP ? advanced : RING_WRAP;

  switch (index) {
    case 0x00: loc_039b(m); break;
    case 0x02: renderPhaseGauge(m); break;
    case 0x04: loc_03e9(m); break;
    case 0x06: loc_0496(m, param); break;
    case 0x08: loc_0552(m, param); break;
    case 0x0a: loc_056b(m, param); break;
    case 0x0c: loc_05b2(m, param); break;
    case 0x0e: loc_05ee(m); break;
    case 0x10: flagHighScoreTableCorruptOnChecksumMiss(m); break;
  }
  return false;
}
