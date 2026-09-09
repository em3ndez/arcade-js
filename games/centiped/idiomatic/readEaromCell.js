// SPDX-License-Identifier: GPL-3.0-only
import { EAROM_DATA_WINDOW, EAROM_CONTROL, EAROM_DATA_OUT } from "./names.js";

/**
 * readEaromCell — read one byte of the ER2055 high-score NVRAM at index X, returning it in A.
 *
 * Centipede keeps its high-score table alive with the power off in an ER2055 EAROM
 * (electrically-alterable ROM). The chip is slow serial NVRAM, exposed to the 6502
 * through three fixed memory windows on the address bus:
 *   - EAROM_DATA_WINDOW ($1600 [seen]) — writing $1600+X latches the cell address X (and the data byte);
 *   - EAROM_CONTROL     ($1680 [seen]) — the control register that carries C1 (read/write mode) and the CLK line;
 *   - EAROM_DATA_OUT    ($1700 [seen]) — the window the addressed cell's byte reads back through.
 *
 * This routine is the primitive single-cell READ that the whole high-score subsystem
 * (loadHighScoreTableFromEarom, tickEaromWriteback) is built on. It latches the address,
 * bit-bangs one read clock pulse so the chip's falling clock edge latches cells[X] into
 * its data-out register, reads that byte back, then drops the control lines.
 *
 * ROM 0x… (single serial-read primitive). Grounding: the three hardware windows are [seen]
 * (MAME-confirmed EAROM ports); the exact pulse sequence is read from the routine's own behaviour.
 * Live-out: register A holds the fetched cell byte (this is what every caller consumes); the
 * chip is left with its control lines released and address X still latched.
 */
export function readEaromCell(m, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;
  // Latch the target address into the chip. Writing anywhere in the $1600+X window
  // presents X on the chip's address lines; the data byte written here (A) is a
  // don't-care for a read — the read below overwrites whatever landed here.
  mem8[EAROM_DATA_WINDOW + x] = a;       // latch address = X (data = A, overwritten by the read)
  // Bit-bang one read clock. C1=read (bit 3 = 0x08) with the clock line first LOW,
  // then HIGH, then LOW again. The ER2055 samples the addressed cell on the CLK
  // falling edge, so the low→high→low pulse is what actually performs the read.
  mem8[EAROM_CONTROL] = 0x08;        // C1 read mode, CLK low
  mem8[EAROM_CONTROL] = 0x09;        // CLK high
  mem8[EAROM_CONTROL] = 0x08;        // CLK falling edge -> latch cells[X] into data-out
  // The addressed cell now sits in the chip's data-out register; read it back
  // through the $1700+X window.
  const out = mem8[EAROM_DATA_OUT + x]; // read the latched byte
  // Release chip-select and clock so the chip idles until the next access.
  mem8[EAROM_CONTROL] = 0x00;        // release chip-select / clock
  // Publish the fetched byte in A — the register every caller reads out.
  return (m.regs.a = out);      // live-out: caller uses A (the fetched cell)
}
