// SPDX-License-Identifier: GPL-3.0-only
/**
 * Time Pilot Z80 address space.
 *
 * Authoritative map from MAME's src/mame/konami/timeplt.cpp (timeplt_state::main_map).
 * Do not re-derive it from observation.
 *
 *   0x0000-0x5FFF  ROM (24KB program: tm1 + tm2 + tm3)
 *   0xA000-0xA3FF  colour RAM   -- this board really does have writable colour, unlike DK
 *   0xA400-0xA7FF  video RAM (tilemap)
 *   0xA800-0xAFFF  work RAM (2KB)
 *   0xB000-0xB0FF  sprite RAM bank 0            mirror mask 0x0B00
 *   0xB400-0xB4FF  sprite RAM bank 1            mirror mask 0x0B00
 *   0xC000   R: scanline counter   W: sound data to the audio Z80   mirror mask 0x0CFF
 *   0xC200   R: DSW1               W: watchdog reset                mirror mask 0x0CFF
 *   0xC300   R: IN0                W: 0xC300-0xC30F LS259 latch     mirror mask 0x0C9F
 *   0xC320   R: IN1                                                 mirror mask 0x0C9F
 *   0xC340   R: IN2                                                 mirror mask 0x0C9F
 *   0xC360   R: DSW0                                                mirror mask 0x0C9F
 *
 * MIRRORS ARE DON'T-CARE BIT MASKS, NOT RANGES. `.mirror(0x0b00)` on base 0xB000
 * means bits 0x0800/0x0200/0x0100 are ignored in decoding, so the block answers at
 * 0xB000/B100/B200/B300/B800/B900/BA00/BB00 — and bank 1's own mirrors fill the rest,
 * so the two banks partition 0xB000-0xBFFF with bit 0x0400 selecting between them.
 * Reading them as ranges would alias the wrong bank.
 *
 * Two invariants shared with the other two boards: (1) a read and a write at one address
 * are different devices (0xC000 reads the scanline, writes the sound latch; 0xC200 reads
 * DSW1, writes the watchdog); (2) state lives at its real address, because the arrays are
 * what gets diffed against MAME.
 *
 * THE THIRD ONE DOES NOT CARRY OVER. dkong and thepit throw on unmapped access. This board
 * must NOT: MAME's map opens with `unmap_value_high()`, and the reset routine at 0x07B1
 * reads 0x6000 and compares it to 0x55 to detect an absent expansion ROM -- the float-high
 * 0xFF is what makes that compare fail and the boot continue. Reads there return 0xFF and
 * writes are dropped, both counted on the AddressSpace so a surprising number is still
 * visible. Writing to ROM still throws.
 */

export const ROM_BASE = 0x0000;
export const ROM_END = 0x5fff;

export const COLOR_RAM_BASE = 0xa000;
export const COLOR_RAM_SIZE = 0x0400; // 0xA000-0xA3FF

export const VIDEO_RAM_BASE = 0xa400;
export const VIDEO_RAM_SIZE = 0x0400; // 0xA400-0xA7FF

export const WORK_RAM_BASE = 0xa800;
export const WORK_RAM_SIZE = 0x0800; // 0xA800-0xAFFF

export const SPRITE0_BASE = 0xb000;
export const SPRITE1_BASE = 0xb400;
export const SPRITE_SIZE = 0x0100; // 256 bytes per bank

// State-diff contract: colour, video, work, sprite0, sprite1 concatenated in this order.
// Must match boards/timeplt/hardware.json "stateRegions" and the Lua dumper's REGIONS.
export const STATE_DUMP_SIZE =
  COLOR_RAM_SIZE + VIDEO_RAM_SIZE + WORK_RAM_SIZE + SPRITE_SIZE + SPRITE_SIZE; // 4608

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
   * @param {Uint8Array} rom  24KB maincpu image (0x0000-0x5FFF)
   * @param {object} io       I/O device model (see ./io.js)
   */
  constructor(rom, io) {
    if (rom.length !== ROM_END + 1) {
      throw new Error(`expected a ${ROM_END + 1}-byte ROM, got ${rom.length}`);
    }
    this.rom = rom;
    this.io = io;

    this.colorRam = new Uint8Array(COLOR_RAM_SIZE);
    this.videoRam = new Uint8Array(VIDEO_RAM_SIZE);
    this.workRam = new Uint8Array(WORK_RAM_SIZE);
    this.sprite0 = new Uint8Array(SPRITE_SIZE);
    this.sprite1 = new Uint8Array(SPRITE_SIZE);

    this.unmappedReads = 0;
    this.unmappedWrites = 0;
    this.pc = undefined;
    this.writeTrace = null; // set to [] to record hardware writes in execution order
    this.clock = null;
  }

  /** The device addresses the write-diff contract covers. Mirrors included. */
  static isHardwareWrite(addr) {
    return (addr & 0xf000) === 0xc000;
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

  /** Which device a 0xC000-0xCFFF access decodes to, honouring the mirror masks. */
  static _decodeIo(addr) {
    // The mirror masks leave bits 0x0300 DECODED, so those two bits are the selector:
    //   0x0CFF on 0xC000 and 0xC200 -- don't-care 0x0C00 and 0x00FF
    //   0x0C9F on 0xC300/20/40/60   -- don't-care 0x0C00, 0x0080 and 0x001F
    //
    //   00 -> 0xC000  scanline / sound latch
    //   01 -> NOTHING. No block has 0x0100 in its base, and 0x0100 is not a don't-care
    //         bit of any of them, so 0xC1xx/0xC5xx/0xC9xx/0xCDxx are unmapped and float
    //         high. Treating bit 0x0200 as the whole selector aliases them onto the
    //         scanline counter, which turns a 0xFF into a live raster value.
    //   10 -> 0xC200  DSW1 / watchdog
    //   11 -> 0xC300  the input ports, sub-selected by bits 0x0060
    switch (addr & 0x0300) {
      case 0x0000: return { kind: "scanline_sound" };
      case 0x0200: return { kind: "dsw1_watchdog" };
      case 0x0300: return { kind: "port", sel: addr & 0x0060 };
      default: return { kind: "unmapped" };
    }
  }

  read8(addr) {
    addr &= 0xffff;

    if (addr <= ROM_END) return this.rom[addr];

    if (addr >= COLOR_RAM_BASE && addr < COLOR_RAM_BASE + COLOR_RAM_SIZE) {
      return this.colorRam[addr - COLOR_RAM_BASE];
    }
    if (addr >= VIDEO_RAM_BASE && addr < VIDEO_RAM_BASE + VIDEO_RAM_SIZE) {
      return this.videoRam[addr - VIDEO_RAM_BASE];
    }
    if (addr >= WORK_RAM_BASE && addr < WORK_RAM_BASE + WORK_RAM_SIZE) {
      return this.workRam[addr - WORK_RAM_BASE];
    }
    if (addr >= 0xb000 && addr <= 0xbfff) {
      return (addr & 0x0400 ? this.sprite1 : this.sprite0)[addr & 0xff];
    }
    if (addr >= 0xc000 && addr <= 0xcfff) {
      const d = AddressSpace._decodeIo(addr);
      if (d.kind === "scanline_sound") return this.io.readScanline();
      if (d.kind === "dsw1_watchdog") return this.io.readDsw1();
      if (d.kind === "port") {
        switch (d.sel) {
          case 0x00: return this.io.readIn0();
          case 0x20: return this.io.readIn1();
          case 0x40: return this.io.readIn2();
          case 0x60: return this.io.readDsw0();
        }
      }
      // kind "unmapped" falls through to the float-high path below.
    }

    // MAME's main_map opens with `map.unmap_value_high()`, so an unmapped READ floats
    // high and returns 0xFF. This is NOT a place to throw, because the ROM DEPENDS on
    // it: the reset routine at 0x07B1 reads 0x6000 and compares it to 0x55 to detect an
    // expansion ROM that is not fitted. Throwing there stops the boot before it starts.
    // The other two boards in this repo throw instead, because their ROMs never probe
    // unmapped space -- do not copy their behaviour here.
    this.unmappedReads++;
    return 0xff;
  }

  write8(addr, value, busOffset) {
    addr &= 0xffff;
    value &= 0xff;
    if (this.writeTrace !== null && AddressSpace.isHardwareWrite(addr)) {
      this._trace(addr, value, busOffset);
    }

    if (addr <= ROM_END) throw new UnmappedAccess("write to ROM", addr, this.pc);

    if (addr >= COLOR_RAM_BASE && addr < COLOR_RAM_BASE + COLOR_RAM_SIZE) {
      this.colorRam[addr - COLOR_RAM_BASE] = value;
      return;
    }
    if (addr >= VIDEO_RAM_BASE && addr < VIDEO_RAM_BASE + VIDEO_RAM_SIZE) {
      this.videoRam[addr - VIDEO_RAM_BASE] = value;
      return;
    }
    if (addr >= WORK_RAM_BASE && addr < WORK_RAM_BASE + WORK_RAM_SIZE) {
      this.workRam[addr - WORK_RAM_BASE] = value;
      return;
    }
    if (addr >= 0xb000 && addr <= 0xbfff) {
      (addr & 0x0400 ? this.sprite1 : this.sprite0)[addr & 0xff] = value;
      return;
    }
    if (addr >= 0xc000 && addr <= 0xcfff) {
      const d = AddressSpace._decodeIo(addr);
      if (d.kind === "unmapped") { this.unmappedWrites++; return; }
      if (d.kind === "scanline_sound") { this.io.writeSoundData(value); return; }
      if (d.kind === "dsw1_watchdog") { this.io.kickWatchdog(); return; }
      // The LS259 sits at 0xC300-0xC30F and takes its bit index from offset>>1, with
      // the data on d0. Only that 16-byte window latches; the port mirrors do not.
      if (addr >= 0xc300 && addr <= 0xc30f) {
        this.io.writeControlLatch((addr - 0xc300) >> 1, value & 1);
        return;
      }
      // Everything else in the port block -- 0xC310-0xC31F, 0xC330-0xC3FF and their
      // 0xC7xx/0xCBxx/0xCFxx mirrors -- is read-only in MAME's map too, so the write
      // goes nowhere. COUNTED: the header promises every dropped write stays visible,
      // and a stray write here is exactly the surprising one.
      this.unmappedWrites++;
      return;
    }

    // Unmapped writes go nowhere on the real board. Counted, not thrown, for symmetry
    // with the read side -- but a nonzero count is worth looking at.
    this.unmappedWrites++;
  }

  read16(addr) {
    return this.read8(addr) | (this.read8((addr + 1) & 0xffff) << 8);
  }

  write16(addr, value) {
    this.write8(addr, value & 0xff);
    this.write8((addr + 1) & 0xffff, (value >> 8) & 0xff);
  }

  /** State-diff artifact: colour, video, work, sprite0, sprite1 concatenated. */
  dumpState() {
    const out = new Uint8Array(STATE_DUMP_SIZE);
    let o = 0;
    out.set(this.colorRam, o); o += COLOR_RAM_SIZE;
    out.set(this.videoRam, o); o += VIDEO_RAM_SIZE;
    out.set(this.workRam, o); o += WORK_RAM_SIZE;
    out.set(this.sprite0, o); o += SPRITE_SIZE;
    out.set(this.sprite1, o);
    return out;
  }

  /** Inverse of dumpState()'s layout: dump byte offset -> RAM address. */
  stateOffsetToAddr(off) {
    if (off < COLOR_RAM_SIZE) return COLOR_RAM_BASE + off;
    off -= COLOR_RAM_SIZE;
    if (off < VIDEO_RAM_SIZE) return VIDEO_RAM_BASE + off;
    off -= VIDEO_RAM_SIZE;
    if (off < WORK_RAM_SIZE) return WORK_RAM_BASE + off;
    off -= WORK_RAM_SIZE;
    if (off < SPRITE_SIZE) return SPRITE0_BASE + off;
    return SPRITE1_BASE + (off - SPRITE_SIZE);
  }
}
