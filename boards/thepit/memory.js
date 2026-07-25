// SPDX-License-Identifier: GPL-3.0-only
/**
 * The Pit Z80 address space (FIRST DRAFT for the game #2 port).
 *
 * Authoritative map from MAME's src/mame/taito/roundup.cpp (thepit_main_map).
 * Do not re-derive it from observation.
 *
 *   0x0000-0x4FFF  ROM (20KB program)
 *   0x8000-0x87FF  work RAM
 *   0x8800-0x8BFF  colour RAM (per-tile colour)     mirror 0x8C00-0x8FFF
 *   0x9000-0x93FF  video RAM (tilemap)              mirror 0x9400-0x97FF
 *   0x9800-0x983F  attribute / column-scroll RAM    mirror bits 0x0700
 *   0x9840-0x985F  sprite RAM (8 sprites x 4 bytes)
 *   0x9860-0x98FF  RAM
 *   0xA000   R: IN0 (LS157-muxed with IN2 by latch b6)   W: nop
 *   0xA800   R: IN1 (coin/start, ACTIVE HIGH)
 *   0xB000   R: DSW   W: 0xB000-0xB007 LS259 latch (one addr per bit, data on d0)
 *   0xB800   R: watchdog reset (side effect!)  W: sound latch -> audio Z80
 *
 * Same three invariants as the DK model: (1) a read and a write at one address are
 * different devices (0xB800 reads the watchdog, writes the sound latch); (2) a read
 * is not always pure (reading 0xB800 kicks the watchdog); (3) unmapped access throws
 * loudly. State lives at its real address; the arrays are the source of truth because
 * they are what gets diffed against MAME.
 */

export const ROM_BASE = 0x0000;
export const ROM_END = 0x4fff;

export const WORK_RAM_BASE = 0x8000;
export const WORK_RAM_SIZE = 0x0800; // 0x8000-0x87FF

export const COLOR_RAM_BASE = 0x8800;
export const COLOR_RAM_SIZE = 0x0400; // 0x8800-0x8BFF (mirror 0x8C00-0x8FFF)

export const VIDEO_RAM_BASE = 0x9000;
export const VIDEO_RAM_SIZE = 0x0400; // 0x9000-0x93FF (mirror 0x9400-0x97FF)

// One block: attribute/column-scroll (0x9800-0x983F) + sprite RAM (0x9840-0x985F)
// + spare RAM (0x9860-0x98FF). Backed contiguously so it dumps in one piece.
export const ATTRSPR_BASE = 0x9800;
export const ATTRSPR_SIZE = 0x0100; // 0x9800-0x98FF
export const ATTR_MASK = 0x003f;    // the attribute sub-region (mirror bits 0x0700)

// State-diff contract: work, colour, video, attr+sprite concatenated in this order.
export const STATE_DUMP_SIZE = WORK_RAM_SIZE + COLOR_RAM_SIZE + VIDEO_RAM_SIZE + ATTRSPR_SIZE; // 4352

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

export class AddressSpace {
  /**
   * @param {Uint8Array} rom  20KB maincpu image (0x0000-0x4FFF)
   * @param {object} io       I/O device model (see ./io.js)
   */
  constructor(rom, io) {
    if (rom.length !== ROM_END + 1) {
      throw new Error(`expected a ${ROM_END + 1}-byte ROM, got ${rom.length}`);
    }
    this.rom = rom;
    this.io = io;

    this.workRam = new Uint8Array(WORK_RAM_SIZE);
    this.colorRam = new Uint8Array(COLOR_RAM_SIZE);
    this.videoRam = new Uint8Array(VIDEO_RAM_SIZE);
    this.attrsprRam = new Uint8Array(ATTRSPR_SIZE);

    this.pc = undefined;
    this.writeTrace = null; // set to [] to record hardware writes in execution order
    this.clock = null;
  }

  /** The device addresses the write-diff contract covers (the LS259 latch + sound latch). */
  static isHardwareWrite(addr) {
    return (addr >= 0xb000 && addr <= 0xb007) || addr === 0xb800;
  }

  _trace(addr, value, busOffset) {
    if (this.writeTrace === null) return;
    if (busOffset === undefined) {
      throw new Error(
        `hardware write to 0x${hex4(addr)} has no write-bus-cycle offset ` +
          "(ld (nn),a = 10, ld (hl),a / ld (de),a = 4).",
      );
    }
    this.writeTrace.push({ cycle: this.clock ? this.clock() + busOffset : null, addr, value });
  }

  read8(addr) {
    addr &= 0xffff;

    if (addr <= ROM_END) return this.rom[addr];

    if (addr >= WORK_RAM_BASE && addr < WORK_RAM_BASE + WORK_RAM_SIZE) {
      return this.workRam[addr - WORK_RAM_BASE];
    }
    if (addr >= 0x8800 && addr <= 0x8fff) return this.colorRam[(addr - COLOR_RAM_BASE) & 0x3ff];
    if (addr >= 0x9000 && addr <= 0x97ff) return this.videoRam[(addr - VIDEO_RAM_BASE) & 0x3ff];
    if (addr >= ATTRSPR_BASE && addr <= 0x98ff) return this.attrsprRam[addr - ATTRSPR_BASE];
    if (addr >= 0x9900 && addr <= 0x9fff) return this.attrsprRam[addr & ATTR_MASK]; // attr mirror

    switch (addr) {
      case 0xa000: return this.io.readIn0();
      case 0xa800: return this.io.readIn1();
      case 0xb000: return this.io.readDsw();
      case 0xb800: return this.io.readWatchdog(); // kicks the watchdog -- see header
    }

    throw new UnmappedAccess("read", addr, this.pc);
  }

  write8(addr, value, busOffset) {
    addr &= 0xffff;
    value &= 0xff;
    if (this.writeTrace !== null && AddressSpace.isHardwareWrite(addr)) {
      this._trace(addr, value, busOffset);
    }

    if (addr <= ROM_END) throw new UnmappedAccess("write to ROM", addr, this.pc);

    if (addr >= WORK_RAM_BASE && addr < WORK_RAM_BASE + WORK_RAM_SIZE) {
      this.workRam[addr - WORK_RAM_BASE] = value;
      return;
    }
    if (addr >= 0x8800 && addr <= 0x8fff) { this.colorRam[(addr - COLOR_RAM_BASE) & 0x3ff] = value; return; }
    if (addr >= 0x9000 && addr <= 0x97ff) { this.videoRam[(addr - VIDEO_RAM_BASE) & 0x3ff] = value; return; }
    if (addr >= ATTRSPR_BASE && addr <= 0x98ff) { this.attrsprRam[addr - ATTRSPR_BASE] = value; return; }
    if (addr >= 0x9900 && addr <= 0x9fff) { this.attrsprRam[addr & ATTR_MASK] = value; return; }

    // LS259 addressable control latch: one address per bit, value on bit 0.
    if (addr >= 0xb000 && addr <= 0xb007) {
      this.io.writeControlLatch(addr - 0xb000, value & 1);
      return;
    }

    switch (addr) {
      case 0xa000: return; // schematics: not hooked up (nopw)
      case 0xb800: this.io.writeSoundLatch(value); return;
    }

    throw new UnmappedAccess("write", addr, this.pc);
  }

  read16(addr) {
    return this.read8(addr) | (this.read8((addr + 1) & 0xffff) << 8);
  }

  write16(addr, value) {
    this.write8(addr, value & 0xff);
    this.write8((addr + 1) & 0xffff, (value >> 8) & 0xff);
  }

  /** State-diff artifact: work, colour, video, attr+sprite concatenated, 4352 bytes. */
  dumpState() {
    const out = new Uint8Array(STATE_DUMP_SIZE);
    out.set(this.workRam, 0);
    out.set(this.colorRam, WORK_RAM_SIZE);
    out.set(this.videoRam, WORK_RAM_SIZE + COLOR_RAM_SIZE);
    out.set(this.attrsprRam, WORK_RAM_SIZE + COLOR_RAM_SIZE + VIDEO_RAM_SIZE);
    return out;
  }

  /** Inverse of dumpState()'s layout: dump byte offset -> RAM address. */
  stateOffsetToAddr(off) {
    if (off < WORK_RAM_SIZE) return WORK_RAM_BASE + off;
    off -= WORK_RAM_SIZE;
    if (off < COLOR_RAM_SIZE) return COLOR_RAM_BASE + off;
    off -= COLOR_RAM_SIZE;
    if (off < VIDEO_RAM_SIZE) return VIDEO_RAM_BASE + off;
    return ATTRSPR_BASE + (off - VIDEO_RAM_SIZE);
  }
}
