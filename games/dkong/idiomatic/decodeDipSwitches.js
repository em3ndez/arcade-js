// SPDX-License-Identifier: GPL-3.0-only
/**
 * decodeDipSwitches — unpack DSW0 into the settings block, then load the ROM
 * option table.  ROM 0x0207.
 *
 * Power-on init reads the single DSW0 byte (hardware dip-switch bank at port
 * 0x7D80) once and fans it out into the seven settings bytes at 0x6020-0x6026:
 *
 *   bits 0-1  lives          -> DIP_LIVES        = bits + 3  (3..6)
 *   bits 2-3  bonus-life      -> DIP_BONUS_LIFE   packed BCD 0x07/0x10/0x15/0x20
 *                               (= 7000/10000/15000/20000 point thresholds)
 *   bits 4-6  coinage         -> DIP_COINS_FOR_1P / _FOR_2P / _PER_CREDIT /
 *                               _CREDITS_PER_COIN, four related counters
 *   bit 7     cabinet         -> DIP_UPRIGHT      1 = upright, 0 = cocktail
 *
 * It then block-copies the 170-byte option/attract table at ROM 0x3565 into
 * work RAM 0x6100 (the closing `ldir`) — constant data, independent of DSW0.
 *
 * A LEAF: reads DSW0 (a side-effect-free port, so reading it once is identical
 * to the oracle's two reads) plus the constant ROM table, writes only work RAM,
 * calls nothing. Its whole memory footprint is a total function of the one DSW0
 * byte (0x6020-0x6026) plus a fixed copy (0x6100-0x61A9).
 *
 * The bonus-life column is genuine BCD in the oracle (`ld a,5 / {add 5; daa} xN`
 * for N = bits 2-3). That N-step BCD chain lands on exactly 0x07/0x10/0x15/0x20,
 * so it is expressed here as the lookup those four constants form — index 0 is
 * both the "N == 0" default and table[0], so no separate branch is needed. The
 * exhaustive gate proves the table equals the oracle's DAA output for all inputs.
 *
 * The coinage column is an obscure hardware encoding, kept in operational form:
 * the oracle isolates bits 4-6 (`and 0x70`) and rotates left four times, which
 * leaves A = (DSW0 >> 5) & 3 and carry = DSW0 bit 4 (derived, and exhaustively
 * checked). Three arms follow from (Z = bits 4-6 all clear, C = bit 4).
 *
 * Sole caller: handler_01c3 (game-state-0 power-on init, inside the NMI). It does
 * `ld a,0x01` immediately after the call and never reads a register/flag this
 * routine leaves, so the exit is memory-only.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0207.test.js.
 * GATE:     exhaustive — the written RAM is a total function of the DSW0 byte, so
 *           decodeDipSwitches vs the oracle over all 256 DSW0 values (fresh clone
 *           per side; RAM minus STACK_SCRATCH), plus the real power-on dispatch.
 *           Runs exactly once from boot; every branch is a DSW0 bit pattern.
 * LIVE-OUT: memory-only — the settings block 0x6020-0x6026 and the copied table
 *           0x6100-0x61A9. The oracle's residual A/B/C/D/E/HL/F and its ret
 *           SP/PC are dead ABI the direct-call model drops (the caller overwrites
 *           A before reading anything).
 * NAMES:    DIP_LIVES, DIP_BONUS_LIFE, DIP_COINS_FOR_1P, DIP_COINS_FOR_2P,
 *           DIP_COINS_PER_CREDIT, DIP_CREDITS_PER_COIN, DIP_UPRIGHT — from ram.js.
 *           0x7D80 (DSW0 port), 0x3565 (ROM data table), 0x6100 (dest, examined +
 *           left hex in ram.js) stay hex.
 */

import {
  DIP_LIVES,
  DIP_BONUS_LIFE,
  DIP_COINS_FOR_1P,
  DIP_COINS_FOR_2P,
  DIP_COINS_PER_CREDIT,
  DIP_CREDITS_PER_COIN,
  DIP_UPRIGHT,
} from "../optimized/ram.js";

// DSW0 hardware dip-switch bank (a read-only, side-effect-free board port — NOT
// work RAM), read once here where the oracle reads it twice with the same result.
const DSW0 = 0x7d80;

// Bonus-life thresholds in packed BCD, indexed by DSW0 bits 2-3. This is exactly
// the oracle's `ld a,5 / {add 5; daa}` chain applied N times (index 0 = the
// no-loop default). 0x07/0x10/0x15/0x20 = 7000/10000/15000/20000 points.
const BONUS_LIFE_BCD = [0x07, 0x10, 0x15, 0x20];

// ROM option/attract table copied verbatim into work RAM at power-on.
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

  // -- bonus-life threshold: bits 2-3, packed BCD ----------------------------
  mem.write8(DIP_BONUS_LIFE, BONUS_LIFE_BCD[(dsw0 >> 2) & 0x03]);

  // -- coinage: bits 4-6 -> four related counters ----------------------------
  // Defaults from the oracle's BC = 0x0101, DE = 0x0102 (D,E,B,C = 1,2,1,1).
  let coinsFor1p = 0x01; // D  -> 0x6022
  let coinsFor2p = 0x02; // E  -> 0x6023
  let coinsPerCredit = 0x01; // B  -> 0x6024
  let creditsPerCoin = 0x01; // C  -> 0x6025
  if (dsw0 & 0x70) {
    // `and 0x70` then `rla` x4 leaves A = (DSW0 >> 5) & 3 and carry = bit 4.
    const rot = (dsw0 >> 5) & 0x03;
    if (dsw0 & 0x10) {
      // bit 4 set (carry arm): D = B = A+2, E = 2*(A+2), C stays default.
      const a = (rot + 0x02) & 0xff;
      coinsFor1p = a;
      coinsPerCredit = a;
      coinsFor2p = (a + a) & 0xff;
    } else {
      // bit 4 clear, bits 5/6 set: C = A+1, E = D, B/D stay default.
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

  // -- copy the 170-byte ROM option table 0x3565 -> 0x6100 -------------------
  for (let i = 0; i < OPTION_TABLE_LEN; i++) {
    mem.write8(OPTION_TABLE_DEST + i, mem.read8(OPTION_TABLE_ROM + i));
  }
}
