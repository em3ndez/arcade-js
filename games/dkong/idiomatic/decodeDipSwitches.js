// SPDX-License-Identifier: GPL-3.0-only
/**
 * decodeDipSwitches — read the dip-switch bank once at power-on and fan it out into the seven
 * operator settings bytes (lives, bonus-life, four coinage counters, cabinet type), then copy the
 * fixed option/attract table into work RAM.
 *
 * LIVE-OUT: memory-only — the seven settings bytes and the copied option table.
 */

import {
  DIP_BONUS_LIFE,
  DIP_COINS_FOR_1P,
  DIP_COINS_FOR_2P,
  DIP_COINS_PER_CREDIT,
  DIP_CREDITS_PER_COIN,
  DIP_LIVES,
  DIP_UPRIGHT,
  OPTION_TABLE_BASE,
  OPTION_TABLE_ROM,
} from "./names.js";

const DSW0 = 0x7d80; // board port, not work RAM

const BONUS_LIFE_BCD = [0x07, 0x10, 0x15, 0x20];

const OPTION_TABLE_LEN = 0xaa;

export function decodeDipSwitches(m) {
  const { mem, mem8 } = m;
  const dsw0 = mem.read8(DSW0);

  mem8[DIP_LIVES] = (dsw0 & 0x03) + 0x03;

  mem8[DIP_BONUS_LIFE] = BONUS_LIFE_BCD[(dsw0 >> 2) & 0x03];

  let coinsFor1p = 0x01;
  let coinsFor2p = 0x02;
  let coinsPerCredit = 0x01;
  let creditsPerCoin = 0x01;
  if (dsw0 & 0x70) {
    const rot = (dsw0 >> 5) & 0x03;
    if (dsw0 & 0x10) {
      const a = (rot + 0x02) & 0xff;
      coinsFor1p = a;
      coinsPerCredit = a;
      coinsFor2p = (a + a) & 0xff;
    } else {
      creditsPerCoin = (rot + 0x01) & 0xff;
      coinsFor2p = coinsFor1p;
    }
  }
  mem8[DIP_COINS_FOR_1P] = coinsFor1p;
  mem8[DIP_COINS_FOR_2P] = coinsFor2p;
  mem8[DIP_COINS_PER_CREDIT] = coinsPerCredit;
  mem8[DIP_CREDITS_PER_COIN] = creditsPerCoin;

  mem8[DIP_UPRIGHT] = dsw0 & 0x80 ? 0x01 : 0x00;

  for (let i = 0; i < OPTION_TABLE_LEN; i++) {
    mem8[OPTION_TABLE_BASE + i] = mem8[OPTION_TABLE_ROM + i];
  }
}
