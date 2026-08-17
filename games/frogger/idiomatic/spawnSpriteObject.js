// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnSpriteObject — spawn an inactive IX sprite-object: gate on the level count and four spawn-PRNG draws,
 * derive its tile/attribute and a table-indexed position, then arm it (active flag + move timer).
 * LIVE-OUT: memory-only (the IX record fields + the PRNG ring the draws advance).
 */
import { LIVES_COUNT, SPAWN_VARIANT_TABLE, SPAWN_POINTER_TABLE, loc_8000 } from "./names.js";
import { nextSpawnRandomByte } from "./nextSpawnRandomByte.js";

const MIN_COUNT = 3;
const VARIANTS = 5;

export function spawnSpriteObject(m, record = m.regs.ix) {
  const { mem8, mem16 } = m;

  const count = mem8[LIVES_COUNT];
  if (count < MIN_COUNT) return;
  if (mem8[(record + 6)] !== 0) return; // already active

  const densityRoll = nextSpawnRandomByte(m);
  if (((8 * count + 128) & 0xff) < densityRoll) return; // density gate

  const variant = nextSpawnRandomByte(m) & 0x07;
  if (variant >= VARIANTS) return;

  mem8[(record + 4)] = variant * 16 + 48;

  nextSpawnRandomByte(m);
  const spanA = mem8[(SPAWN_VARIANT_TABLE + 2 * variant)];
  const workLow = mem8[(SPAWN_VARIANT_TABLE + 2 * variant + 1)];
  mem8[(record + 11)] = workLow;
  const seedPos = mem8[(loc_8000 + workLow)];

  const ptr = mem16[(SPAWN_POINTER_TABLE + 2 * variant)];
  const cell = mem8[ptr];
  const spanB = ((((cell >> 2) | (cell << 6)) & 0xff) - 16) & 0xff;
  const spanCount = mem8[(ptr & 0xff00) | ((ptr + 2) & 0xff)] || 256; // 0 runs the loop 256 times

  // Subtract spanA (and probe spanB) from the seed until spanA underflows (abort), spanB underflows,
  // or the walk exhausts, leaving the value the position bytes are built from.
  let pos = seedPos;
  let armAcc = null;
  for (let i = 0; i < spanCount; i++) {
    if (pos < spanA) return;
    pos = pos - spanA;
    if (pos < spanB) { armAcc = (pos - spanB) & 0xff; break; }
    pos = pos - spanB;
    if (i === spanCount - 1) { armAcc = pos; break; }
  }
  const remainder = (armAcc + spanB) & 0xff;

  mem8[(record + 2)] = seedPos;
  mem8[(record + 1)] = (seedPos - remainder) & 0xff;
  mem8[record] = (seedPos - remainder + spanB) & 0xff;

  if (nextSpawnRandomByte(m) & 1) {
    mem8[(record + 5)] = 0;
    mem8[(record + 3)] = 0;
  } else {
    mem8[(record + 5)] = 0x80;
    mem8[(record + 3)] = 0xf0;
  }

  mem8[(record + 6)] = 1;
  mem8[(record + 9)] = 8;
}
