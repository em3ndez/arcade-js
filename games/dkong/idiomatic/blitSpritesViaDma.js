// SPDX-License-Identifier: GPL-3.0-only
/**
 * blitSpritesViaDma — program the i8257 and blit the sprite shadow buffer to sprite RAM.  ROM 0x0141.
 *
 * Sprites do not reach the screen through direct CPU writes: the CPU builds a sprite
 * shadow buffer in work RAM at SPRITE_BUFFER (0x6900), and once per vblank the i8257
 * DMA controller copies it into sprite RAM (0x7000), which the video hardware scans.
 * The vblank NMI (entry_0066, ROM 0x007d) calls this routine every frame with HL
 * pointing at the 9-byte i8257 setup block at ROM 0x0138-0x0140, and it does the copy:
 *
 *   1. DRQ low (0x7D85 <- 0) before touching the controller.
 *   2. Copy the 9 setup bytes from (HL) into the i8257, in ROM order: the mode
 *      register first (which also resets the controller's internal byte flip-flop),
 *      then ch0 source addr lo/hi, ch0 count lo/hi, ch1 dest addr lo/hi, ch1 count
 *      lo/hi. Each 16-bit register is TWO stores to the SAME address — the flip-flop
 *      routes the first to the low byte, the second to the high. The fixed block
 *      decodes to: mode 0x53, ch0 src 0x6900, ch1 dst 0x7000, count 0x4180/0x8180
 *      (n-1 form) = 385 transfers = 96 sprites x 4 bytes + 1.
 *   3. DRQ rising edge (0x7D85 <- 1) — THE BLIT: the i8257 copies the 385 bytes
 *      0x6900 -> 0x7000 synchronously. Then DRQ back low (0x7D85 <- 0).
 *
 * The rising edge is what moves the data, so a version that programs the controller
 * but never pulses DRQ high would leave sprite RAM stale — the WHEN matters as much
 * as the WHAT. A LEAF: calls nothing; one straight-line path, no data-dependent branch.
 *
 * Of everything it writes, only sprite RAM (0x7000-0x7180) lands in the diffed state
 * dump; the i8257 programming registers (0x7800-0x7808) and the DRQ latch (0x7D85)
 * are write-only board control outputs (io side, not work RAM), so they never appear
 * in the dump but are issued faithfully so the shipped game blits every frame.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0141.test.js.
 * GATE:     crafted-entry — dispatched every vblank (one straight-line path, no
 *           data-dependent branch, so no unreached arms); validated on real captured
 *           NMI dispatches (FRESH clone per case — it writes RAM) whose sprite-buffer
 *           contents vary frame to frame, PLUS a crafted pre-dirtied / ramp-buffer
 *           entry that proves the blit overwrites prior sprite RAM. Teeth included.
 * LIVE-OUT: memory-only — sprite RAM 0x7000-0x7180 (the blit). The oracle's residual
 *           A=0 / F / HL=0x0140 are all dead: the caller entry_0066 reloads A at ROM
 *           0x0080 (`ld a,(0x6007)` / `and a`) and rebuilds HL before any use. pc and
 *           SP are NOT live either — the oracle's `ret` (pc<-0x0080, SP+2, its popped
 *           bytes in the dead STACK_SCRATCH region) is the modelled Z80 return that the
 *           direct-call layer replaces with a plain JS return, so this routine leaves
 *           both untouched and the test excludes them.
 * NAMES:    none imported from names.js — the routine names no work-RAM address (it reads
 *           ROM constants and writes hardware registers). The i8257 registers and the
 *           DRQ latch are board control outputs, not work RAM (names.js is work-RAM
 *           only), so they stay local hex constants, as in the translated DMA layer.
 *           SPRITE_BUFFER (0x6900, the DMA source) is referenced in prose only — it is
 *           encoded in the ROM setup block, never a literal here.
 */

// ---- i8257 DMA-controller programming registers (board outputs, NOT work RAM) ----
// Each 16-bit register is written as TWO stores to the SAME address; the controller's
// internal high/low byte flip-flop selects lo then hi. Writing the mode register
// resets that flip-flop, which is why it is programmed first.
const DMA_MODE = 0x7808; //      mode/status register (0x53); also resets the flip-flop
const DMA_CH0_ADDR = 0x7800; //  channel 0 = SOURCE address      -> 0x6900 (SPRITE_BUFFER)
const DMA_CH0_COUNT = 0x7801; // channel 0 transfer count         -> 0x4180 (holds n-1)
const DMA_CH1_ADDR = 0x7802; //  channel 1 = DESTINATION address  -> 0x7000 (sprite RAM)
const DMA_CH1_COUNT = 0x7803; // channel 1 transfer count         -> 0x8180 (holds n-1)

// DRQ request latch (0x7D85, ls259.6h) — pulsed 0 -> 1 -> 0; the RISING edge blits.
const DMA_DRQ = 0x7d85;

// The 9 destination ports, in the exact ROM order the 9-byte block is consumed. Mode
// first (resets the flip-flop), then each channel register written lo-byte then hi-byte.
const DMA_PROGRAM_PORTS = [
  DMA_MODE, //                     mode 0x53 (one write; resets the byte flip-flop)
  DMA_CH0_ADDR, DMA_CH0_ADDR, //   ch0 source addr lo, hi  -> 0x6900
  DMA_CH0_COUNT, DMA_CH0_COUNT, // ch0 count lo, hi        -> 0x4180
  DMA_CH1_ADDR, DMA_CH1_ADDR, //   ch1 dest addr lo, hi    -> 0x7000
  DMA_CH1_COUNT, DMA_CH1_COUNT, // ch1 count lo, hi        -> 0x8180
];

export function blitSpritesViaDma(m) {
  const { regs, mem } = m;

  // DRQ low before (re)programming the controller.
  mem.write8(DMA_DRQ, 0);

  // Copy the 9-byte i8257 setup block at (HL) into the controller, in ROM order.
  // HL comes in as 0x0138 (the block is ROM constants); we walk a local pointer and
  // leave HL alone — the oracle's HL=0x0140 tail is dead (the caller rebuilds HL).
  let block = regs.hl;
  for (const port of DMA_PROGRAM_PORTS) {
    mem.write8(port, mem.read8(block));
    block = (block + 1) & 0xffff;
  }

  // DRQ rising edge = THE BLIT: the i8257 copies count+1 = 385 bytes ch0 -> ch1
  // (0x6900 -> 0x7000 sprite RAM) synchronously as a side effect of this store.
  mem.write8(DMA_DRQ, 1);
  // DRQ back low. (The oracle also charges the CPU cycles the DMA stole the bus for;
  // the idiomatic layer drops the cycle model, so no charge here — it is outside the
  // memory-equivalence contract. See the reviewer note in the test header.)
  mem.write8(DMA_DRQ, 0);
}
