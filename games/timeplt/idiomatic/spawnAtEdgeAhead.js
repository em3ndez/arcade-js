// SPDX-License-Identifier: GPL-3.0-only
/** spawnAtEdgeAhead — bring one slot back into play on a timer, at the edge position that the
 * current
 * heading names. Three things hold it off: a gate cell that must read zero, a counter bit that
 * lets it act only every other frame, and the slot's own delay, which is counted down on each
 * frame it does act and only fires the placing when it reaches zero. The heading is rounded to the
 * nearer of sixteen equal sectors and selects a coordinate pair from a table; the pair goes to the
 * sprite entry, four working bytes of the record are reset, and the record is marked live LAST, so
 * the slot is never live with stale contents. LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { fetchTableByte } from "./fetchTableByte.js";
import { FRAME_TICK, MOTHER_SHIP_ARMED, PLAYER_HEADING } from "./names.js";

const EVERY_OTHER_FRAME = 0x01;

const DELAY = 0x0e;
const STATE = 0x00;
const LIVE = 0xff;
const RESET_FIELDS = [[0x0a, 0], [0x0b, 0], [0x0c, 64], [0x0d, 0]];

const EDGE_POSITIONS = 0x488d;
const SECTORS = 16;
const STEPS_PER_SECTOR = 256 / SECTORS;
const PAIR_WIDTH = 2;

const FIRST_COORDINATE = 0x00;
const SECOND_COORDINATE = 0x31;

export function spawnAtEdgeAhead(m, record = m.regs.ix, entry = m.regs.iy) {
  const { regs, mem8 } = m;
  if (mem8[MOTHER_SHIP_ARMED] !== 0) return;
  if ((mem8[FRAME_TICK] & EVERY_OTHER_FRAME) === 0) return;

  const delay = u8(mem8[u16(record + DELAY)] - 1);
  mem8[u16(record + DELAY)] = delay;
  if (delay !== 0) return;

  const sector = u8(mem8[PLAYER_HEADING] + STEPS_PER_SECTOR / 2) >> 4;
  regs.hl = EDGE_POSITIONS;
  regs.a = sector * PAIR_WIDTH;
  mem8[u16(entry + SECOND_COORDINATE)] = fetchTableByte(m);
  regs.hl = u16(regs.hl + 1);
  regs.a = mem8[regs.hl];
  mem8[u16(entry + FIRST_COORDINATE)] = regs.a;

  for (const [field, value] of RESET_FIELDS) mem8[u16(record + field)] = value;
  mem8[u16(record + STATE)] = LIVE;
}
