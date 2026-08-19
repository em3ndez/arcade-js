// SPDX-License-Identifier: GPL-3.0-only
/**
 * Pooyan (Konami GX320) Z80 address space. Forked from boards/timeplt/memory.js; authoritative map
 * from konami/pooyan.cpp:292-308 (pooyan_state::main_map), NOT re-derived from observation:
 *   0x0000-0x7FFF  ROM (32KB: 1.4a+2.5a+3.6a+4.7a)   0x8000-0x83FF  colour RAM (tile attrs)
 *   0x8400-0x87FF  video RAM (tile codes)            0x8800-0x8FFF  work RAM (2KB)
 *   0x9000-0x90FF  sprite bank 0 / 0x9400 bank 1 (mirror mask 0x0B00, bank bit 0x0400)
 *   0xA000 R=DSW1/W=watchdog  0xA080 IN0  0xA0A0 IN1  0xA0C0 IN2  0xA0E0 DSW0
 *   0xA100 W=sound  0xA180-0xA187 W=LS259 latch (write_d0, one addr per bit = A&7)
 *
 * Mirrors are DON'T-CARE bit masks, not ranges: _decodeIoRead/_decodeIoWrite below implement the
 * decode (significant bits ~(M|(E^B))). Two invariants: R and W at one address are different devices
 * (0xA000 reads DSW1, writes watchdog); state lives at its real address (the arrays are diffed vs MAME).
 * ★ THROWS on any unmapped read/write (dkong/thepit behaviour), unlike timeplt which floats-high --
 * pooyan.cpp does NOT call unmap_value_high and its ROM fills 0x0000-0x7FFF. RECONFIRM on grounding.
 */

export const ROM_BASE = 0x0000;
export const ROM_END = 0x7fff;

export const COLOR_RAM_BASE = 0x8000;
export const COLOR_RAM_SIZE = 0x0400;

export const VIDEO_RAM_BASE = 0x8400;
export const VIDEO_RAM_SIZE = 0x0400;

export const WORK_RAM_BASE = 0x8800;
export const WORK_RAM_SIZE = 0x0800;

export const SPRITE0_BASE = 0x9000;
export const SPRITE1_BASE = 0x9400;
export const SPRITE_SIZE = 0x0100;
export const SPRITE_BANK_BIT = 0x0400; // selects bank within 0x9000-0x9FFF

// colour, video, work, sprite0, sprite1 concatenated in this order -- must match hardware.json
// "stateRegions" and the Lua dumper's REGIONS.
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

    this.pc = undefined;
    this.writeTrace = null; // set to [] to record hardware writes in execution order
    this.clock = null;
  }

  /** True when a write decodes to a hardware device (watchdog/sound/latch) -- the write-diff surface. */
  static isHardwareWrite(addr) {
    const d = AddressSpace._decodeIoWrite(addr & 0xffff);
    return d.kind === "watchdog" || d.kind === "sound" || d.kind === "latch";
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

  /** Which device a READ in 0xA000-0xFFFF decodes to, honouring the mirror masks. */
  static _decodeIoRead(addr) {
    if ((addr & 0xa180) === 0xa000) return { kind: "dsw1" };
    if ((addr & 0xa1e0) === 0xa080) return { kind: "in0" };
    if ((addr & 0xa1e0) === 0xa0a0) return { kind: "in1" };
    if ((addr & 0xa1e0) === 0xa0c0) return { kind: "in2" };
    if ((addr & 0xa1e0) === 0xa0e0) return { kind: "dsw0" };
    return { kind: "unmapped" };
  }

  /** Which device a WRITE decodes to. The latch carries its bit index = addr&7. */
  static _decodeIoWrite(addr) {
    if ((addr & 0xa180) === 0xa180) return { kind: "latch", bit: addr & 7 };
    if ((addr & 0xa180) === 0xa100) return { kind: "sound" };
    if ((addr & 0xa180) === 0xa000) return { kind: "watchdog" };
    return { kind: "unmapped" };
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
    if (addr >= 0x9000 && addr <= 0x9fff) {
      return (addr & SPRITE_BANK_BIT ? this.sprite1 : this.sprite0)[addr & 0xff];
    }
    if (addr >= 0xa000) {
      const d = AddressSpace._decodeIoRead(addr);
      switch (d.kind) {
        case "dsw1": return this.io.readDsw1();
        case "in0": return this.io.readIn0();
        case "in1": return this.io.readIn1();
        case "in2": return this.io.readIn2();
        case "dsw0": return this.io.readDsw0();
      }
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
    if (addr >= 0x9000 && addr <= 0x9fff) {
      (addr & SPRITE_BANK_BIT ? this.sprite1 : this.sprite0)[addr & 0xff] = value;
      return;
    }
    if (addr >= 0xa000) {
      const d = AddressSpace._decodeIoWrite(addr);
      switch (d.kind) {
        case "watchdog": this.io.kickWatchdog(); return;
        case "sound": this.io.writeSoundData(value); return;
        case "latch": this.io.writeControlLatch(d.bit, value & 1); return; // bit = addr&7, NOT timeplt's >>1
      }
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
