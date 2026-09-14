// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  NVRAM_SCAN_PTR_LO, NVRAM_SCAN_PTR_HI,
  EAROM_BLANK_FLAG, EAROM_REGION_PENDING, EAROM_REGION_DIR, PENDING_WORK_FLAGS, EAROM_MODE, EAROM_PASS_COUNTER, EAROM_CURSOR, EAROM_LIMIT, EAROM_REGION_MASK, EAROM_CHECKSUM_ACC,
  EAROM_DATA, MATHBOX_STATUS, EAROM_READ,
  EAROM_REGION_START, EAROM_REGION_LIMIT, EAROM_REGION_PTR_LO, EAROM_REGION_PTR_HI,
} from "./names.js";

/**
 * stepEaromTransfer — drain one entry of the queued EAROM save/read transfer. ROM 0xde1b.
 *
 * Role in the machine: the EAROM (Electrically Alterable ROM) is Tempest's non-volatile store — high
 * scores, bookkeeping and settings survive power-off there. It is slow, byte-serial hardware, so writes
 * and reads are queued and drained a little at a time by this state machine, one region at a time, so a
 * transfer never stalls the frame. A "region" is one contiguous block of NVRAM described by packed ROM
 * tables; the queue of regions still to service is the bitfield EAROM_REGION_PENDING.
 *
 * Behavior: the outer loop re-enters until a pass leaves the cursor/Y signalling "stop". When the mode
 * cell EAROM_MODE is idle (0) and a region is still pending, start a fresh region: clear the pass /
 * checksum counters, rotate EAROM_REGION_PENDING to isolate its lowest set bit into the walking mask
 * EAROM_REGION_MASK, pick write (0x80) vs read (0x20) mode from EAROM_REGION_DIR, clear that bit out of
 * the pending set, and seed the cursor EAROM_CURSOR, limit EAROM_LIMIT and row pointer
 * NVRAM_SCAN_PTR_LO/HI from the packed ROM rows (EAROM_REGION_START/LIMIT/PTR_LO/PTR_HI) at the region
 * index. The common block then resets the MATHBOX_STATUS control port and bails when the mode is clear.
 * Each active pass shifts the mode byte to select a sub-operation:
 *   - carry set -> stage a data byte into the EAROM_DATA window and arm mode 0x40;
 *   - high bit set -> read/blank a RAM byte through the row pointer, and at the limit finalize the
 *     checksum EAROM_CHECKSUM_ACC into the last cell (mode -> 0);
 *   - otherwise -> run the EAROM read handshake (MATHBOX_STATUS 0x08/0x09/0x08 clocking, read EAROM_READ),
 *     and at the limit XOR-compare against the checksum, recording a failure by zeroing the row and
 *     OR-ing the region bit into PENDING_WORK_FLAGS.
 * The reached block folds the byte into the running checksum, bumps EAROM_PASS_COUNTER and EAROM_CURSOR,
 * writes the exit code to MATHBOX_STATUS, and either returns (nonzero -> re-enter later) or loops.
 *
 * Live-out: EAROM_MODE / EAROM_CURSOR / EAROM_LIMIT / EAROM_PASS_COUNTER / EAROM_CHECKSUM_ACC /
 * EAROM_REGION_MASK / EAROM_REGION_PENDING, the row pointer NVRAM_SCAN_PTR_LO/HI, the EAROM_DATA window,
 * PENDING_WORK_FLAGS on a checksum failure, and the exit [x, y] the caller reads. X/Y carry across the
 * outer passes rather than resetting each one. Grounding: [seen].
 */
export function stepEaromTransfer(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  // The row pointer NVRAM_SCAN_PTR_HI:LO addresses the RAM copy of the region; ind(y) reads/writes it at offset y.
  const ind = (yy) => u16(((mem8[NVRAM_SCAN_PTR_HI] << 8) | mem8[NVRAM_SCAN_PTR_LO]) + yy);

  outer: for (;;) {
    let a = 0, c = false;

    // Start-of-region setup: only entered when idle (mode 0) with at least one region still queued.
    if (mem8[EAROM_MODE] === 0 && mem8[EAROM_REGION_PENDING] !== 0) {
      // Fresh row: clear the counters and rebuild the walking mask in $1ce.
      mem8[EAROM_PASS_COUNTER] = 0;
      mem8[EAROM_CHECKSUM_ACC] = 0;
      mem8[EAROM_REGION_MASK] = 0;
      x = 0x08;                                    // 8 bits to rotate; x also becomes the region index
      a = mem8[EAROM_REGION_PENDING];
      c = true; // seed the rotate
      // Rotate until a set bit falls out: isolates the lowest pending region bit into the mask.
      for (;;) {
        mem8[EAROM_REGION_MASK] = ((c ? 0x80 : 0) | (mem8[EAROM_REGION_MASK] >> 1));
        c = (a & 0x80) !== 0;
        a = (a << 1) & 0xff;
        x = u8(x - 1);                             // count down toward the region index
        if (!c) continue;
        break;
      }
      // Direction bit from EAROM_REGION_DIR picks write mode (0x80) or read mode (0x20).
      y = (mem8[EAROM_REGION_MASK] & mem8[EAROM_REGION_DIR]) !== 0 ? 0x80 : 0x20;
      mem8[EAROM_MODE] = y;
      // Drop this region's bit out of the pending set so it is not re-serviced.
      mem8[EAROM_REGION_PENDING] = mem8[EAROM_REGION_MASK] ^ mem8[EAROM_REGION_PENDING];
      x = (x << 1) & 0xff;                          // word-stride the region index into the packed tables
      // Seed cursor, limit and row pointer from the packed ROM rows at the region index.
      mem8[EAROM_CURSOR] = mem8[u16(EAROM_REGION_START + x)];
      mem8[EAROM_LIMIT] = mem8[u16(EAROM_REGION_LIMIT + x)];
      mem8[NVRAM_SCAN_PTR_LO] = mem8[u16(EAROM_REGION_PTR_LO + x)];
      mem8[NVRAM_SCAN_PTR_HI] = mem8[u16(EAROM_REGION_PTR_HI + x)];
    }

    // Common block: clear Y (LDY #0), reset the control port, bail when the mode byte is clear.
    y = 0x00;
    mem8[MATHBOX_STATUS] = y;
    a = mem8[EAROM_MODE];
    if (a === 0) return [x, y];

    y = mem8[EAROM_PASS_COUNTER];   // Y = which entry of the region we are on
    x = mem8[EAROM_CURSOR];         // X = position in the EAROM_DATA window
    c = (a & 0x80) !== 0;           // shift the mode byte; the shifted-out bits pick the sub-operation
    a = (a << 1) & 0xff;

    deff: {
      def2: {
        def0: {
          deee: {
            dee6: {
              if (c) {
                // Stage a data byte into the EAROM window and arm the write sub-mode (0x40).
                mem8[u16(EAROM_DATA + x)] = a;
                mem8[EAROM_MODE] = 0x40;
                y = 0x0e;
                break deff;
              }
              if ((a & 0x80) !== 0) {
                // Write/blank path: read a RAM byte through the row pointer (blanked first if flagged).
                mem8[EAROM_MODE] = 0x80;
                if (mem8[EAROM_BLANK_FLAG] !== 0) mem8[ind(y)] = 0;
                a = mem8[ind(y)];
                if (x >= mem8[EAROM_LIMIT]) {
                  mem8[EAROM_MODE] = 0;
                  a = mem8[EAROM_CHECKSUM_ACC];
                }
                mem8[u16(EAROM_DATA + x)] = a;
                y = 0x0c;
                break def2;
              }
              // EAROM read handshake for this entry.
              mem8[MATHBOX_STATUS] = 0x08;
              mem8[u16(EAROM_DATA + x)] = 0x08;
              mem8[MATHBOX_STATUS] = 0x09;
              mem8[MATHBOX_STATUS] = 0x08;
              c = x >= mem8[EAROM_LIMIT];
              a = mem8[EAROM_READ];
              if (!c) break deee;
              // At the limit, XOR the read-back against the running checksum: zero means the region verified.
              a = a ^ mem8[EAROM_CHECKSUM_ACC];
              if (a === 0) break dee6;
              // Checksum mismatch -> the region is bad: blank every RAM byte of it, back to front.
              y = mem8[EAROM_PASS_COUNTER];
              for (;;) {
                mem8[ind(y)] = 0;
                y = u8(y - 1);
                if ((y & 0x80) === 0) continue;
                break;
              }
              // Record the failure by re-queuing this region's bit into the pending-work flags.
              mem8[PENDING_WORK_FLAGS] = mem8[EAROM_REGION_MASK] | mem8[PENDING_WORK_FLAGS];
              break dee6;
            }
            // dee6: retire the mode byte.
            a = 0;
            mem8[EAROM_MODE] = 0;
            break def0;
          }
          // deee: store the read-back byte through the row pointer.
          mem8[ind(y)] = a;
        }
        // def0
        y = 0;
      }
      // def2: fold the entry into the running total and bump both cursors.
      a = u8(a + mem8[EAROM_CHECKSUM_ACC]);
      mem8[EAROM_CHECKSUM_ACC] = a;
      mem8[EAROM_PASS_COUNTER] = u8(mem8[EAROM_PASS_COUNTER] + 1);
      mem8[EAROM_CURSOR] = u8(mem8[EAROM_CURSOR] + 1);
    }
    // deff
    mem8[MATHBOX_STATUS] = y;
    if (y !== 0) return [x, y];
    continue outer;
  }
}
