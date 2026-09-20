// SPDX-License-Identifier: GPL-3.0-only
/** launchBankEnemyWhenAimedNearPlayer — one gated attempt to launch an enemy into the object bank. Four gates guard it: a
 * phase key that only lets one bank phase through, an arm flag, a non-empty flight count, and a
 * free record in the bank being found by a strided downward scan. When all pass, three margin
 * windows must place the aim point near enough to the player entry and to the scroll; only then
 * does it request the launch sound, copy the player entry's two coordinates into the found record's
 * paired entry, look a velocity pair up from the heading (one of two tables, chosen by a select
 * cell), stock the record with that velocity, stamp two entry constants, re-arm the flag from its
 * source, and count the record head down one. The scan cursors, the margin scratch and the found
 * pointers are JS locals; the two entry pointers ride in on ix/iy and are never disturbed, so both
 * stay seated as the only register live-outs (the sprite/steer callees downstream read them). The
 * accumulator is re-seated only where the heading and velocity callees read it. LIVE-OUT: the found
 * record and its entry, the pointer cells, the arm flag; and ix/iy held. Nothing is returned. */

import { u8, u16 } from "../../../core/int.js";
import { headingToward } from "./headingToward.js";
import { requestEraKeyedLaunchSound } from "./requestEraKeyedLaunchSound.js";
import { loc_59cb } from "./loc_59cb.js";
import { loc_59d1 } from "./loc_59d1.js";
import { ACTOR_ENTRY_SLOT0, ACTOR_RECORD_SLOT0, ATTACKER_SPAWN_AIM_WINDOW_HALF, BANK_LAUNCH_COOLDOWN, BANK_LAUNCH_COOLDOWN_PERIOD, BANK_LAUNCH_NEAR_HALF_X, BANK_LAUNCH_NEAR_HALF_Y, BANK_LAUNCH_SLOT_COUNT, ENEMY_STANDOFF_AIM_MAIN, ERA_INDEX, FRAME_TICK, PLAYER_HEADING, SCRATCH_PTR_A, SCRATCH_PTR_B } from "./names.js";

const SPRITE_STATE = 0x30;

const PHASE_KEY = 0x0f;
const OBJ_X = 0x02;
const COORD_Y = 0x31;
const VELOCITY = 0x0a;
const RECORD_STRIDE = 0x10;

export function launchBankEnemyWhenAimedNearPlayer(m, ixEntry = m.regs.ix, iyEntry = m.regs.iy) {
  const { regs, mem8, mem16 } = m;

  if (((mem8[FRAME_TICK] & 0x07) + 0x05) !== mem8[u16(ixEntry + PHASE_KEY)]) return; // wrong bank phase this frame
  if (mem8[BANK_LAUNCH_COOLDOWN] !== 0) return; // launch already armed

  if (mem8[BANK_LAUNCH_SLOT_COUNT] === 0) return;
  let record = ACTOR_RECORD_SLOT0;
  let entry = ACTOR_ENTRY_SLOT0;
  let count = mem8[BANK_LAUNCH_SLOT_COUNT];

  let freeSlot = false;
  do {
    if (mem8[record] === 0) { freeSlot = true; break; }
    record = (record & 0xff00) | u8((record & 0xff) + RECORD_STRIDE);
    entry = (entry & 0xff00) | u8((entry & 0xff) + 2);
    count = u8(count - 1);
  } while (count !== 0);
  if (!freeSlot) return; // bank full

  mem16[SCRATCH_PTR_A] = record;
  mem16[SCRATCH_PTR_B] = entry;

  // margin window against the player entry: vertical, and horizontal only if the vertical is close
  const halfY = mem8[BANK_LAUNCH_NEAR_HALF_Y];
  const fullY = u8(halfY + halfY);
  let near = u8(u8(0x78 - mem8[u16(iyEntry + COORD_Y)]) + halfY);
  if (near < fullY) {
    near = u8(u8(0x84 - mem8[iyEntry]) + halfY);
    if (near < fullY) return;
  }

  const halfX = mem8[BANK_LAUNCH_NEAR_HALF_X];
  const fullX = u8(halfX + halfX);
  const nearX = u8(u8(mem8[PLAYER_HEADING] - mem8[u16(ixEntry + OBJ_X)]) + halfX);
  if (nearX >= fullX) return;

  // the entry cursor's high byte is the bank page and nothing rewrites it, so this window never
  // fires; kept as a faithful mirror of the detached block
  if ((entry >> 8) === 0x02) {
    const halfAim = mem8[ATTACKER_SPAWN_AIM_WINDOW_HALF];
    const fullAim = u8(halfAim + halfAim);
    const nearAim = u8(u8(0x84 - mem8[iyEntry]) + halfAim);
    if (nearAim >= fullAim) return;
  }

  const heading = headingToward(m, ENEMY_STANDOFF_AIM_MAIN);
  const aim = u8(u8(heading - mem8[u16(ixEntry + OBJ_X)]) + 0x10);
  if (aim >= 0x20) return; // aim not aligned to the object's own heading

  requestEraKeyedLaunchSound(m);

  const coordY = mem8[u16(iyEntry + COORD_Y)];
  const coordX = mem8[iyEntry];
  const recIx = mem16[SCRATCH_PTR_A];
  const entIy = mem16[SCRATCH_PTR_B];
  mem8[u16(entIy + COORD_Y)] = coordY;
  mem8[entIy] = coordX;

  regs.a = heading; // the velocity shim reads the heading out of the accumulator
  const [de, bc] = mem8[ERA_INDEX] !== 0 ? loc_59d1(m) : loc_59cb(m);

  // the shim's doubled pair: de then bc, stored low, high, low, high
  mem8[u16(recIx + VELOCITY + 0)] = de;
  mem8[u16(recIx + VELOCITY + 1)] = de >> 8;
  mem8[u16(recIx + VELOCITY + 2)] = bc;
  mem8[u16(recIx + VELOCITY + 3)] = bc >> 8;
  mem8[u16(entIy + 0x01)] = 0x4d;
  mem8[u16(entIy + SPRITE_STATE)] = 0x62;
  mem8[BANK_LAUNCH_COOLDOWN] = mem8[BANK_LAUNCH_COOLDOWN_PERIOD];
  mem8[recIx] = u8(mem8[recIx] - 1);
}
