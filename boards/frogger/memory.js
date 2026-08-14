// SPDX-License-Identifier: GPL-3.0-only
/**
 * Frogger (Konami parent `frogger`) Z80 address space -- Galaxian/Scramble family. Authoritative map:
 * MAME galaxian.cpp galaxian_state::frogger_map (2416-2430). NEW board (galaxian/ driver), not a fork of
 * our konami/ boards: the layout, the two-8255 I/O window and the unmapped-read policy all differ.
 *
 *   0x0000-0x3FFF ROM (0x0000-0x2FFF populated) · 0x8000-0x87FF work RAM
 *   0x8800 (mirror 0x07FF) watchdog reset_r [READ pets the dog, -> 0xFF]
 *   0xA800 (mirror 0x0400) VIDEORAM (off A&0x3FF) · 0xB000 (mirror 0x0700) OBJRAM (off A&0xFF)
 *   0xB808/B80C/B810/B818/B81C (mirror 0x07E3) irq_enable/flip_y/flip_x/coin_0/coin_1, each D0
 *   0xC000-0xFFFF frogger_ppi8255_r/w (the two i8255 PPIs)
 *
 * THREE POLICY DIFFERENCES from pooyan/dkong:
 *  1. unmap_value_high (@2417): UNMAPPED READS RETURN 0xFF, they do NOT throw. A write to ROM throws;
 *     any other unmapped write is dropped + counted (`unmappedWrites`).
 *  2. Mirrors are DON'T-CARE BIT MASKS: map(B,E).mirror(M) matches A when (A & sig)==(B & sig) for
 *     sig = ~(M|(E^B)). RAM is a plain range; the five 0xB8xx latches each decode by (A & 0xF81C)==target.
 *  3. 0xC000-0xFFFF addresses BOTH PPIs (@1142): off=A-0xC000, A13->PPI0 inputs, A12->PPI1 sound,
 *     port=(off>>1)&3 -> IN0=0xE000 IN1=0xE002 IN2=0xE004; sound 0xD000/0xD002; IN3=0xD004.
 *
 * A read and a write at one address can be different devices; state lives at its real address (the
 * arrays are what gets diffed).
 */

export const ROM_BASE = 0x0000;
export const ROM_END = 0x3fff;

export const WORK_RAM_BASE = 0x8000;
export const WORK_RAM_SIZE = 0x0800;

export const VIDEO_RAM_BASE = 0xa800;
export const VIDEO_RAM_SIZE = 0x0400;

export const OBJ_RAM_BASE = 0xb000;
export const OBJ_RAM_SIZE = 0x0100; // scroll/color 0x00-0x3F, sprites 0x40-0x5F, bullets 0x60-0x7F

// State-diff contract: work RAM + video RAM + OBJRAM concatenated, in this order; matches hardware.json.
export const STATE_DUMP_SIZE = WORK_RAM_SIZE + VIDEO_RAM_SIZE + OBJ_RAM_SIZE;

// Latch decode targets (see header): (addr & 0xF81C) == one of these.
export const LATCH_MASK = 0xf81c;
export const LATCH_IRQ_ENABLE = 0xb808;
export const LATCH_FLIP_Y = 0xb80c;
export const LATCH_FLIP_X = 0xb810;
export const LATCH_COIN_0 = 0xb818;
export const LATCH_COIN_1 = 0xb81c;

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
  /** rom: 16KB maincpu image @0x0000-0x3FFF. io: device model (./io.js) with ppiRead/ppiWrite + latch setters. */
  constructor(rom, io) {
    if (rom.length !== ROM_END + 1) {
      throw new Error(`expected a ${ROM_END + 1}-byte ROM (0x0000-0x3FFF), got ${rom.length}`);
    }
    this.rom = rom;
    this.io = io;

    this.workRam = new Uint8Array(WORK_RAM_SIZE);
    this.videoRam = new Uint8Array(VIDEO_RAM_SIZE);
    this.objRam = new Uint8Array(OBJ_RAM_SIZE);

    this.watchdogReads = 0;
    this.unmappedWrites = 0; // dropped writes to unmapped space (NOT ROM, which throws)

    this.pc = undefined;
    this.writeTrace = null; // set to [] to record hardware writes in execution order
    this.clock = null;
  }

  /** Which standalone D0 latch a WRITE decodes to ((addr & 0xF81C), mirror 0x07E3), or null. Safe on any addr. */
  static _decodeLatch(addr) {
    switch (addr & LATCH_MASK) {
      case LATCH_IRQ_ENABLE: return "irq";
      case LATCH_FLIP_Y: return "flipy";
      case LATCH_FLIP_X: return "flipx";
      case LATCH_COIN_0: return "coin0";
      case LATCH_COIN_1: return "coin1";
      default: return null;
    }
  }

  /** True when a write hits a device (latch or PPI window), not RAM -- the write-diff/record surface. */
  static isHardwareWrite(addr) {
    const a = addr & 0xffff;
    if (a >= 0xc000) return true; // PPI window (sound path + control words)
    return AddressSpace._decodeLatch(a) !== null;
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

  /** frogger_ppi8255_r decode (galaxian.cpp:1142): both PPIs can answer, results ANDed. */
  _ppiReadWindow(addr) {
    const off = (addr - 0xc000) & 0x3fff;
    let result = 0xff;
    if (off & 0x1000) result &= this.io.ppiRead(1, (off >> 1) & 3);
    if (off & 0x2000) result &= this.io.ppiRead(0, (off >> 1) & 3);
    return result & 0xff;
  }

  /** frogger_ppi8255_w decode (galaxian.cpp:1152): writes go to both selected PPIs. */
  _ppiWriteWindow(addr, value) {
    const off = (addr - 0xc000) & 0x3fff;
    if (off & 0x1000) this.io.ppiWrite(1, (off >> 1) & 3, value);
    if (off & 0x2000) this.io.ppiWrite(0, (off >> 1) & 3, value);
  }

  read8(addr) {
    addr &= 0xffff;

    if (addr <= ROM_END) return this.rom[addr];
    if (addr >= WORK_RAM_BASE && addr <= 0x87ff) return this.workRam[addr - WORK_RAM_BASE];
    if ((addr & 0xf800) === 0x8800) {
      // watchdog reset_r: pet the dog, return unmap_value_high (0xFF). Stubbed always-OK.
      this.watchdogReads++;
      return 0xff;
    }
    if ((addr & 0xf800) === VIDEO_RAM_BASE) return this.videoRam[addr & 0x3ff];
    if ((addr & 0xf800) === OBJ_RAM_BASE) return this.objRam[addr & 0xff];
    if (addr >= 0xc000) return this._ppiReadWindow(addr);

    // unmap_value_high: every other read floats high. Does NOT throw (unlike pooyan/dkong).
    return 0xff;
  }

  write8(addr, value, busOffset) {
    addr &= 0xffff;
    value &= 0xff;
    if (this.writeTrace !== null && AddressSpace.isHardwareWrite(addr)) {
      this._trace(addr, value, busOffset);
    }

    if (addr <= ROM_END) throw new UnmappedAccess("write to ROM", addr, this.pc);

    if (addr >= WORK_RAM_BASE && addr <= 0x87ff) {
      this.workRam[addr - WORK_RAM_BASE] = value;
      return;
    }
    if ((addr & 0xf800) === VIDEO_RAM_BASE) {
      // galaxian_videoram_w stores + marks the tile dirty; the render reads VRAM from state.
      this.videoRam[addr & 0x3ff] = value;
      return;
    }
    if ((addr & 0xf800) === OBJ_RAM_BASE) {
      // galaxian_objram_w stores; the per-column scroll/color (0x00-0x3F) and sprite/bullet blocks
      // are interpreted at render time from OBJRAM, so here we only store (mirrors pooyan colorram_w).
      this.objRam[addr & 0xff] = value;
      return;
    }
    const latch = AddressSpace._decodeLatch(addr);
    if (latch !== null) {
      const d0 = value & 1;
      switch (latch) {
        case "irq": this.io.setIrqEnable(d0); return;
        case "flipy": this.io.setFlipY(d0); return;
        case "flipx": this.io.setFlipX(d0); return;
        case "coin0": this.io.setCoinCounter(0, d0); return;
        case "coin1": this.io.setCoinCounter(1, d0); return;
      }
    }
    if (addr >= 0xc000) {
      this._ppiWriteWindow(addr, value);
      return;
    }

    // Any other unmapped write (e.g. 0x8800 region, 0x9xxx, 0xB800-non-latch) is dropped + counted.
    this.unmappedWrites++;
  }

  read16(addr) {
    return this.read8(addr) | (this.read8((addr + 1) & 0xffff) << 8);
  }

  write16(addr, value) {
    this.write8(addr, value & 0xff);
    this.write8((addr + 1) & 0xffff, (value >> 8) & 0xff);
  }

  /** State-diff artifact: work RAM, video RAM, OBJRAM concatenated (matches hardware.json). */
  dumpState() {
    const out = new Uint8Array(STATE_DUMP_SIZE);
    let o = 0;
    out.set(this.workRam, o); o += WORK_RAM_SIZE;
    out.set(this.videoRam, o); o += VIDEO_RAM_SIZE;
    out.set(this.objRam, o);
    return out;
  }

  /** Inverse of dumpState()'s layout: dump byte offset -> RAM address. */
  stateOffsetToAddr(off) {
    if (off < WORK_RAM_SIZE) return WORK_RAM_BASE + off;
    off -= WORK_RAM_SIZE;
    if (off < VIDEO_RAM_SIZE) return VIDEO_RAM_BASE + off;
    off -= VIDEO_RAM_SIZE;
    return OBJ_RAM_BASE + off;
  }
}
