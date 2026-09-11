// SPDX-License-Identifier: GPL-3.0-only
/**
 * Atari Tempest (MOS 6502) address space. Authoritative map: MAME atari/tempest.cpp main_map@488.
 * Full 16-bit bus, no global mask. A READ and a WRITE at one address are different devices.
 *
 *   0x0000-0x07FF RW work RAM (2K)                                     -- diffed
 *   0x0800-0x080F W  color RAM (avg:colorram, 16x4-bit, write-only)    -- diffed (render input)
 *   0x0C00 R IN0 · 0x0D00 R IN1/DSW1 (knob+cabinet) · 0x0E00 R DSW2    (via io.js)
 *   0x2000-0x2FFF RW vector RAM (4K, the AVG display list)             -- diffed
 *   0x3000-0x3FFF R  vector ROM (region "vectorrom")
 *   0x4000 W coin counters + AVG flip_x(0x08)/flip_y(0x10)
 *   0x4800 W AVG go_w  · 0x5000 W watchdog clear + IRQ ack  · 0x5800 W AVG reset_w
 *   0x6000-0x603F W EAROM write · 0x6040 R mathbox status / W EAROM control · 0x6050 R EAROM read
 *   0x6060 R mathbox lo · 0x6070 R mathbox hi · 0x6080-0x609F W mathbox go
 *   0x60C0-0x60CF RW POKEY1 · 0x60D0-0x60DF RW POKEY2 · 0x60E0 W LEDs+FLIP
 *   0x9000-0xDFFF R program ROM · 0xAE1F R rom_ae1f_r (quantum hack; returns rom[0xAE1F])
 *   0xF000-0xFFFF R program ROM (reload of 0xD000 image: reset/IRQ vectors at 0xFFFA/C/E)
 *
 * POLICY (runbook §2): an UNIMPLEMENTED device THROWS (NotImplemented) -- never a silent 0 that hides a
 * bug for hundreds of frames. A read/write to a decode HOLE throws UnmappedAccess (a real bug).
 */

import { NotImplemented } from "./io.js";

export const WORK_RAM_BASE = 0x0000;
export const WORK_RAM_SIZE = 0x0800; // 0x0000-0x07FF
export const VEC_RAM_BASE = 0x2000;
export const VEC_RAM_SIZE = 0x1000; // 0x2000-0x2FFF
export const VEC_ROM_BASE = 0x3000;
export const VEC_ROM_SIZE = 0x1000; // 0x3000-0x3FFF
export const COLORRAM_SIZE = 0x10; // 0x0800-0x080F

// Program ROM occupies a 64K image mapped 0x9000-0xDFFF plus a reload of the last 4K at 0xF000-0xFFFF.
export const PROG_ROM_BASE = 0x9000;

// State-diff contract: work RAM + vector RAM + colorram, in that order (matches dump_state.lua).
export const STATE_DUMP_SIZE = WORK_RAM_SIZE + VEC_RAM_SIZE + COLORRAM_SIZE; // 6160

function hex4(v) {
  return (v & 0xffff).toString(16).padStart(4, "0");
}

export class UnmappedAccess extends Error {
  constructor(kind, addr, pc) {
    const at = pc === undefined ? "" : ` (pc=0x${hex4(pc)})`;
    super(`unmapped ${kind} at 0x${hex4(addr)}${at}`);
    this.name = "UnmappedAccess";
    this.addr = addr;
    this.pc = pc;
  }
}

export class AddressSpace {
  /** rom: the 64K maincpu image (program at 0x9000-0xDFFF + reload 0xF000). vectorRom: 4K at 0x3000.
   *  io: device model (./io.js), which owns the AVG (and its colorram) plus all MMIO. */
  constructor(rom, vectorRom, io) {
    this.rom = new Uint8Array(0x10000);
    this.rom.set(rom.subarray(0, 0x10000));
    this.vectorRom = new Uint8Array(VEC_ROM_SIZE);
    this.vectorRom.set(vectorRom.subarray(0, VEC_ROM_SIZE));
    this.io = io;

    this.workRam = new Uint8Array(WORK_RAM_SIZE);
    this.vectorRam = new Uint8Array(VEC_RAM_SIZE);

    this.pc = undefined; // Machine sets this so an UnmappedAccess/NotImplemented names the faulting PC
    this.clock = null; // Machine sets () => total CPU cycles (for the 3kHz IN0 bit)
    io.attachMemory(this); // the AVG reads vector RAM/ROM through here
  }

  read8(addr) {
    addr &= 0xffff;
    if (addr < WORK_RAM_SIZE) return this.workRam[addr];
    if (addr >= VEC_RAM_BASE && addr < VEC_RAM_BASE + VEC_RAM_SIZE) return this.vectorRam[addr - VEC_RAM_BASE];
    if (addr >= VEC_ROM_BASE && addr < VEC_ROM_BASE + VEC_ROM_SIZE) return this.vectorRom[addr - VEC_ROM_BASE];
    if (addr >= PROG_ROM_BASE && addr <= 0xdfff) return this.rom[addr];
    if (addr >= 0xf000) return this.rom[addr];
    switch (addr) {
      case 0x0c00: return this.io.readIn0(this.clock ? this.clock() : 0);
      case 0x0d00: return this.io.readIn1();
      case 0x0e00: return this.io.readDsw2();
      case 0x6040: return this.io.mathboxStatus();
      case 0x6050: return this.io.earomRead();
      case 0x6060: return this.io.mathboxLo();
      case 0x6070: return this.io.mathboxHi();
    }
    if (addr >= 0x60c0 && addr <= 0x60cf) return this.io.pokeyRead(0, addr & 0x0f, this.clock ? this.clock() : 0);
    if (addr >= 0x60d0 && addr <= 0x60df) return this.io.pokeyRead(1, addr & 0x0f, this.clock ? this.clock() : 0);
    throw new UnmappedAccess("read", addr, this.pc);
  }

  write8(addr, value) {
    addr &= 0xffff;
    value &= 0xff;
    if (addr < WORK_RAM_SIZE) { this.workRam[addr] = value; return; }
    if (addr >= 0x0800 && addr <= 0x080f) { this.io.colorramWrite(addr & 0x0f, value); return; }
    if (addr >= VEC_RAM_BASE && addr < VEC_RAM_BASE + VEC_RAM_SIZE) { this.vectorRam[addr - VEC_RAM_BASE] = value; return; }
    switch (addr) {
      case 0x4000: this.io.coinW(value); return;
      case 0x4800: this.io.avgGo(); return;
      case 0x5000: this.io.wdclr(); return; // watchdog clear + IRQ ack
      case 0x5800: this.io.avgReset(); return;
      case 0x6040: this.io.earomControl(value); return;
      case 0x60e0: this.io.ledW(value); return;
    }
    if (addr >= 0x6000 && addr <= 0x603f) { this.io.earomWrite(addr & 0x3f, value); return; }
    if (addr >= 0x6080 && addr <= 0x609f) { this.io.mathboxGo(addr & 0x1f, value); return; }
    if (addr >= 0x60c0 && addr <= 0x60cf) { this.io.pokeyWrite(0, addr & 0x0f, value, this.clock ? this.clock() : 0); return; }
    if (addr >= 0x60d0 && addr <= 0x60df) { this.io.pokeyWrite(1, addr & 0x0f, value, this.clock ? this.clock() : 0); return; }
    if (addr >= VEC_ROM_BASE) return; // writes into ROM space are ignored by MAME (.rom())
    throw new UnmappedAccess("write", addr, this.pc);
  }

  read16(addr) {
    return this.read8(addr) | (this.read8((addr + 1) & 0xffff) << 8);
  }
  write16(addr, value) {
    this.write8(addr, value & 0xff);
    this.write8((addr + 1) & 0xffff, (value >> 8) & 0xff);
  }

  /** State-diff artifact: work RAM + vector RAM + colorram, in address order (matches dump_state.lua). */
  dumpState() {
    const out = new Uint8Array(STATE_DUMP_SIZE);
    out.set(this.workRam, 0);
    out.set(this.vectorRam, WORK_RAM_SIZE);
    out.set(this.io.colorram, WORK_RAM_SIZE + VEC_RAM_SIZE);
    return out;
  }

  stateOffsetToAddr(off) {
    if (off < WORK_RAM_SIZE) return off;
    off -= WORK_RAM_SIZE;
    if (off < VEC_RAM_SIZE) return VEC_RAM_BASE + off;
    off -= VEC_RAM_SIZE;
    return 0x0800 + off;
  }
}
