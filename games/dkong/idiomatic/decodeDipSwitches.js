// SPDX-License-Identifier: GPL-3.0-only
/**
 * decodeDipSwitches — read the cabinet's dip-switch bank once at power-on and turn it into the
 * seven settings bytes the rest of the game reads, then load the fixed option table.
 *
 * One byte off the switch bank fans out into every operator-selectable setting:
 *
 *   bits 0-1  lives       -> bits + 3, so 3 to 6 lives.
 *   bits 2-3  bonus life  -> a packed-decimal threshold: 7000, 10000, 15000 or 20000 points.
 *   bits 4-6  coinage     -> four related counters: coins for a 1-player game, coins for a
 *                           2-player game, coins per credit, and credits per coin.
 *   bit 7     cabinet     -> 1 for upright, 0 for cocktail.
 *
 * It then copies a fixed 170-byte option/attract table into work RAM. That copy is constant and
 * does not depend on the switches at all.
 *
 * The routine is a LEAF: it reads the switch bank — a side-effect-free port, so reading it once is
 * enough — plus the constant table, writes only work RAM, and calls nothing. Its whole memory
 * footprint is a total function of that one byte plus the fixed copy.
 *
 * The bonus-life column is genuine packed decimal, and the four thresholds it can produce are the
 * lookup table below; index 0 doubles as the default, so no separate branch is needed.
 *
 * The coinage column is an awkward hardware encoding and is kept in operational form: when no
 * coinage bit is set, all four counters take their defaults; otherwise bits 5-6 form a 0..3
 * selector and bit 4 chooses between two different ways of spreading that selector across the four
 * counters.
 *
 * LIVE-OUT: memory-only — the seven settings bytes and the copied option table.
 */

import {
  DIP_LIVES,
  DIP_BONUS_LIFE,
  DIP_COINS_FOR_1P,
  DIP_COINS_FOR_2P,
  DIP_COINS_PER_CREDIT,
  DIP_CREDITS_PER_COIN,
  DIP_UPRIGHT,
} from "./names.js";

// The cabinet's dip-switch bank: a read-only, side-effect-free board port, not work RAM.
const DSW0 = 0x7d80;

// Bonus-life thresholds in packed decimal, indexed by switch bits 2-3:
// 7000 / 10000 / 15000 / 20000 points. Index 0 is also the default.
const BONUS_LIFE_BCD = [0x07, 0x10, 0x15, 0x20];

// The option/attract table copied verbatim into work RAM at power-on.
const OPTION_TABLE_ROM = 0x3565;
const OPTION_TABLE_DEST = 0x6100;
const OPTION_TABLE_LEN = 0xaa; // 170 bytes

/**
 * @param {object} m  the machine (uses m.mem only).
 */
export function decodeDipSwitches(m) {
  const { mem } = m;
  const dsw0 = mem.read8(DSW0);

  // -- lives: bits 0-1 + 3  ->  3..6 -----------------------------------------
  mem.write8(DIP_LIVES, (dsw0 & 0x03) + 0x03);

  // -- bonus-life threshold: bits 2-3, packed decimal ------------------------
  mem.write8(DIP_BONUS_LIFE, BONUS_LIFE_BCD[(dsw0 >> 2) & 0x03]);

  // -- coinage: bits 4-6 -> four related counters ----------------------------
  // Defaults, used when no coinage bit is set: one coin buys one credit and a 1-player game,
  // two coins buy a 2-player game.
  let coinsFor1p = 0x01;
  let coinsFor2p = 0x02;
  let coinsPerCredit = 0x01;
  let creditsPerCoin = 0x01;
  if (dsw0 & 0x70) {
    // Bits 5-6 are a 0..3 selector; bit 4 chooses how it is spread.
    const rot = (dsw0 >> 5) & 0x03;
    if (dsw0 & 0x10) {
      // More coins per credit: a 1-player game and a credit each cost selector+2 coins, and a
      // 2-player game costs twice that. Credits per coin stays at one.
      const a = (rot + 0x02) & 0xff;
      coinsFor1p = a;
      coinsPerCredit = a;
      coinsFor2p = (a + a) & 0xff;
    } else {
      // More credits per coin: one coin buys selector+1 credits, and a 2-player game costs the
      // same as a 1-player one.
      creditsPerCoin = (rot + 0x01) & 0xff;
      coinsFor2p = coinsFor1p;
    }
  }
  mem.write8(DIP_COINS_FOR_1P, coinsFor1p);
  mem.write8(DIP_COINS_FOR_2P, coinsFor2p);
  mem.write8(DIP_COINS_PER_CREDIT, coinsPerCredit);
  mem.write8(DIP_CREDITS_PER_COIN, creditsPerCoin);

  // -- cabinet: bit 7 -> upright(1) / cocktail(0) ----------------------------
  mem.write8(DIP_UPRIGHT, dsw0 & 0x80 ? 0x01 : 0x00);

  // -- copy the fixed 170-byte option table into work RAM --------------------
  for (let i = 0; i < OPTION_TABLE_LEN; i++) {
    mem.write8(OPTION_TABLE_DEST + i, mem.read8(OPTION_TABLE_ROM + i));
  }
}
