// SPDX-License-Identifier: GPL-3.0-only
/**
 * publishSpriteShadow — publish the sprite shadow into the two hardware banks. Each bank is gathered from three runs of the
 * shadow, in an order that is not the order they sit in memory, into one continuous forty-eight-byte block, and each
 * byte passes through a transform chosen by TWO things: which half of its two-byte sprite it is, and which way round
 * the cabinet has the picture. Three of the four bank-and-orientation pairs transform one half and pass the other
 * through; the fourth transforms both halves, differently. Every transform is byte-wide, so all of them wrap.
 *
 * Afterwards, and only inside one window of the sequence machine, eight of the forty-eight sprites have the top bit
 * of both their bytes raised — and only where the second half's is still clear, so a second pass changes nothing.
 * LIVE-OUT: memory.
 */

import { u8 } from "../../../core/int.js";
import { PLAYER_ENTRY, PLAYER_SPRITE_ATTRIBUTE, SCENERY_ENTRY_SLOT0, SCENERY_ENTRY_SLOT3, SCENERY_SPRITE_ATTRIBUTE_SLOT0, SCENERY_SPRITE_ATTRIBUTE_SLOT3, SCREEN_UNFLIPPED, SEQUENCE_PHASE, SEQUENCE_SUBSTEP, loc_b010, SPRITE_BANK1_BASE, loc_0832 } from "./names.js";


const BANK_0 = { at: loc_b010, runs: [[SCENERY_ENTRY_SLOT0, 6], [PLAYER_ENTRY, 32], [SCENERY_ENTRY_SLOT3, 10]] };
const BANK_1 = { at: SPRITE_BANK1_BASE, runs: [[SCENERY_SPRITE_ATTRIBUTE_SLOT0, 6], [PLAYER_SPRITE_ATTRIBUTE, 32], [SCENERY_SPRITE_ATTRIBUTE_SLOT3, 10]] };

const keep = (byte) => byte;
const complementPast = (bias) => (byte) => u8(~u8(byte + bias));
const toggleTopTwoBits = (byte) => byte ^ 0xc0;
const stepOn = (byte) => u8(byte + 1);

/** Per orientation: the transforms for the first and second half of a sprite, bank 0 then bank 1. */
const UPRIGHT = [[keep, keep], [keep, complementPast(14)]];
const TURNED_ROUND = [[complementPast(15), keep], [toggleTopTwoBits, stepOn]];

const RAISE_PHASE = 3;
const RAISE_STEP_CEILING = 8;
const TOP_BIT = 0x80;

/** The eight sprites the raise reaches: the three of the first run and the five of the third. */
const RAISED_SPRITES = [0, 2, 4, 38, 40, 42, 44, 46];

function publish(m, bank, [firstHalf, secondHalf]) {
  const { mem8 } = m;
  let slot = 0;
  for (const [from, length] of bank.runs) {
    for (let i = 0; i < length; i++, slot++) {
      mem8[bank.at + slot] = (slot % 2 === 0 ? firstHalf : secondHalf)(mem8[from + i]);
    }
  }
}

function raiseEightSprites(m) {
  const { mem8 } = m;
  if (mem8[SEQUENCE_PHASE] !== RAISE_PHASE) return;
  const step = mem8[SEQUENCE_SUBSTEP];
  if (step < mem8[loc_0832] || step >= RAISE_STEP_CEILING) return;
  for (const sprite of RAISED_SPRITES) {
    const second = mem8[BANK_1.at + sprite + 1];
    if ((second & TOP_BIT) !== 0) continue;
    mem8[BANK_1.at + sprite + 1] = u8(second + TOP_BIT);
    mem8[BANK_0.at + sprite] = u8(mem8[BANK_0.at + sprite] + TOP_BIT);
  }
}

export function publishSpriteShadow(m) {
  const [bank0, bank1] = m.mem8[SCREEN_UNFLIPPED] === 0 ? TURNED_ROUND : UPRIGHT;
  publish(m, BANK_0, bank0);
  publish(m, BANK_1, bank1);
  raiseEightSprites(m);
}
