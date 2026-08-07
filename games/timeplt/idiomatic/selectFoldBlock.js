// SPDX-License-Identifier: GPL-3.0-only
/** selectFoldBlock — name a block of the program image: where it starts, and how many bytes of it to
 * take. Both are constants chosen here, so the whole content of this entry is WHICH block, and
 * whatever a caller held in the two registers that carry them is discarded. LIVE-OUT: the pair. */

const BLOCK_START = 0x335e;
const BLOCK_BYTES = 30;

export function selectFoldBlock(m) {
  const { regs } = m;
  regs.hl = BLOCK_START;
  regs.b = BLOCK_BYTES;
}
