// SPDX-License-Identifier: GPL-3.0-only
/**
 * blitSpritesViaDma — program the i8257 and blit the sprite shadow buffer to sprite RAM.
 *
 * Sprites do not reach the screen through direct CPU writes: the CPU builds a sprite
 * shadow buffer in work RAM, and once per vblank the i8257 DMA controller copies it
 * into sprite RAM, which the video hardware scans. This routine is called every vblank
 * with the index pointer aimed at a fixed 9-byte controller setup block, and it does
 * the copy:
 *
 *   1. DRQ low before touching the controller.
 *   2. Copy the 9 setup bytes into the i8257, in the order the controller expects: the
 *      mode register first (which also resets the controller's internal byte
 *      flip-flop), then ch0 source addr lo/hi, ch0 count lo/hi, ch1 dest addr lo/hi,
 *      ch1 count lo/hi. Each 16-bit register is TWO stores to the SAME address — the
 *      flip-flop routes the first to the low byte, the second to the high. The fixed
 *      block decodes to: mode 0x53, source = the sprite shadow buffer, destination =
 *      sprite RAM, count (held in n-1 form) = 385 transfers = 96 sprites x 4 bytes + 1.
 *   3. DRQ rising edge — THE BLIT: the i8257 copies those 385 bytes synchronously.
 *      Then DRQ back low.
 *
 * The rising edge is what moves the data, so a version that programs the controller
 * but never pulses DRQ high would leave sprite RAM stale — the WHEN matters as much
 * as the WHAT. A LEAF: calls nothing; one straight-line path, no data-dependent branch.
 *
 * The i8257 programming registers and the DRQ latch are write-only board control
 * outputs rather than work RAM, so the only readable result of all this is the blitted
 * sprite RAM; the control writes are issued faithfully because the hardware needs them
 * in that order for the blit to happen at all.
 *
 * LIVE-OUT: memory-only — the blitted sprite RAM.
 */

// ---- i8257 DMA-controller programming registers (board outputs, NOT work RAM) ----
// Each 16-bit register is written as TWO stores to the SAME address; the controller's
// internal high/low byte flip-flop selects lo then hi. Writing the mode register
// resets that flip-flop, which is why it is programmed first.
const DMA_MODE = 0x7808; //      mode/status register (0x53); also resets the flip-flop
const DMA_CH0_ADDR = 0x7800; //  channel 0 = SOURCE address       (the sprite shadow buffer)
const DMA_CH0_COUNT = 0x7801; // channel 0 transfer count         (holds n-1)
const DMA_CH1_ADDR = 0x7802; //  channel 1 = DESTINATION address  (sprite RAM)
const DMA_CH1_COUNT = 0x7803; // channel 1 transfer count         (holds n-1)

// DRQ request latch — pulsed 0 -> 1 -> 0; the RISING edge blits.
const DMA_DRQ = 0x7d85;

// The 9 destination ports, in the exact order the 9-byte setup block is consumed. Mode
// first (resets the flip-flop), then each channel register written lo-byte then hi-byte.
const DMA_PROGRAM_PORTS = [
  DMA_MODE, //                     mode 0x53 (one write; resets the byte flip-flop)
  DMA_CH0_ADDR, DMA_CH0_ADDR, //   ch0 source addr lo, hi
  DMA_CH0_COUNT, DMA_CH0_COUNT, // ch0 count lo, hi
  DMA_CH1_ADDR, DMA_CH1_ADDR, //   ch1 dest addr lo, hi
  DMA_CH1_COUNT, DMA_CH1_COUNT, // ch1 count lo, hi
];

export function blitSpritesViaDma(m) {
  const { regs, mem } = m;

  // DRQ low before (re)programming the controller.
  mem.write8(DMA_DRQ, 0);

  // Copy the 9-byte i8257 setup block into the controller, in the order above. The
  // block pointer arrives in the index register; a local pointer walks it so the
  // caller's register is left alone.
  let block = regs.hl;
  for (const port of DMA_PROGRAM_PORTS) {
    mem.write8(port, mem.read8(block));
    block = (block + 1) & 0xffff;
  }

  // DRQ rising edge = THE BLIT: the i8257 copies count+1 = 385 bytes from the shadow
  // buffer into sprite RAM synchronously, as a side effect of this store.
  mem.write8(DMA_DRQ, 1);
  // DRQ back low.
  mem.write8(DMA_DRQ, 0);
}
