// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  loc_00, loc_40, loc_43, loc_50, loc_60, loc_70, loc_80, loc_88,
  loc_9a, loc_ab, loc_b8, loc_ef, loc_f0, POKEY_RANDOM,
} from "./names.js";
import { seedWaveState } from "./seedWaveState.js";
import { guardHeadOrientationWrap } from "./advanceHeadOrientation.js";
import { returnNoop } from "./returnNoop.js";
import { storeHeadVelocity } from "./storeHeadVelocity.js";

// Re-seed the head: fresh heading into $40, a random small velocity into $50, $70 from the RNG, and
// clear $60/$80. Magnitude is 2 when the slot is wide and the RNG allows, else 1; sign from the RNG.
function seedHead(m) {
  const { mem8 } = m;
  mem8[loc_b8] = 0x14;
  mem8[loc_40] = 0x30 ^ mem8[loc_ef];
  const wide = mem8[u8(loc_ab + mem8[loc_88])] >= 0x02 && (mem8[POKEY_RANDOM] & 0x03) !== 0;
  const magnitude = wide ? 0x02 : 0x01;
  const velocity = mem8[POKEY_RANDOM] & 0x80 ? u8(-magnitude) : magnitude;
  mem8[loc_50] = velocity;
  mem8[loc_60] = 0;
  mem8[loc_80] = 0;
  mem8[loc_70] = u8(((mem8[POKEY_RANDOM] & 0x78) + 0x70) ^ mem8[loc_f0]);
}

// Commit stage: a live control cell reseeds the whole wave; otherwise fold the seeded step ($50) onto
// the running velocity ($60), its direction chosen by $ef, and hand it to the velocity store.
function commitVelocity(m) {
  const { mem8 } = m;
  if ((mem8[loc_43] & 0xaf) !== 0) return seedWaveState(m);
  const base = mem8[loc_60];
  const step = mem8[loc_50];
  const velocity = mem8[loc_ef] === 0 ? u8(base + step) : u8(base - step);
  return storeHeadVelocity(m, velocity, velocity === 0);
}

/**
 * steerHeadAndSeedVelocity -- the centipede head's per-tick steering. Reads the head's folded
 * orientation ($40) and position ($70): at the top of the orientation range it guards the wrap,
 * within a narrow band it goes straight to the commit stage, and otherwise -- only near the top of
 * the position range, on the tick phase, for a young slot, when the RNG permits -- it re-seeds the
 * head before committing. [code]
 */
export function steerHeadAndSeedVelocity(m) {
  const { mem8 } = m;

  const orient = (mem8[loc_40] ^ mem8[loc_ef]) & 0xff;
  if (orient >= 0x34) return guardHeadOrientationWrap(m, orient);
  if (orient >= 0x30) return commitVelocity(m);

  const pos = (mem8[loc_70] ^ mem8[loc_f0]) & 0xff;
  const reseed =
    pos >= 0xf8 &&
    mem8[loc_00] === 0 &&
    mem8[u8(loc_9a + mem8[loc_88])] < 0x0b &&
    (mem8[POKEY_RANDOM] & 0x03) === 0;
  if (!reseed) return returnNoop(m);

  seedHead(m);
  return commitVelocity(m);
}
