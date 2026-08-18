// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnSpriteObjectArmA — dispatcher-A sprite-object spawn arm, live once the slot count reaches 3.
 * Counts down the record's spawn timer; on expiry, with the object idle, it rolls the spawn PRNG
 * against a slot-count threshold, walks the placement bands down from the free-running counter to
 * land the object on-screen or park it, seeds its timers, and falls into the shared arm tail (raise
 * the one-shot + queue the spawn sound). Takes the 16-byte record base as its IX param. LIVE-OUT: memory-only.
 */
import { LIVES_COUNT, FREE_RUNNING_POS_COUNTER, SPRITE_SPAWN_X_STRIDE, SPRITE_SPAWN_BAND_SCAN_COUNT } from "./names.js";
import { nextSpawnRandomByte } from "./nextSpawnRandomByte.js";
import { raiseSpriteArmOneShotAndQueueSound } from "./raiseSpriteArmOneShotAndQueueSound.js";

const MIN_SLOTS = 3;       // slot-count gate below which the arm is dormant
const BAND_PITCH = 0x40;   // per-band X pitch walked to place the object

export function spawnSpriteObjectArmA(m, ix = m.regs.ix) {
  const { mem8 } = m;

  const count = mem8[LIVES_COUNT];
  if (count < MIN_SLOTS) return;
  const timer = (mem8[(ix + 0x0a)] - 1) & 0xff;
  mem8[(ix + 0x0a)] = timer;
  if (timer !== 0) return;                        // spawn timer still counting
  if (mem8[(ix + 0x06)] !== 0) return;   // object already active

  const roll = nextSpawnRandomByte(m);
  if (((count * 8 + 0x80) & 0xff) < roll) return; // probability gate

  const bandRoll = nextSpawnRandomByte(m);
  if ((bandRoll & 0x03) === 0) return parkOrReveal();

  const seed = mem8[SPRITE_SPAWN_X_STRIDE];
  const stride = ((((seed >> 2) | ((seed & 0x03) << 6)) & 0xff) + 0x24) & 0xff;
  let bands = mem8[SPRITE_SPAWN_BAND_SCAN_COUNT];
  if (mem8[FREE_RUNNING_POS_COUNTER] < 0x10) return parkOrReveal();
  let a = (mem8[FREE_RUNNING_POS_COUNTER] - 0x10) & 0xff;
  for (;;) {
    if (a < BAND_PITCH) return placeOnScreen(a);
    a = (a - BAND_PITCH) & 0xff;
    if (a < stride) return parkOrReveal();
    a = (a - stride) & 0xff;
    bands = (bands - 1) & 0xff;
    if (bands === 0) return parkOrReveal();
  }

  function placeOnScreen(band) {
    const pos = mem8[FREE_RUNNING_POS_COUNTER];
    mem8[(ix + 0x02)] = pos;
    const rel = (pos - band) & 0xff;
    mem8[(ix + 0x01)] = rel;
    mem8[(ix + 0x00)] = rel + BAND_PITCH;
    mem8[(ix + 0x04)] = 0x4e;
    return revealSlot();
  }

  function parkOrReveal() {
    mem8[(ix + 0x04)] = 0x7e;
    const parkRoll = nextSpawnRandomByte(m);
    if ((parkRoll & 0x01) !== 0) return revealSlot();
    mem8[(ix + 0x05)] = 0x00;
    mem8[(ix + 0x03)] = 0xf0; // parked off-screen
    return armTimers();
  }

  function revealSlot() {
    mem8[(ix + 0x05)] = 0x80;
    mem8[(ix + 0x03)] = 0x00;
    return armTimers();
  }

  function armTimers() {
    mem8[(ix + 0x06)] = 0x01;
    mem8[(ix + 0x08)] = 0x0b;
    mem8[(ix + 0x09)] = 0x08;
    raiseSpriteArmOneShotAndQueueSound(m);
  }
}
