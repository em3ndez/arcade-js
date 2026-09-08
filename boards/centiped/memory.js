// SPDX-License-Identifier: GPL-3.0-only
/**
 * Atari Centipede (MOS 6502) address space. Authoritative map: MAME atari/centiped.cpp
 * centiped_base_map@695 + centiped_map@718 (adds POKEY). 14-bit bus: global_mask(0x3fff)@697, so
 * EVERYTHING mirrors every 0x4000 and the 6502 vectors 0xFFFA/C/E fold to 0x3FFA/C/E (top of ROM).
 *
 *   0x0000-0x03FF RW work RAM ("rambase")                              -- diffed
 *   0x0400-0x07BF RW video RAM (centiped_videoram_w; 32x30 tile codes) -- diffed
 *   0x07C0-0x07FF RW sprite RAM (16 objs x 4 fields)                   -- diffed
 *   0x0800 R DSW1 · 0x0801 R DSW2
 *   0x0C00 R IN0 · 0x0C01 R IN1 · 0x0C02 R IN2 · 0x0C03 R IN3          (via io.js)
 *   0x1000-0x100F RW POKEY (sound + RANDOM/ALLPOT)
 *   0x1400-0x140F W  palette RAM (centiped_paletteram_w; video reads it, NOT diffed)
 *   0x1600-0x163F W  EAROM write · 0x1680 W EAROM control · 0x1700-0x173F R EAROM read
 *   0x1800 W IRQ acknowledge (clears the 6502 IRQ line)
 *   0x1C00-0x1C07 W  LS259 outlatch (write_d7: one addr per bit, D7 is the datum)
 *   0x2000 W watchdog reset  |  0x2000-0x3FFF R program ROM   (READ and WRITE at 0x2000 differ!)
 *
 * POLICY (runbook §2): an UNIMPLEMENTED device THROWS -- never a silent 0/0xFF that hides a bug for
 * hundreds of frames. POKEY/EAROM READS throw NotImplemented (a fake value would corrupt gameplay);
 * POKEY WRITES are recorded to the io sink (the §5 audio-capture seam, like galaxian's sound writes),
 * not thrown. A write to ROM or any decode HOLE throws UnmappedAccess (a hard bug, not a port stub).
 */

import { NotImplemented } from "./io.js";

export const ADDR_MASK = 0x3fff; // global_mask(0x3fff) -- 14-bit bus, mirror every 0x4000

export const WORK_RAM_BASE = 0x0000;
export const WORK_RAM_SIZE = 0x0400; // 1KB
export const VIDEO_RAM_BASE = 0x0400;
export const VIDEO_RAM_SIZE = 0x03c0; // 0x0400-0x07BF = 960 = 32x30 tile codes
export const OBJ_RAM_BASE = 0x07c0;
export const OBJ_RAM_SIZE = 0x0040; // 0x07C0-0x07FF = 64 sprite bytes
export const PALETTE_RAM_SIZE = 0x0010; // 0x1400-0x140F

export const PROG_ROM_BASE = 0x2000;
export const PROG_ROM_SIZE = 0x2000; // 0x2000-0x3FFF (4x2KB program ROMs)

// State-diff contract: the three RAM banks concatenated in address order (== the contiguous 0x0000-0x07FF).
export const STATE_DUMP_SIZE = WORK_RAM_SIZE + VIDEO_RAM_SIZE + OBJ_RAM_SIZE; // 2048

function hex4(v) {
  return (v & 0xffff).toString(16).padStart(4, "0");
}

/** A read/write that hit no device (a decode hole, or a write to ROM) -- a real bug, so a hard Error
 *  the Machine rethrows (unlike NotImplemented, which localises a known unimplemented port). */
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
  /** rom: the program image (<= 0x2000 bytes) mapped at 0x2000-0x3FFF. io: device model (./io.js). */
  constructor(rom, io) {
    if (rom.length > PROG_ROM_SIZE) {
      throw new Error(`ROM image ${rom.length} bytes exceeds the ${PROG_ROM_SIZE}-byte program region`);
    }
    this.rom = new Uint8Array(PROG_ROM_SIZE); // zero-filled tail = MAME ROM_REGION default
    this.rom.set(rom);
    this.io = io;

    this.workRam = new Uint8Array(WORK_RAM_SIZE);
    this.videoRam = new Uint8Array(VIDEO_RAM_SIZE);
    this.objRam = new Uint8Array(OBJ_RAM_SIZE);
    this.paletteRam = new Uint8Array(PALETTE_RAM_SIZE); // written by CPU, read by video.js (dynamic palette)

    this.watchdogKicks = 0;
    this.pc = undefined; // Machine sets this so an UnmappedAccess names the faulting PC
    this.clock = null; // Machine sets () => cycles
  }

  read8(addr) {
    addr &= ADDR_MASK;
    if (addr < VIDEO_RAM_BASE) return this.workRam[addr];
    if (addr < OBJ_RAM_BASE) return this.videoRam[addr - VIDEO_RAM_BASE];
    if (addr < 0x0800) return this.objRam[addr - OBJ_RAM_BASE];
    if (addr >= PROG_ROM_BASE) return this.rom[addr - PROG_ROM_BASE]; // 0x2000-0x3FFF ROM

    switch (addr) {
      case 0x0800: return this.io.dsw1;
      case 0x0801: return this.io.dsw2;
      case 0x0c00: return this.io.readIn0();
      case 0x0c01: return this.io.readIn1();
      case 0x0c02: return this.io.readIn2();
      case 0x0c03: return this.io.readIn3();
    }
    if (addr >= 0x1000 && addr <= 0x100f) {
      throw new NotImplemented(`POKEY read 0x${hex4(addr)} (RANDOM/ALLPOT) -- §5 audio unimplemented`);
    }
    if (addr >= 0x1700 && addr <= 0x173f) {
      throw new NotImplemented(`EAROM read 0x${hex4(addr)} (high-score NVRAM unimplemented)`);
    }
    throw new UnmappedAccess("read", addr, this.pc);
  }

  write8(addr, value) {
    addr &= ADDR_MASK;
    value &= 0xff;
    if (addr < VIDEO_RAM_BASE) { this.workRam[addr] = value; return; }
    if (addr < OBJ_RAM_BASE) { this.videoRam[addr - VIDEO_RAM_BASE] = value; return; } // centiped_videoram_w
    if (addr < 0x0800) { this.objRam[addr - OBJ_RAM_BASE] = value; return; }
    if (addr >= 0x1000 && addr <= 0x100f) { this.io.pokeyWrite(addr & 0x0f, value); return; } // recorded, §5
    if (addr >= 0x1400 && addr <= 0x140f) { this.paletteRam[addr & 0x0f] = value; return; } // centiped_paletteram_w
    if (addr === 0x1800) { this.io.ackIrq(); return; } // irq_ack_w clears the IRQ line
    if (addr >= 0x1c00 && addr <= 0x1c07) { this.io.setLatch(addr & 7, (value >> 7) & 1); return; } // LS259 write_d7
    if (addr === 0x2000) { this.watchdogKicks++; return; } // watchdog reset_w -- WRITE side of 0x2000 (READ = ROM)
    if (addr >= 0x1600 && addr <= 0x163f) throw new NotImplemented(`EAROM write 0x${hex4(addr)} unimplemented`);
    if (addr === 0x1680) throw new NotImplemented("EAROM control 0x1680 unimplemented");
    if (addr > 0x2000) throw new UnmappedAccess("write to ROM", addr, this.pc); // 0x2001-0x3FFF read-only
    throw new UnmappedAccess("write", addr, this.pc); // decode holes (DSW/IN read ports, gaps)
  }

  read16(addr) {
    // 6502 little-endian: used for pointers and the reset/IRQ/NMI vectors at 0x3FFA/C/E.
    return this.read8(addr) | (this.read8((addr + 1) & 0xffff) << 8);
  }

  write16(addr, value) {
    this.write8(addr, value & 0xff);
    this.write8((addr + 1) & 0xffff, (value >> 8) & 0xff);
  }

  /** State-diff artifact: work RAM + video RAM + sprite RAM, in address order (matches hardware.json). */
  dumpState() {
    const out = new Uint8Array(STATE_DUMP_SIZE);
    out.set(this.workRam, 0);
    out.set(this.videoRam, WORK_RAM_SIZE);
    out.set(this.objRam, WORK_RAM_SIZE + VIDEO_RAM_SIZE);
    return out;
  }

  /** Inverse of dumpState()'s layout: dump byte offset -> RAM address (here offset == address). */
  stateOffsetToAddr(off) {
    if (off < WORK_RAM_SIZE) return WORK_RAM_BASE + off;
    off -= WORK_RAM_SIZE;
    if (off < VIDEO_RAM_SIZE) return VIDEO_RAM_BASE + off;
    off -= VIDEO_RAM_SIZE;
    return OBJ_RAM_BASE + off;
  }
}
