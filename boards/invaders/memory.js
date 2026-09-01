// SPDX-License-Identifier: GPL-3.0-only
/**
 * Space Invaders (Midway/Taito, mw8080bw.cpp) 8080 address space. Authoritative map from
 * midw8080/mw8080bw.cpp main_map (mw8080bw_root) + invaders_state::invaders():
 *   0x0000-0x1FFF  ROM (8KB: invaders.h+g+f+e at 0x0000/0x0800/0x1000/0x1800)
 *   0x2000-0x3FFF  RAM "main_ram" (8KB), .mirror(0x4000) => also at 0x6000-0x7FFF
 *                    0x2000-0x23FF work RAM · 0x2400-0x3FFF 1bpp video framebuffer (7168 bytes)
 *   0x4000-0x5FFF  ROM region, EMPTY on the 4x2KB Midway set (only the CV "larger roms" set fills it)
 *
 * Unlike the Konami boards there is NO memory-mapped I/O here: Space Invaders talks to its devices
 * (inputs, mb14241 shift register, watchdog, sound) over the 8080 IN/OUT PORT space (see io.js), a
 * separate address space the CPU reaches with IN n / OUT n -- never through this AddressSpace. So this
 * layer is pure ROM+RAM. The empty 0x4000-0x5FFF ROM span reads 0 and drops writes (.nopw()); addresses
 * with no map entry (0x8000+, and a write into 0x0000-0x1FFF ROM) THROW (dkong/pooyan discipline).
 */

export const ROM_BASE = 0x0000;
export const ROM_END = 0x1fff;

export const RAM_BASE = 0x2000;
export const RAM_SIZE = 0x2000; // 8KB: work RAM + video framebuffer
export const RAM_END = RAM_BASE + RAM_SIZE - 1; // 0x3fff
export const RAM_MIRROR = 0x4000; // main_ram .mirror(0x4000): 0x6000-0x7fff aliases 0x2000-0x3fff

// main_map @318 map(0x4000,0x5fff).rom().nopw(): empty on the 4x2KB Midway set -> reads 0, writes dropped.
// GROUNDED -- loc_15d3 sprite shift-decode spills rows past the framebuffer here; a MAME attract
// write-tap shows the drops at pc 0x15df/0x15e7, addrs 0x4017.. stepping 0x20.
export const EMPTY_ROM_BASE = 0x4000;
export const EMPTY_ROM_END = 0x5fff;

// Work RAM (named cells live here): 0x2000-0x23ff below the framebuffer; names_consistency's window.
export const WORK_RAM_BASE = 0x2000;
export const WORK_RAM_SIZE = 0x0400;

export const VIDEO_BASE = 0x2400; // within RAM: 1bpp framebuffer start
export const VIDEO_SIZE = 0x1c00; // 7168 bytes to 0x3fff

// The whole 8KB main_ram is the diffable state (work RAM + framebuffer), matching hardware.json
// "stateRegions" and the Lua dumper.
export const STATE_DUMP_SIZE = RAM_SIZE; // 8192

export class UnmappedAccess extends Error {
  constructor(kind, addr, pc) {
    const at = pc === undefined ? "" : ` (pc=0x${hex4(pc)})`;
    super(`unmapped ${kind} at 0x${hex4(addr)}${at}`);
    this.name = "UnmappedAccess";
    this.addr = addr;
    this.pc = pc;
  }
}

function hex4(v) {
  return (v & 0xffff).toString(16).padStart(4, "0");
}

/** Map any CPU address to the RAM index it aliases, or -1 if it is not RAM (honours the 0x4000 mirror). */
function ramIndex(addr) {
  // RAM appears at 0x2000-0x3fff and, via .mirror(0x4000), at 0x6000-0x7fff.
  if (addr >= RAM_BASE && addr <= RAM_END) return addr - RAM_BASE;
  const m = addr & ~RAM_MIRROR;
  if ((addr & RAM_MIRROR) && m >= RAM_BASE && m <= RAM_END) return m - RAM_BASE;
  return -1;
}

export class AddressSpace {
  constructor(rom, io) {
    if (rom.length !== ROM_END + 1) {
      throw new Error(`expected a ${ROM_END + 1}-byte ROM, got ${rom.length}`);
    }
    this.rom = rom;
    this.io = io; // unused for memory (I/O is the port space, io.js); kept for interface parity
    this.ram = new Uint8Array(RAM_SIZE);
    this.pc = undefined;
    this.writeTrace = null;
    this.clock = null;
  }

  /** No memory-mapped hardware writes on this board (devices are on the port bus). */
  static isHardwareWrite(_addr) {
    return false;
  }

  read8(addr) {
    addr &= 0xffff;
    if (addr <= ROM_END) return this.rom[addr];
    const ri = ramIndex(addr);
    if (ri >= 0) return this.ram[ri];
    if (addr >= EMPTY_ROM_BASE && addr <= EMPTY_ROM_END) return 0; // empty ROM region reads 0
    throw new UnmappedAccess("read", addr, this.pc);
  }

  write8(addr, value, _busOffset) {
    addr &= 0xffff;
    value &= 0xff;
    if (addr <= ROM_END) throw new UnmappedAccess("write to ROM", addr, this.pc);
    const ri = ramIndex(addr);
    if (ri >= 0) {
      this.ram[ri] = value;
      return;
    }
    if (addr >= EMPTY_ROM_BASE && addr <= EMPTY_ROM_END) return; // .nopw() -- writes dropped
    throw new UnmappedAccess("write", addr, this.pc);
  }

  read16(addr) {
    return this.read8(addr) | (this.read8((addr + 1) & 0xffff) << 8);
  }

  write16(addr, value) {
    this.write8(addr, value & 0xff);
    this.write8((addr + 1) & 0xffff, (value >> 8) & 0xff);
  }

  /** State-diff artifact: the 8KB main_ram (work RAM + framebuffer). */
  dumpState() {
    return this.ram.slice();
  }

  /** Inverse of dumpState()'s layout: dump byte offset -> canonical RAM address. */
  stateOffsetToAddr(off) {
    return RAM_BASE + off;
  }
}
