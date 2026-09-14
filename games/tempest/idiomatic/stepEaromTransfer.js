// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  NVRAM_SCAN_PTR_LO, NVRAM_SCAN_PTR_HI,
  EAROM_BLANK_FLAG, EAROM_REGION_PENDING, EAROM_REGION_DIR, PENDING_WORK_FLAGS, EAROM_MODE, EAROM_PASS_COUNTER, EAROM_CURSOR, EAROM_LIMIT, EAROM_REGION_MASK, EAROM_CHECKSUM_ACC,
  EAROM_DATA, MATHBOX_STATUS, EAROM_READ,
  EAROM_REGION_START, EAROM_REGION_LIMIT, EAROM_REGION_PTR_LO, EAROM_REGION_PTR_HI,
} from "./names.js";

// EAROM state-machine step. When the mode byte and its target are both live it
// rebuilds a single-bit mask, seeds the row pointer from the packed tables, then
// walks the port block emitting one entry per pass and advancing the cursor,
// re-entering from the top until the pass count comes back nonzero.
// Live-out: the exit X/Y, returned as [x, y] (a caller reads them); X/Y carry
// across the outer passes rather than resetting each one.
export function stepEaromTransfer(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  const ind = (yy) => u16(((mem8[NVRAM_SCAN_PTR_HI] << 8) | mem8[NVRAM_SCAN_PTR_LO]) + yy);

  outer: for (;;) {
    let a = 0, c = false;

    if (mem8[EAROM_MODE] === 0 && mem8[EAROM_REGION_PENDING] !== 0) {
      // Fresh row: clear the counters and rebuild the walking mask in $1ce.
      mem8[EAROM_PASS_COUNTER] = 0;
      mem8[EAROM_CHECKSUM_ACC] = 0;
      mem8[EAROM_REGION_MASK] = 0;
      x = 0x08;
      a = mem8[EAROM_REGION_PENDING];
      c = true; // seed the rotate
      for (;;) {
        mem8[EAROM_REGION_MASK] = ((c ? 0x80 : 0) | (mem8[EAROM_REGION_MASK] >> 1));
        c = (a & 0x80) !== 0;
        a = (a << 1) & 0xff;
        x = u8(x - 1);
        if (!c) continue;
        break;
      }
      y = (mem8[EAROM_REGION_MASK] & mem8[EAROM_REGION_DIR]) !== 0 ? 0x80 : 0x20;
      mem8[EAROM_MODE] = y;
      mem8[EAROM_REGION_PENDING] = mem8[EAROM_REGION_MASK] ^ mem8[EAROM_REGION_PENDING];
      x = (x << 1) & 0xff;
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

    y = mem8[EAROM_PASS_COUNTER];
    x = mem8[EAROM_CURSOR];
    c = (a & 0x80) !== 0;
    a = (a << 1) & 0xff;

    deff: {
      def2: {
        def0: {
          deee: {
            dee6: {
              if (c) {
                mem8[u16(EAROM_DATA + x)] = a;
                mem8[EAROM_MODE] = 0x40;
                y = 0x0e;
                break deff;
              }
              if ((a & 0x80) !== 0) {
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
              a = a ^ mem8[EAROM_CHECKSUM_ACC];
              if (a === 0) break dee6;
              y = mem8[EAROM_PASS_COUNTER];
              for (;;) {
                mem8[ind(y)] = 0;
                y = u8(y - 1);
                if ((y & 0x80) === 0) continue;
                break;
              }
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
