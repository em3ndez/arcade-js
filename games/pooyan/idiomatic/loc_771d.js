// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_0020 } from "./loc_0020.js";
import { loc_7740 } from "./loc_7740.js";
import { SPAWN_RING_COUNTER, SPAWN_WORD_TABLE } from "./names.js";
/**
 * loc_771d — object-state 0: arm a new object (entry 0 of the object-state dispatch).
 *
 * The +0x11 frame countdown ticks each frame; while counting it just returns. On expiry it pulls the
 * next spawn index from the ring (read, ++), stores it at +0x13, copies that index's spawn-table word
 * into +0x15/+0x16, seeds the speed +0x0a, advances the state +2, and falls through into the state-1
 * mover so the freshly-armed object also moves this frame. LIVE-OUT: none (memory only).
 */
export function loc_771d(m, record = m.regs.ix) {
  const { mem8 } = m;

  const countdown = (mem8[record + 0x11] - 1) & 0xff; // dec (ix+0x11)
  mem8[record + 0x11] = countdown;
  if (countdown !== 0) return; // still counting -> return

  const spawnIndex = mem8[SPAWN_RING_COUNTER]; // next spawn index, then advance the ring
  mem8[SPAWN_RING_COUNTER] = spawnIndex + 1;
  mem8[record + 0x13] = spawnIndex;

  const [wordLow, ptr] = loc_0020(m, SPAWN_WORD_TABLE, (spawnIndex * 2) & 0xff);
  mem8[record + 0x15] = wordLow;
  mem8[record + 0x16] = mem8[u16(ptr + 1)]; // spawn word high byte
  mem8[record + 0x0a] = 0xec;
  mem8[record + 0x02] = mem8[record + 0x02] + 1; // advance state -> state 1

  return loc_7740(m, record); // fall through into state 1 (mover); its ret carries our caller
}
