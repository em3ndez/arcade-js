// SPDX-License-Identifier: GPL-3.0-only
/** stepMotherShip — one frame of the Mother-Ship, a deep state machine seated on a fixed
 * record/sprite pair. The record's lead byte is the phase: idle counts a delay down and, once spent,
 * seeds a fresh launch aimed by the player angle; a mid-phase counts a hold down and, at one exact
 * value, tears down and rebuilds the whole fifteen-slot formation; the live phase drifts the pair
 * with the world, dresses it, and — while off cooldown and the player strays into its band — hands a
 * free slot a homing spawn whose heading and stage-vector are computed here. Every callee, the
 * inline jump-table arm included, is reached as a direct call. LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { NotImplemented } from "../../../boards/timeplt/io.js";
import { fetchTableByte } from "./fetchTableByte.js";
import { loc_598e } from "./loc_598e.js";
import { loc_5994 } from "./loc_5994.js";
import { postCommand } from "./postCommand.js";
import { driftWithWorldScroll } from "./driftWithWorldScroll.js";
import { headingToward } from "./headingToward.js";
import { dressSpriteForHeadingOrRetireAtEdge } from "./dressSpriteForHeadingOrRetireAtEdge.js";
import { stepMotherShipWarpFlashFrame } from "./stepMotherShipWarpFlashFrame.js";
import { setMotherShipVelocityFromHeading } from "./setMotherShipVelocityFromHeading.js";
import { enqueueTransitionSoundBurst } from "./enqueueTransitionSoundBurst.js";
import { requestEnemyLaunchSound } from "./requestEnemyLaunchSound.js";
import { requestTwoSounds } from "./requestTwoSounds.js";
import { requestRoundIntroSoundBurst } from "./requestRoundIntroSoundBurst.js";
import { requestCurrentEraSound } from "./requestCurrentEraSound.js";
import { requestMotherShipWarpSound } from "./requestMotherShipWarpSound.js";
import { ACTOR_ENTRY_SLOT2, ACTOR_RECORD_SLOT0, ACTOR_RECORD_SLOT2, BANK_LAUNCH_COOLDOWN, BANK_LAUNCH_COOLDOWN_PERIOD, BANK_LAUNCH_NEAR_HALF_Y, ENEMY_STANDOFF_AIM_MAIN, ERA_INDEX, FRAME_TICK, HITS_REMAINING, MOTHER_SHIP_AIM_SIDE_TOGGLE, MOTHER_SHIP_ENTRY, MOTHER_SHIP_STATE, PLAYER_HEADING, PLAYER_STATE, ROUND_TRANSITION_HOLD, SCRATCH_PTR_A, SCRATCH_PTR_B, TAMPER_GLYPH_COPY, WORLD_SCROLL_X, WORLD_SCROLL_Y, HEADING_SHAPE_TABLE, MOTHER_SHIP_WARP_SHAPE_TABLE } from "./names.js";

const SLOT_STRIDE = 0x10;
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

const WARP_SOUND = 0x040d;

const FLASH_STATE = 0xb4;
const SPENT_HOLD = 0x5a;
const RESTART_MATCH = 0x7c;
const RESTART_LOW = 0x10;
const RESTART_HIGH = 0x05;

const NEAR_X = 0x84;
const NEAR_Y = 0x78;
const ON_SCREEN_X = 0x28;
const ON_SCREEN_Y = 0x20;

const SECOND_ENTRY = 0x30; // second sprite entry's base offset off iy (mirrors fields 0x00-0x03)

export function stepMotherShip(m) {
  const { regs, mem8 } = m;
  const state = mem8[u16(MOTHER_SHIP_STATE + STATE)];
  // set the record/sprite pair on the dispatch so each callee reads regs.ix/iy by default
  if (state === 0x00) return (regs.ix = MOTHER_SHIP_STATE, regs.iy = MOTHER_SHIP_ENTRY, loc_43f0_4535(m)); // idle
  if (u8(state + 1) !== 0x00) return (regs.ix = MOTHER_SHIP_STATE, regs.iy = MOTHER_SHIP_ENTRY, loc_43f0_4540(m, u8(state + 1))); // mid-phase (C = phase + 1)
  return (regs.ix = MOTHER_SHIP_STATE, regs.iy = MOTHER_SHIP_ENTRY, loc_43f0_4403(m)); // live
}

export function loc_43f0_4403(m, ix = m.regs.ix, iy = m.regs.iy) {
  const { mem8, mem16 } = m;
  const X = (d) => u16(ix + d);
  const Y = (d) => u16(iy + d);

  // HL = record velocity (X+0c/0d) + world-Y scroll + sprite Y (Y+31 : X+03); split back to Y+31 : X+03
  let hl = u16(((mem8[X(0x0c)] << 8) | mem8[X(0x0d)]) + mem16[WORLD_SCROLL_Y]);
  hl = u16(hl + ((mem8[Y(0x31)] << 8) | mem8[X(0x03)]));
  mem8[Y(0x31)] = hl >> 8;
  mem8[X(0x03)] = u8(hl);

  let hx = u16(((mem8[X(0x1c)] << 8) | mem8[X(0x1d)]) + mem16[WORLD_SCROLL_X]);
  hx = u16(hx + ((mem8[Y(0x00)] << 8) | mem8[X(0x05)]));
  mem8[Y(0x00)] = hx >> 8;
  mem8[X(0x05)] = u8(hx);

  mem8[Y(0x33)] = u8(mem8[Y(0x31)] + 0x10);
  mem8[Y(0x02)] = mem8[Y(0x00)];

  dressSpriteForHeadingOrRetireAtEdge(m);
  return loc_43f0_46f0(m);
}

export function loc_43f0_4535(m, ix = m.regs.ix) {
  const { mem8 } = m;
  const X = (d) => u16(ix + d);
  if (mem8[X(IDLE_DELAY)] === 0x00) return loc_43f0_4663(m);
  mem8[X(IDLE_DELAY)] = u8(mem8[X(IDLE_DELAY)] - 1);
}

export function loc_43f0_4540(m, phase = m.regs.a, ix = m.regs.ix) {
  const { mem8 } = m;
  const X = (d) => u16(ix + d);
  if (mem8[X(HOLD_COUNTER)] === 0x00) return loc_43f0_4554(m, phase);
  mem8[X(HOLD_COUNTER)] = u8(mem8[X(HOLD_COUNTER)] - 1);
  mem8[X(STATE)] = 0xff; // back to live
  requestTwoSounds(m);
  return loc_43f0_4403(m);
}

export function loc_43f0_4554(m, phase = m.regs.c, ix = m.regs.ix, iy = m.regs.iy) {
  const { mem8 } = m;
  const X = (d) => u16(ix + d);
  const Y = (d) => u16(iy + d);

  if (phase !== REBUILD_TRIGGER) return loc_43f0_45b3(m);

  mem8[HITS_REMAINING] = 0x00;
  enqueueTransitionSoundBurst(m);
  requestRoundIntroSoundBurst(m);

  // Rebuild the fifteen-slot formation: a slot holding 0xFF is seeded with its stepped code and its
  // sound queued; a slot holding 0xFE is cleared to 0x00; anything else is left alone.
  let slot = ACTOR_RECORD_SLOT0;
  let code = FIRST_SLOT_CODE;
  let count = SLOT_COUNT;
  do {
    const held = mem8[slot];
    if (held === 0xff) {
      mem8[slot] = code;
      postCommand(m, (SLOT_SOUND >> 8) & 0xff, SLOT_SOUND & 0xff); // queue this slot's sound
    } else if (u8(held + 2) === 0x00) {
      mem8[slot] = 0x00; // slot held 0xFE
    }
    slot = u16(slot + SLOT_STRIDE);
    code = u8(code + CODE_STEP);
    count = u8(count - 1);
  } while (count !== 0);

  mem8[ROUND_TRANSITION_HOLD] = READY_ARMED;
  mem8[X(STATE)] = INIT_MARKER;
  mem8[Y(SECOND_ENTRY)] = SPRITE_SEED;
  mem8[Y(0x32)] = SPRITE_SEED;
}

export function loc_43f0_45b3(m, ix = m.regs.ix, iy = m.regs.iy) {
  const { mem8 } = m;
  const X = (d) => u16(ix + d);
  const Y = (d) => u16(iy + d);

  driftWithWorldScroll(m);

  // Dress the pair unless its heading or Y is out of range -> flag 0xFF instead. b holds the
  // heading (or, past the first gate, the Y) -- a genuine live-in threaded to the warp/flash tail.
  const heading = mem8[Y(0x31)];
  let b = heading;
  let flatten = false;
  if (u8(heading + 0x13) < 0x03) {
    flatten = true;
  } else {
    mem8[Y(0x33)] = u8(heading + 0x10);
    const yval = mem8[Y(0x00)];
    b = yval;
    if (u8(yval + 0x08) < 0x28) flatten = true;
    else mem8[Y(0x02)] = yval;
  }
  if (flatten) {
    mem8[Y(0x01)] = 0xff;
    mem8[Y(0x03)] = 0xff;
  }

  const state = mem8[X(STATE)];
  if (state === FLASH_STATE) return loc_43f0_4623(m);
  if (state > FLASH_STATE) {
    let sh = u8(state - FLASH_STATE);
    sh = ((sh >> 3) | (sh << 5)) & 0xff; // RRCA x3
    sh = u8(sh - 1) & 0x07;
    const shape = fetchTableByte(m, MOTHER_SHIP_WARP_SHAPE_TABLE, sh);
    mem8[Y(0x03)] = shape;
    mem8[Y(0x01)] = u8(shape + 1);
  }

  const spent = u8(mem8[X(STATE)] - 1);
  mem8[X(STATE)] = spent;
  if (spent === 0x00) return loc_43f0_4646(m, ix, b);
  if (mem8[X(STATE)] !== SPENT_HOLD) return;
  mem8[Y(0x01)] = 0xff;
  mem8[Y(0x03)] = 0xff;
}

export function loc_43f0_4623(m, ix = m.regs.ix, iy = m.regs.iy) {
  const { mem8 } = m;
  const X = (d) => u16(ix + d);
  const Y = (d) => u16(iy + d);

  mem8[X(STATE)] = u8(mem8[X(STATE)] - 1);
  mem8[Y(0x01)] = 0xfe;
  mem8[Y(0x03)] = 0xfd;
  mem8[Y(SECOND_ENTRY)] = 0x6c;
  mem8[Y(0x32)] = 0x6c;

  if (u8(mem8[PLAYER_STATE] + 1) === 0x00) requestMotherShipWarpSound(m);
  return postCommand(m, (WARP_SOUND >> 8) & 0xff, WARP_SOUND & 0xff);
}

export function loc_43f0_4646(m, ix = m.regs.ix, b = m.regs.b) {
  const { mem8 } = m;
  const X = (d) => u16(ix + d);

  mem8[ROUND_TRANSITION_HOLD] = 0xff;
  mem8[X(STATE)] = 0x00; // idle
  if (mem8[TAMPER_GLYPH_COPY] === RESTART_MATCH) {
    const next = mem8[u16(TAMPER_GLYPH_COPY + 1)];
    if (next === RESTART_LOW) return;
    if (next === RESTART_HIGH) return;
  }
  return stepMotherShipWarpFlashFrame(m, b);
}

export function loc_43f0_4663(m, ix = m.regs.ix, iy = m.regs.iy) {
  const { mem8 } = m;
  const X = (d) => u16(ix + d);
  const Y = (d) => u16(iy + d);

  if (mem8[ROUND_TRANSITION_HOLD] !== 0x00) return; // locked out

  const player = mem8[PLAYER_HEADING];
  // +/-0x10 by the tick's bit 3, biased by the player heading, then two RRCA and mask -> table index
  let idx = (mem8[FRAME_TICK] & 0x08) ? 0x10 : u8(0 - 0x10);
  idx = u8(idx + player);
  idx = ((idx >> 2) | (idx << 6)) & 0xff; // RRCA x2
  idx &= 0x3e;
  const entry = u16(HEADING_SHAPE_TABLE + idx);
  mem8[Y(0x31)] = fetchTableByte(m, HEADING_SHAPE_TABLE, idx);
  mem8[Y(0x00)] = mem8[u16(entry + 1)];

  mem8[X(0x02)] = u8(player + 0xc0) & 0x80;

  setMotherShipVelocityFromHeading(m);

  if (mem8[X(HOLD_COUNTER)] < 0x06) mem8[X(HOLD_COUNTER)] = 0x05; // floor
  mem8[X(STATE)] = 0xff; // activate the mothership
  return requestCurrentEraSound(m);
}

export function loc_43f0_46f0(m, ix = m.regs.ix, iy = m.regs.iy) {
  const { regs, mem8 } = m;
  // ix/iy walk the two-slot bank and stay live: on a spawn they carry the current record/entry into
  // loc_43f0_4734, so each advance writes them back to regs.
  const X = (d) => u16(ix + d);
  const Y = (d) => u16(iy + d);

  if (u8(mem8[X(STATE)] + 1) !== 0x00) return; // not live
  if (mem8[BANK_LAUNCH_COOLDOWN] !== 0x00) return; // cooling down

  const halfBand = mem8[BANK_LAUNCH_NEAR_HALF_Y]; // D
  const band = u8(halfBand + halfBand); // E
  let count = 0x02;
  do {
    // On screen in both axes, and inside the near band on both axes -> hand a free slot a spawn.
    if (u8(mem8[Y(0x00)] + 0x08) >= ON_SCREEN_X && u8(mem8[Y(0x31)] + 0x10) >= ON_SCREEN_Y) {
      if (u8(u8(NEAR_X - mem8[Y(0x00)]) + halfBand) >= band) return loc_43f0_4734(m);
      if (u8(u8(NEAR_Y - mem8[Y(0x31)]) + halfBand) >= band) return loc_43f0_4734(m);
    }
    ix = u16(ix + 0x10);
    iy = u16(iy + 2);
    regs.ix = ix;
    regs.iy = iy;
    count = u8(count - 1);
  } while (count !== 0);
}

export function loc_43f0_4734(m) {
  const { mem8 } = m;

  let recordPtr = ACTOR_RECORD_SLOT2;
  let entryPtr = ACTOR_ENTRY_SLOT2;
  let count = 0x02;
  do {
    if (mem8[recordPtr] === 0x00) return loc_43f0_474c(m, recordPtr, entryPtr); // a free entry
    recordPtr = u16(recordPtr + 0x10);
    entryPtr = u16(entryPtr + 2);
    count = u8(count - 1);
  } while (count !== 0);
}

export function loc_43f0_474c(m, recordPtr = m.regs.hl, entryPtr = m.regs.hl, iy = m.regs.iy) {
  const { regs, mem8, mem16 } = m;

  mem16[SCRATCH_PTR_A] = recordPtr;
  mem16[SCRATCH_PTR_B] = entryPtr;

  requestEnemyLaunchSound(m);

  // Aim: the heading at the player, nudged +/-0x18 by an alternating side toggle.
  const heading = headingToward(m, ENEMY_STANDOFF_AIM_MAIN); // object = iy (mother-ship entry)
  mem8[MOTHER_SHIP_AIM_SIDE_TOGGLE] = u8(mem8[MOTHER_SHIP_AIM_SIDE_TOGGLE] + 1);
  let aim = (mem8[MOTHER_SHIP_AIM_SIDE_TOGGLE] & 0x01) ? 0x18 : u8(0 - 0x18);
  aim = u8(aim + heading);

  // Carry the mother-ship's own heading/X across the retarget, then re-point ix/iy at the new slot.
  const spriteHeading = mem8[u16(iy + 0x31)];
  const spriteX = mem8[u16(iy + 0x00)];
  regs.ix = recordPtr; // retarget at the new entry (live-out; the stage arm reads ix/iy)
  regs.iy = entryPtr;
  const X = (d) => u16(recordPtr + d);
  const Y = (d) => u16(entryPtr + d);
  mem8[X(0x02)] = aim;
  mem8[Y(0x31)] = spriteHeading;
  mem8[Y(0x00)] = spriteX;

  // Dispatch the era's stage arm directly. The fixed five-word table below the entry names the
  // slowest-sample arm for the two opening eras and the faster arm for eras two through four; each
  // arm reads the record's heading and hands the doubled component pair back in E/D/C/B, which is
  // read out into the record's 0x0a..0x0d cells just below. Later eras name no arm and are surfaced
  // as a fault, exactly as reaching past the table would.
  const era = mem8[ERA_INDEX];
  switch (era) {
    case 0:
    case 1:
      loc_598e(m);
      break;
    case 2:
    case 3:
    case 4:
      loc_5994(m);
      break;
    default:
      throw new NotImplemented(`loc_43f0_474c: no stage arm for era ${era}`);
  }

  mem8[X(0x0a)] = regs.e;
  mem8[X(0x0b)] = regs.d;
  mem8[X(0x0c)] = regs.c;
  mem8[X(0x0d)] = regs.b;
  mem8[Y(0x01)] = 0x4d;
  mem8[Y(SECOND_ENTRY)] = 0x62;
  mem8[X(STATE)] = u8(mem8[X(STATE)] - 1); // 0x00 -> 0xFF: the entry is live
  mem8[BANK_LAUNCH_COOLDOWN] = mem8[BANK_LAUNCH_COOLDOWN_PERIOD]; // re-arm the cooldown
}
