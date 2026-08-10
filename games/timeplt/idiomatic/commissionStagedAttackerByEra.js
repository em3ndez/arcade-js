// SPDX-License-Identifier: GPL-3.0-only
/** commissionStagedAttackerByEra — commission the object the slot-finder staged, whose record and paired-entry pointers
 * wait in two fixed cells. Copies the spawner's two coordinate pairs and the caller's facing byte
 * across into the new slot, then fits it out one of four ways chosen by the current era: era zero
 * an unaimed drift with a mirror flag and a slow-fall marker; eras one and two a heading toward a
 * fixed screen point skewed by a stored half-turn; era three a velocity vector for a heading
 * offset a fixed step either side of the facing; era four a straight aim at that same point, with
 * one extra byte seeded. Every way winds the new slot's active count down, re-arms the spawn
 * cooldown, restores the spawner's own index registers and hands off to one era-specific sound
 * request. LIVE-OUT: memory, and whatever the sound request leaves. */

import { loc_598e } from "./loc_598e.js";
import { loc_3faf } from "./loc_3faf.js";
import { headingToward } from "./headingToward.js";
import { loc_5664 } from "./loc_5664.js";
import { loc_5674 } from "./loc_5674.js";
import { requestTwoSoundsWhilePlaying } from "./requestTwoSoundsWhilePlaying.js";
import { u8 } from "../../../core/int.js";
import { ATTACKER_SPAWN_AIM_WINDOW_HALF, ATTACKER_SPAWN_COOLDOWN, ATTACKER_SPAWN_COOLDOWN_PERIOD, ENEMY_STANDOFF_AIM_MAIN } from "./names.js";

const NEW_RECORD = 0xa991;
const NEW_ENTRY = 0xa993;
const ERA = 0xad04;
const OFFSET_STEP = 0x1a;

export function commissionStagedAttackerByEra(m, spawnerRecord = m.regs.ix, spawnerEntry = m.regs.iy) {
  const { regs, mem8 } = m;

  const d = mem8[spawnerEntry + 0x31];
  const e = mem8[spawnerRecord + 0x03];
  const h = mem8[spawnerEntry + 0x00];
  const l = mem8[spawnerRecord + 0x05];
  const facing = regs.c;

  const record = m.mem16[NEW_RECORD];
  const entry = m.mem16[NEW_ENTRY];
  regs.ix = record;
  regs.iy = entry;

  mem8[record + 0x03] = e;
  mem8[entry + 0x31] = d;
  mem8[record + 0x05] = l;
  mem8[entry + 0x00] = h;
  mem8[record + 0x01] = facing;

  const era = mem8[ERA];

  const tailOff = (tail) => {
    mem8[record + 0x00] = u8(mem8[record + 0x00] - 1);
    mem8[ATTACKER_SPAWN_COOLDOWN] = mem8[ATTACKER_SPAWN_COOLDOWN_PERIOD];
    regs.ix = spawnerRecord;
    regs.iy = spawnerEntry;
    return tail(m);
  };

  if (era === 0) {
    mem8[entry + 0x01] = 0x4f;
    let a = ((facing >> 1) | (facing << 7)) & 0xff; // rrca
    a = (a >> 1) | (a & 0x80); // sra a: keep only the facing's bit 0, in bits 7 and 6
    mem8[entry + 0x30] = ((a & 0xc0) + 0x0b) & 0xff;
    mem8[record + 0x07] = 0x00;
    mem8[record + 0x08] = 0xff;
    return tailOff(loc_5664);
  }

  if (era === 4) mem8[record + 0x04] = mem8[ATTACKER_SPAWN_AIM_WINDOW_HALF];

  if (era === 3) {
    const backHalf = (facing + 0x40) & 0x80; // which half of the circle the facing lies in
    mem8[record + 0x02] = backHalf ? u8(facing - OFFSET_STEP) : u8(facing + OFFSET_STEP);
    loc_598e(m);
    mem8[record + 0x0a] = regs.e;
    mem8[record + 0x0b] = regs.d;
    mem8[record + 0x0c] = regs.c;
    mem8[record + 0x0d] = regs.b;
    mem8[record + 0x02] = facing;
    loc_3faf(m);
    mem8[record + 0x0e] = 0x20;
    return tailOff(requestTwoSoundsWhilePlaying);
  }

  regs.hl = ENEMY_STANDOFF_AIM_MAIN;
  headingToward(m);
  mem8[record + 0x01] = regs.a;
  if (era >= 3) {
    mem8[record + 0x02] = regs.a;
  } else {
    let a = ((mem8[record + 0x0f] >> 1) | (mem8[record + 0x0f] << 7)) & 0xff; // rrca
    a = (a & 0x80) + 0x40; // +/- half a turn from bit 0 of the stored byte
    mem8[record + 0x02] = (a + mem8[record + 0x01]) & 0xff;
  }
  loc_3faf(m);
  mem8[record + 0x0e] = 0x00;
  return tailOff(era >= 3 ? loc_5674 : requestTwoSoundsWhilePlaying);
}
