// SPDX-License-Identifier: GPL-3.0-only
/** stepMotherShip — one frame of the Mother-Ship, a deep state machine seated on a fixed
 * record/sprite pair. The record's lead byte is the phase: idle counts a delay down and, once spent,
 * seeds a fresh launch aimed by the player angle; a mid-phase counts a hold down and, at one exact
 * value, tears down and rebuilds the whole fifteen-slot formation; the live phase drifts the pair
 * with the world, dresses it, and — while off cooldown and the player strays into its band — hands a
 * free slot a homing spawn whose heading and stage-vector are computed here. Every callee, the
 * inline jump-table arm included, is reached as a direct call. LIVE-OUT: memory. */

import { u16 } from "../../../core/int.js";
import { fetchTableByte } from "./fetchTableByte.js";
import { fetchTableWord } from "./fetchTableWord.js";
import { postCommand } from "./postCommand.js";
import { driftWithWorldScroll } from "./driftWithWorldScroll.js";
import { headingToward } from "./headingToward.js";
import { dressSpriteForHeadingOrRetireAtEdge } from "./dressSpriteForHeadingOrRetireAtEdge.js";
import { stepMotherShipWarpFlashFrame } from "./stepMotherShipWarpFlashFrame.js";
import { setMotherShipVelocityFromHeading } from "./setMotherShipVelocityFromHeading.js";
import { loc_5634 } from "./loc_5634.js";
import { requestEnemyLaunchSound } from "./requestEnemyLaunchSound.js";
import { requestTwoSounds } from "./requestTwoSounds.js";
import { requestRoundIntroSoundBurst } from "./requestRoundIntroSoundBurst.js";
import { requestCurrentEraSound } from "./requestCurrentEraSound.js";
import { requestMotherShipWarpSound } from "./requestMotherShipWarpSound.js";
import { ACTOR_ENTRY_SLOT2, ACTOR_RECORD_SLOT0, ACTOR_RECORD_SLOT2, BANK_LAUNCH_COOLDOWN, BANK_LAUNCH_COOLDOWN_PERIOD, BANK_LAUNCH_NEAR_HALF_Y, ENEMY_STANDOFF_AIM_MAIN, MOTHER_SHIP_ENTRY, ROUND_TRANSITION_HOLD } from "./names.js";

const RECORD_BANK = 0xa8a0;

const CLEAR_CELL = 0xa8dc;
const SCROLL_X = 0xa808;
const SCROLL_Y = 0xa80a;

const SLOT_STRIDE = 0x0010;
const SLOT_COUNT = 0x0f;
const FIRST_SLOT_CODE = 0x14;
const CODE_STEP = 0x0a;
const SLOT_SOUND = 0x0402;
const INIT_MARKER = 0xe4;
const READY_ARMED = 0xfe;
const SPRITE_SEED = 0x3d;
const REBUILD_TRIGGER = 0xf0;

const IDLE_DELAY = 0x0e;
const HOLD_COUNTER = 0x04;
const STATE = 0x00;

const PLAYER_HEADING = 0xa802;
const FRAME_COUNTER = 0xa980;
const HEADING_TABLE = 0x3c84;
const SHAPE_TABLE = 0x461b;
const WARP_SENTINEL = 0xa800;
const WARP_SOUND = 0x040d;

const FLASH_STATE = 0xb4;
const SPENT_HOLD = 0x5a;
const RESTART_IMAGE = 0xab43;
const RESTART_MATCH = 0x7c;
const RESTART_LOW = 0x10;
const RESTART_HIGH = 0x05;

const NEAR_X = 0x84;
const NEAR_Y = 0x78;
const ON_SCREEN_X = 0x28;
const ON_SCREEN_Y = 0x20;

const NEW_RECORD_PTR = 0xa991;
const NEW_SPRITE_PTR = 0xa993;
const HEADING_TOGGLE = 0xa8b4;
const STAGE = 0xad04;
const ARM_TABLE = 0x478b;
const SECOND_ENTRY = 0x30; // second sprite entry's base offset off iy (mirrors fields 0x00-0x03)

export function stepMotherShip(m) {
  const { regs, mem8 } = m;
  regs.ix = RECORD_BANK;
  regs.iy = MOTHER_SHIP_ENTRY;
  regs.a = mem8[u16(regs.ix + STATE)];
  regs.and(regs.a);
  if (regs.fZ) return loc_43f0_4535(m); // idle
  regs.a = regs.inc8(regs.a);
  if (regs.fNZ) return loc_43f0_4540(m); // mid-phase
  return loc_43f0_4403(m); // live
}

export function loc_43f0_4403(m) {
  const { regs, mem, mem8 } = m;
  const X = (d) => u16(regs.ix + d);
  const Y = (d) => u16(regs.iy + d);

  regs.h = mem8[X(0x0c)];
  regs.l = mem8[X(0x0d)];
  regs.de = mem.read16(SCROLL_X);
  regs.addHl(regs.de);
  regs.d = mem8[Y(0x31)];
  regs.e = mem8[X(0x03)];
  regs.addHl(regs.de);
  mem8[Y(0x31)] = regs.h;
  mem8[X(0x03)] = regs.l;

  regs.h = mem8[X(0x1c)];
  regs.l = mem8[X(0x1d)];
  regs.de = mem.read16(SCROLL_Y);
  regs.addHl(regs.de);
  regs.d = mem8[Y(0x00)];
  regs.e = mem8[X(0x05)];
  regs.addHl(regs.de);
  mem8[Y(0x00)] = regs.h;
  mem8[X(0x05)] = regs.l;

  regs.a = mem8[Y(0x31)];
  regs.add(0x10);
  mem8[Y(0x33)] = regs.a;
  regs.a = mem8[Y(0x00)];
  mem8[Y(0x02)] = regs.a;

  dressSpriteForHeadingOrRetireAtEdge(m);
  return loc_43f0_46f0(m);
}

export function loc_43f0_4535(m) {
  const { regs, mem, mem8 } = m;
  const X = (d) => u16(regs.ix + d);
  regs.a = mem8[X(IDLE_DELAY)];
  regs.and(regs.a);
  if (regs.fZ) return loc_43f0_4663(m);
  regs.decMem8(mem, X(IDLE_DELAY));
}

export function loc_43f0_4540(m) {
  const { regs, mem, mem8 } = m;
  const X = (d) => u16(regs.ix + d);
  regs.c = regs.a; // C = phase + 1
  regs.a = mem8[X(HOLD_COUNTER)];
  regs.and(regs.a);
  if (regs.fZ) return loc_43f0_4554(m);
  regs.decMem8(mem, X(HOLD_COUNTER));
  mem8[X(STATE)] = 0xff; // back to live
  requestTwoSounds(m);
  return loc_43f0_4403(m);
}

export function loc_43f0_4554(m) {
  const { regs, mem8 } = m;
  const X = (d) => u16(regs.ix + d);
  const Y = (d) => u16(regs.iy + d);

  regs.a = regs.c;
  regs.cp(REBUILD_TRIGGER);
  if (regs.fNZ) return loc_43f0_45b3(m);

  regs.xor(regs.a);
  mem8[CLEAR_CELL] = regs.a;
  loc_5634(m);
  requestRoundIntroSoundBurst(m);

  regs.hl = ACTOR_RECORD_SLOT0;
  regs.de = SLOT_STRIDE;
  regs.b = SLOT_COUNT;
  regs.c = FIRST_SLOT_CODE;
  do {
    regs.a = regs.inc8(mem8[regs.hl]); // set when the slot held 0xFF
    if (regs.fNZ) {
      regs.a = regs.inc8(regs.a); // set when the slot held 0xFE
      if (regs.fZ) mem8[regs.hl] = 0x00;
    } else {
      mem8[regs.hl] = regs.c;
      regs.exx();
      regs.de = SLOT_SOUND;
      postCommand(m); // queue this slot's sound
      regs.exx();
    }
    regs.addHl(regs.de);
    regs.a = regs.c;
    regs.add(CODE_STEP);
    regs.c = regs.a;
    regs.djnz();
  } while (regs.b !== 0);

  regs.c = 0x3c;
  regs.a = READY_ARMED;
  mem8[ROUND_TRANSITION_HOLD] = regs.a;
  mem8[X(STATE)] = INIT_MARKER;
  mem8[Y(SECOND_ENTRY)] = SPRITE_SEED;
  mem8[Y(0x32)] = SPRITE_SEED;
}

export function loc_43f0_45b3(m) {
  const { regs, mem, mem8 } = m;
  const X = (d) => u16(regs.ix + d);
  const Y = (d) => u16(regs.iy + d);

  driftWithWorldScroll(m);

  to45dd: {
    to45d5: {
      regs.a = mem8[Y(0x31)];
      regs.b = regs.a;
      regs.add(0x13);
      regs.cp(0x03);
      if (regs.fC) break to45d5;
      regs.a = regs.b;
      regs.add(0x10);
      mem8[Y(0x33)] = regs.a;
      regs.a = mem8[Y(0x00)];
      regs.b = regs.a;
      regs.add(0x08);
      regs.cp(0x28);
      if (regs.fC) break to45d5;
      mem8[Y(0x02)] = regs.b;
      break to45dd;
    }
    mem8[Y(0x01)] = 0xff;
    mem8[Y(0x03)] = 0xff;
  }

  regs.a = mem8[X(STATE)];
  regs.cp(FLASH_STATE);
  if (regs.fZ) return loc_43f0_4623(m);
  if (!regs.fC) {
    regs.sub(FLASH_STATE);
    regs.rrca();
    regs.rrca();
    regs.rrca();
    regs.a = regs.dec8(regs.a);
    regs.and(0x07);
    regs.hl = SHAPE_TABLE;
    fetchTableByte(m);
    mem8[Y(0x03)] = regs.a;
    regs.a = regs.inc8(regs.a);
    mem8[Y(0x01)] = regs.a;
  }

  regs.decMem8(mem, X(STATE));
  if (regs.fZ) return loc_43f0_4646(m);
  regs.a = mem8[X(STATE)];
  regs.cp(SPENT_HOLD);
  if (regs.fNZ) return;
  mem8[Y(0x01)] = 0xff;
  mem8[Y(0x03)] = 0xff;
}

export function loc_43f0_4623(m) {
  const { regs, mem, mem8 } = m;
  const X = (d) => u16(regs.ix + d);
  const Y = (d) => u16(regs.iy + d);

  regs.decMem8(mem, X(STATE));
  mem8[Y(0x01)] = 0xfe;
  mem8[Y(0x03)] = 0xfd;
  mem8[Y(SECOND_ENTRY)] = 0x6c;
  mem8[Y(0x32)] = 0x6c;

  regs.a = regs.inc8(mem8[WARP_SENTINEL]);
  if (regs.fZ) requestMotherShipWarpSound(m);
  regs.de = WARP_SOUND;
  return postCommand(m);
}

export function loc_43f0_4646(m) {
  const { regs, mem8 } = m;
  const X = (d) => u16(regs.ix + d);

  regs.a = 0xff;
  mem8[ROUND_TRANSITION_HOLD] = regs.a;
  mem8[X(STATE)] = 0x00; // idle
  regs.hl = RESTART_IMAGE;
  regs.a = mem8[regs.hl];
  regs.cp(RESTART_MATCH);
  if (regs.fZ) {
    regs.hl = u16(regs.hl + 1);
    regs.a = mem8[regs.hl];
    regs.cp(RESTART_LOW);
    if (regs.fZ) return;
    regs.cp(RESTART_HIGH);
    if (regs.fZ) return;
  }
  return stepMotherShipWarpFlashFrame(m);
}

export function loc_43f0_4663(m) {
  const { regs, mem8 } = m;
  const X = (d) => u16(regs.ix + d);
  const Y = (d) => u16(regs.iy + d);

  regs.a = mem8[ROUND_TRANSITION_HOLD];
  regs.and(regs.a);
  if (regs.fNZ) return; // locked out

  regs.a = mem8[PLAYER_HEADING];
  regs.b = regs.a;
  regs.a = mem8[FRAME_COUNTER];
  regs.c = regs.a;
  regs.a = 0x10;
  regs.bit(3, regs.c);
  if (regs.fZ) regs.neg();

  regs.add(regs.b);
  regs.rrca();
  regs.rrca();
  regs.and(0x3e);
  regs.hl = HEADING_TABLE;
  fetchTableByte(m);
  mem8[Y(0x31)] = regs.a;
  regs.hl = u16(regs.hl + 1);
  regs.a = mem8[regs.hl];
  mem8[Y(0x00)] = regs.a;

  regs.a = regs.b;
  regs.add(0xc0);
  regs.and(0x80);
  mem8[X(0x02)] = regs.a;

  setMotherShipVelocityFromHeading(m);

  regs.a = mem8[X(HOLD_COUNTER)];
  regs.cp(0x06);
  if (regs.fC) mem8[X(HOLD_COUNTER)] = 0x05; // floor
  mem8[X(STATE)] = 0xff; // go live
  return requestCurrentEraSound(m);
}

export function loc_43f0_46f0(m) {
  const { regs, mem8 } = m;
  const X = (d) => u16(regs.ix + d);
  const Y = (d) => u16(regs.iy + d);

  regs.a = regs.inc8(mem8[X(STATE)]);
  if (regs.fNZ) return; // not live
  regs.a = mem8[BANK_LAUNCH_COOLDOWN];
  regs.and(regs.a);
  if (regs.fNZ) return; // cooling down

  regs.b = 0x02;
  regs.a = mem8[BANK_LAUNCH_NEAR_HALF_Y];
  regs.d = regs.a;
  regs.add(regs.a);
  regs.e = regs.a;

  do {
    advance: {
      regs.a = mem8[Y(0x00)];
      regs.add(0x08);
      regs.cp(ON_SCREEN_X);
      if (regs.fC) break advance;
      regs.a = mem8[Y(0x31)];
      regs.add(0x10);
      regs.cp(ON_SCREEN_Y);
      if (regs.fC) break advance;
      regs.a = NEAR_X;
      regs.sub(mem8[Y(0x00)]);
      regs.add(regs.d);
      regs.cp(regs.e);
      if (regs.fNC) return loc_43f0_4734(m);
      regs.a = NEAR_Y;
      regs.sub(mem8[Y(0x31)]);
      regs.add(regs.d);
      regs.cp(regs.e);
      if (regs.fNC) return loc_43f0_4734(m);
    }
    regs.exx();
    regs.de = 0x0010;
    regs.addIx(regs.de);
    regs.iy = u16(regs.iy + 1);
    regs.iy = u16(regs.iy + 1);
    regs.exx();
    regs.djnz();
  } while (regs.b !== 0);
}

export function loc_43f0_4734(m) {
  const { regs, mem8 } = m;

  regs.hl = ACTOR_RECORD_SLOT2;
  regs.exx();
  regs.hl = ACTOR_ENTRY_SLOT2;
  regs.b = 0x02;
  do {
    regs.exx(); // back to the record band pointer
    regs.a = mem8[regs.hl];
    regs.and(regs.a);
    if (regs.fZ) return loc_43f0_474c(m); // a free entry
    regs.de = 0x0010;
    regs.addHl(regs.de);
    regs.exx();
    regs.hl = u16(regs.hl + 1);
    regs.hl = u16(regs.hl + 1);
    regs.djnz();
  } while (regs.b !== 0);
}

export function loc_43f0_474c(m) {
  const { regs, mem, mem8 } = m;
  const X = (d) => u16(regs.ix + d);
  const Y = (d) => u16(regs.iy + d);

  mem.write16(NEW_RECORD_PTR, regs.hl);
  regs.exx();
  mem.write16(NEW_SPRITE_PTR, regs.hl);

  requestEnemyLaunchSound(m);

  regs.hl = ENEMY_STANDOFF_AIM_MAIN;
  headingToward(m);

  regs.h = regs.a;
  regs.exDeHl(); // park the heading byte in DE
  regs.hl = HEADING_TOGGLE;
  regs.incMem8(mem, regs.hl);
  regs.a = 0x18;
  regs.bit(0, mem8[regs.hl]);
  if (regs.fZ) regs.neg();
  regs.exDeHl();
  regs.add(regs.h);

  regs.b = mem8[Y(0x31)];
  regs.c = mem8[Y(0x00)];
  regs.ix = mem.read16(NEW_RECORD_PTR); // retarget at the new entry
  regs.iy = mem.read16(NEW_SPRITE_PTR);
  mem8[X(0x02)] = regs.a; // heading
  mem8[Y(0x31)] = regs.b;
  mem8[Y(0x00)] = regs.c;

  regs.a = mem8[STAGE];
  regs.hl = ARM_TABLE; // the stage-vector arms sit inline just below
  const arm = fetchTableWord(m);
  regs.de = regs.hl;
  regs.hl = arm;
  m.call(arm); // dispatch to the stage's arm directly

  mem8[X(0x0a)] = regs.e;
  mem8[X(0x0b)] = regs.d;
  mem8[X(0x0c)] = regs.c;
  mem8[X(0x0d)] = regs.b;
  mem8[Y(0x01)] = 0x4d;
  mem8[Y(SECOND_ENTRY)] = 0x62;
  regs.decMem8(mem, X(STATE)); // 0x00 -> 0xFF: the entry is live
  regs.a = mem8[BANK_LAUNCH_COOLDOWN_PERIOD];
  mem8[BANK_LAUNCH_COOLDOWN] = regs.a; // re-arm the cooldown
}
