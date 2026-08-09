// SPDX-License-Identifier: GPL-3.0-only
/** loc_3ed6 — one gated attempt to launch an enemy into the object bank. Four gates guard it: a
 * phase key that only lets one bank phase through, an arm flag, a non-empty flight count, and a
 * free record in the bank being found by a strided downward scan. When all pass, three margin
 * windows must place the aim point near enough to the player entry and to the scroll; only then
 * does it request the launch sound, copy the player entry's two coordinates into the found record's
 * paired entry, look a velocity pair up from the heading (one of two tables, chosen by a select
 * cell), stock the record with that velocity, stamp two entry constants, re-arm the flag from its
 * source, and count the record head down one. LIVE-OUT: the found record and its entry, the
 * pointer cells, the arm flag. Nothing is returned. */

import { u8, u16 } from "../../../core/int.js";
import { headingToward } from "./headingToward.js";
import { requestEraKeyedLaunchSound } from "./requestEraKeyedLaunchSound.js";
import { loc_59cb } from "./loc_59cb.js";
import { loc_59d1 } from "./loc_59d1.js";

const SPAWN_PHASE = 0xa980;
const SPAWN_GUARD = 0xa817;
const ARM_SOURCE = 0xa814;
const SPRITE_STATE = 0x30;
const FLIGHT_COUNT = 0xa844;
const RECORD_BANK = 0xa810;
const ENTRY_BANK = 0xaa12;
const FREE_RECORD = 0xa991;
const FREE_ENTRY = 0xa993;
const NEAR_MARGIN_Y = 0xa827;
const SCROLL_ANGLE = 0xa802;
const NEAR_MARGIN_X = 0xa837;
const ALT_MARGIN = 0xa8e6;
const AIM_POINT = 0xac7f;
const VELOCITY_SELECT = 0xad04;

const PHASE_KEY = 0x0f;
const OBJ_X = 0x02;
const COORD_Y = 0x31;
const VELOCITY = 0x0a;
const RECORD_STRIDE = 0x10;

export function loc_3ed6(m) {
  const { regs, mem8, mem } = m;

  regs.a = mem8[SPAWN_PHASE];
  regs.and(0x07);
  regs.add(0x05);
  regs.cp(mem8[u16(regs.ix + PHASE_KEY)]);
  if (regs.fNZ) return; // wrong bank phase this frame
  if (mem8[SPAWN_GUARD] !== 0) return; // launch already armed

  regs.hl = RECORD_BANK;
  regs.de = ENTRY_BANK;
  if (mem8[FLIGHT_COUNT] === 0) return;
  regs.b = mem8[FLIGHT_COUNT];

  let freeSlot = false;
  do {
    if (mem8[regs.hl] === 0) { freeSlot = true; break; }
    regs.l = u8(regs.l + RECORD_STRIDE);
    regs.e = u8(regs.e + 1);
    regs.e = u8(regs.e + 1);
    regs.djnz();
  } while (regs.b !== 0);
  if (!freeSlot) return; // bank full

  mem.write16(FREE_RECORD, regs.hl);
  mem.write16(FREE_ENTRY, regs.de);

  // margin window against the player entry: vertical, and horizontal only if the vertical is close
  regs.a = mem8[NEAR_MARGIN_Y];
  regs.b = regs.a;
  regs.add(regs.a);
  regs.c = regs.a;
  regs.a = 0x78;
  regs.sub(mem8[u16(regs.iy + COORD_Y)]);
  regs.add(regs.b);
  regs.cp(regs.c);
  if (!regs.fNC) {
    regs.a = 0x84;
    regs.sub(mem8[regs.iy]);
    regs.add(regs.b);
    regs.cp(regs.c);
    if (regs.fC) return;
  }

  regs.a = mem8[NEAR_MARGIN_X];
  regs.b = regs.a;
  regs.add(regs.a);
  regs.c = regs.a;
  regs.a = mem8[SCROLL_ANGLE];
  regs.sub(mem8[u16(regs.ix + OBJ_X)]);
  regs.add(regs.b);
  regs.cp(regs.c);
  if (regs.fNC) return;

  // d is ENTRY_BANK's high byte (0xaa) and nothing rewrites it, so this window never fires; kept
  // as a faithful mirror of the detached block
  if (regs.d === 0x02) {
    regs.a = mem8[ALT_MARGIN];
    regs.b = regs.a;
    regs.add(regs.a);
    regs.c = regs.a;
    regs.a = 0x84;
    regs.sub(mem8[regs.iy]);
    regs.add(regs.b);
    regs.cp(regs.c);
    if (regs.fNC) return;
  }

  regs.hl = AIM_POINT;
  const heading = headingToward(m);
  regs.sub(mem8[u16(regs.ix + OBJ_X)]);
  regs.add(0x10);
  regs.cp(0x20);
  if (regs.fNC) return; // aim not aligned to the object's own heading

  requestEraKeyedLaunchSound(m);

  const savedIx = regs.ix;
  const savedIy = regs.iy;
  regs.d = mem8[u16(savedIy + COORD_Y)];
  regs.e = mem8[savedIy];
  regs.ix = mem.read16(FREE_RECORD);
  regs.iy = mem.read16(FREE_ENTRY);
  mem8[u16(regs.iy + COORD_Y)] = regs.d;
  mem8[regs.iy] = regs.e;

  regs.a = heading;
  if (mem8[VELOCITY_SELECT] !== 0) loc_59d1(m);
  else loc_59cb(m);

  mem8[u16(regs.ix + VELOCITY + 0)] = regs.e;
  mem8[u16(regs.ix + VELOCITY + 1)] = regs.d;
  mem8[u16(regs.ix + VELOCITY + 2)] = regs.c;
  mem8[u16(regs.ix + VELOCITY + 3)] = regs.b;
  mem8[u16(regs.iy + 0x01)] = 0x4d;
  mem8[u16(regs.iy + SPRITE_STATE)] = 0x62;
  regs.a = mem8[ARM_SOURCE];
  mem8[SPAWN_GUARD] = regs.a;
  mem8[regs.ix] = u8(mem8[regs.ix] - 1);
  regs.iy = savedIy;
  regs.ix = savedIx;
}
