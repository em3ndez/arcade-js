// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { DSW2_SNAPSHOT, loc_100, DSW_DIFFICULTY, PENDING_WORK_FLAGS, SLOT_VALUE, GLYPH_PARAM_X, loc_71b, loc_71c, loc_71d, INPUT_SNAPSHOT_HI, INPUT_SNAPSHOT_LO, TEXT_BUFFER_TEMPLATE } from "./names.js";
import { loc_ac20 } from "./loc_ac20.js";
import { loc_ac36 } from "./loc_ac36.js";

// Refresh the edge state, arm the request byte, and when all three sources are idle
// request both rebuild flags; then per request bit copy a template block or fill a
// run of ones, optionally latch the control snapshot, and clear the two request bits.
export function loc_abac(m) {
  const { mem8 } = m;
  loc_ac20(m);
  mem8[loc_100] = 0x08;
  if ((mem8[loc_71b] | mem8[loc_71c] | mem8[loc_71d]) === 0) loc_ac36(m);

  const flags = mem8[PENDING_WORK_FLAGS];
  const copyTop = flags & 0x01 ? 0x17 : 0x0e;
  for (let x = copyTop; x >= 0; x--) mem8[u16(SLOT_VALUE + x)] = mem8[u16(TEXT_BUFFER_TEMPLATE + x)];
  const fillTop = flags & 0x02 ? 0x17 : 0x0e;
  for (let x = fillTop; x >= 0; x--) mem8[u16(GLYPH_PARAM_X + x)] = 0x01;
  if (flags & 0x03) {
    mem8[INPUT_SNAPSHOT_HI] = mem8[DSW2_SNAPSHOT] & 0xf8;
    mem8[INPUT_SNAPSHOT_LO] = mem8[DSW_DIFFICULTY] & 0x03;
  }
  mem8[PENDING_WORK_FLAGS] = flags & 0xfc;
}
