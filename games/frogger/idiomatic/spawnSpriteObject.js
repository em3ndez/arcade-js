// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnSpriteObject — spawn an inactive IX sprite-object: gate on the level count and four spawn-PRNG draws,
 * derive its tile/attribute and a table-indexed position, then arm it (active flag + move timer).
 * LIVE-OUT: memory-only (the IX record fields + the PRNG ring the draws advance).
 */
import { loc_83b7, SPAWN_VARIANT_TABLE, loc_2cdc, loc_8000 } from "./names.js";
import { nextSpawnRandomByte } from "./nextSpawnRandomByte.js";

const MIN_COUNT = 3;
const VARIANTS = 5;

export function spawnSpriteObject(m) {
  const { regs, mem8, mem16 } = m;
  const record = regs.ix;

  const count = mem8[loc_83b7];
  if (count < MIN_COUNT) return;
  if (mem8[(record + 6) & 0xffff] !== 0) return; // already active

  nextSpawnRandomByte(m);
  const densityRoll = regs.a;
  if (((8 * count + 128) & 0xff) < densityRoll) return; // density gate

  nextSpawnRandomByte(m);
  const variant = regs.a & 0x07;
  if (variant >= VARIANTS) return;

  mem8[(record + 4) & 0xffff] = variant * 16 + 48;

  nextSpawnRandomByte(m);
  const spanA = mem8[(SPAWN_VARIANT_TABLE + 2 * variant) & 0xffff];
  const workLow = mem8[(SPAWN_VARIANT_TABLE + 2 * variant + 1) & 0xffff];
  mem8[(record + 11) & 0xffff] = workLow;
  const seedPos = mem8[(loc_8000 + workLow) & 0xffff];

  const ptr = mem16[(loc_2cdc + 2 * variant) & 0xffff];
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

  mem8[(record + 2) & 0xffff] = seedPos;
  mem8[(record + 1) & 0xffff] = (seedPos - remainder) & 0xff;
  mem8[record & 0xffff] = (seedPos - remainder + spanB) & 0xff;

  nextSpawnRandomByte(m);
  if (regs.a & 1) {
    mem8[(record + 5) & 0xffff] = 0;
    mem8[(record + 3) & 0xffff] = 0;
  } else {
    mem8[(record + 5) & 0xffff] = 0x80;
    mem8[(record + 3) & 0xffff] = 0xf0;
  }

  mem8[(record + 6) & 0xffff] = 1;
  mem8[(record + 9) & 0xffff] = 8;
}
