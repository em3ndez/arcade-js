// SPDX-License-Identifier: GPL-3.0-only

/**
 * markAllAliensAlive -- arm a fresh wave by marking all 55 aliens live.
 *
 * WHAT IT IS
 *   The low 0x37 (55) bytes of a player's alien page are the liveness grid -- one byte per alien, laid out
 *   as five rows of eleven, nonzero while that alien is on the board. This routine fills those 55 cells
 *   with 0x01, resurrecting the whole fleet in one tight pass.
 *
 * ROLE IN THE MACHINE
 *   The destination base arrives in HL. Two thin seaters choose the target page: markAllAliensAliveP1
 *   points the fill at ALIEN_FIELD_P1 (0x2100) and markAllAliensAliveP2 at ALIEN_FIELD_P2 (0x2200) --
 *   naming the page bases as fixed constants, so each resets a specific player's grid regardless of who is
 *   currently active. Run when a new wave is set up. countLiveAliens later scans these same 55 cells to
 *   publish ALIEN_COUNT.
 *
 * ROM 0x01c3.  Grounding: [seen].
 *
 * LIVE-OUT: memory only (the 55 filled cells); the seam completes the 8080 `ret`.
 */
export function markAllAliensAlive(m, hl = m.regs.hl) {
  // Write 0x01 into 55 consecutive liveness cells from HL upward -- every alien of the wave is now live.
  for (let i = 0; i < 0x37; i++) m.mem8[hl + i] = 0x01;
}
