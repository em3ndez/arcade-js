// SPDX-License-Identifier: GPL-3.0-only
/**
 * blitSpritesViaDma — program the i8257 and blit the sprite shadow buffer to sprite RAM.
 *
 * Called every vblank with HL aimed at a fixed 9-byte controller setup block. It drops DRQ, copies
 * the 9 bytes into the i8257 in the order it expects (mode first — which also resets the byte
 * flip-flop — then each 16-bit register as two stores to the same address, lo then hi), then pulses
 * DRQ high: the rising edge is what synchronously copies the 385 bytes. The programming registers
 * and DRQ latch are board outputs, so the only readable result is the blitted sprite RAM.
 *
 * LIVE-OUT: memory-only — the blitted sprite RAM.
 */

// i8257 DMA-controller programming registers (board outputs, NOT work RAM). Each 16-bit register is
// two stores to the SAME address; the flip-flop selects lo then hi, and the mode write resets it.
const DMA_MODE = 0x7808;
const DMA_CH0_ADDR = 0x7800; //  channel 0 = source (sprite shadow buffer)
const DMA_CH0_COUNT = 0x7801;
const DMA_CH1_ADDR = 0x7802; //  channel 1 = destination (sprite RAM)
const DMA_CH1_COUNT = 0x7803;

// DRQ request latch — pulsed 0 -> 1 -> 0; the RISING edge blits.
const DMA_DRQ = 0x7d85;

// The 9 destination ports in the order the setup block is consumed.
const DMA_PROGRAM_PORTS = [
  DMA_MODE,
  DMA_CH0_ADDR, DMA_CH0_ADDR,
  DMA_CH0_COUNT, DMA_CH0_COUNT,
  DMA_CH1_ADDR, DMA_CH1_ADDR,
  DMA_CH1_COUNT, DMA_CH1_COUNT,
];

export function blitSpritesViaDma(m, block = m.regs.hl) {
  const { mem, mem8 } = m;

  mem.write8(DMA_DRQ, 0);

  for (const port of DMA_PROGRAM_PORTS) {
    mem.write8(port, mem8[block]);
    block = (block + 1) & 0xffff;
  }

  // DRQ rising edge = THE BLIT: 385 bytes copied synchronously as a side effect of this store.
  mem.write8(DMA_DRQ, 1);
  mem.write8(DMA_DRQ, 0);
}
