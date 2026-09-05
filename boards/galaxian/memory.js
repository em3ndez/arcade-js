// SPDX-License-Identifier: GPL-3.0-only
/**
 * Galaxian (Namco parent `galaxian`) Z80 address space. Authoritative map: MAME galaxian.cpp
 * galaxian_map_base@1746 + galaxian_map_discrete@1739 (galaxian_map@1769 = the two combined).
 *
 *   0x0000-0x3FFF ROM (0x0000-0x27FF populated, rest 0x00 region fill)
 *   0x4000-0x43FF work RAM        (mirror 0x0400 -> 0x4000-0x47FF, offset A&0x3FF)
 *   0x5000-0x53FF VIDEORAM tiles  (mirror 0x0400 -> 0x5000-0x57FF, galaxian_videoram_w)
 *   0x5800-0x58FF OBJRAM/spriteram(mirror 0x0700 -> 0x5800-0x5FFF, galaxian_objram_w:
 *                 0x00-0x3F per-column scroll-Y(even)/color(odd), 0x40-0x5F 8 sprites, 0x60-0x7F bullets)
 *   R 0x6000 IN0 · 0x6800 IN1 · 0x7000 IN2 · 0x7800 watchdog reset_r (each mirror 0x07FF)
 *   W (each mirror 0x07F8, register = addr & 7):
 *     0x6000 block: 0/1 start_lamp, 2 coin_lock, 3 coin_count_0, 4-7 sound lfo_freq_w
 *     0x6800 block: sound_w (all 8 regs)
 *     0x7000 block: 1 irq_enable, 4 stars_enable, 6 flip_x, 7 flip_y (0/2/3/5 unmapped)
 *     0x7800 block: sound pitch_w
 *
 * POLICY (galaxian_map_base uses map.unmap_value_high()@1748): an UNMAPPED READ returns 0xFF and does NOT
 * throw; a WRITE to ROM throws; any other unmapped write is dropped + counted (`unmappedWrites`). Same
 * family as boards/frogger but galaxian is Namco hardware: direct port reads + single-byte latches, no PPI,
 * and a custom discrete sound device instead of a sound CPU. A read and a write at one address are
 * different devices; state lives at its real address (the RAM arrays are what gets diffed vs MAME).
 */

export const ROM_BASE = 0x0000;
export const ROM_END = 0x3fff; // Z80 maps ROM 0x0000-0x3FFF (region size 0x4000); program uses 0x0000-0x27FF

export const WORK_RAM_BASE = 0x4000;
export const WORK_RAM_SIZE = 0x0400;

export const VIDEO_RAM_BASE = 0x5000;
export const VIDEO_RAM_SIZE = 0x0400;

export const OBJ_RAM_BASE = 0x5800;
export const OBJ_RAM_SIZE = 0x0100; // scroll/color 0x00-0x3F, sprites 0x40-0x5F, bullets 0x60-0x7F

// State-diff contract: work RAM + video RAM + OBJRAM concatenated, in this order; matches hardware.json.
export const STATE_DUMP_SIZE = WORK_RAM_SIZE + VIDEO_RAM_SIZE + OBJ_RAM_SIZE;

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
   * rom: the maincpu image (<= 0x4000 bytes); zero-padded here to the full 0x4000 mapped ROM region so
   * reads of the unpopulated 0x2800-0x3FFF tail return 0x00 (MAME ROM_REGION default fill), as MAME does.
   * io: device model (./io.js) with portIn + the latch/sound setters named in write8.
   */
  constructor(rom, io) {
    if (rom.length > ROM_END + 1) {
      throw new Error(`ROM image ${rom.length} bytes exceeds the ${ROM_END + 1}-byte mapped region`);
    }
    this.rom = new Uint8Array(ROM_END + 1); // 0x4000, zero-filled
    this.rom.set(rom);
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

  /** True when a write hits a device (latch or sound register), not RAM -- the write-diff/record surface. */
  static isHardwareWrite(addr) {
    const a = addr & 0xffff;
    const block = a & 0xf800;
    if (block === 0x6000) return true; // start_lamp/coin_lock/coin_count + sound lfo_freq
    if (block === 0x6800) return true; // sound_w
    if (block === 0x7800) return true; // sound pitch_w
    if (block === 0x7000) { // control latches at reg 1/4/6/7 only
      const reg = a & 7;
      return reg === 1 || reg === 4 || reg === 6 || reg === 7;
    }
    return false;
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
    switch (addr & 0xf800) {
      case WORK_RAM_BASE: return this.workRam[addr & 0x3ff];
      case VIDEO_RAM_BASE: return this.videoRam[addr & 0x3ff];
      case OBJ_RAM_BASE: return this.objRam[addr & 0xff];
      case 0x6000: return this.io.portIn(0); // IN0
      case 0x6800: return this.io.portIn(1); // IN1
      case 0x7000: return this.io.portIn(2); // IN2
      case 0x7800: // watchdog reset_r: pet the dog, return unmap_value_high (0xFF). Stubbed always-OK.
        this.watchdogReads++;
        return 0xff;
      default:
        return 0xff; // unmap_value_high: every other read floats high (does NOT throw)
    }
  }

  write8(addr, value, busOffset) {
    addr &= 0xffff;
    value &= 0xff;
    if (this.writeTrace !== null && AddressSpace.isHardwareWrite(addr)) {
      this._trace(addr, value, busOffset);
    }

    if (addr <= ROM_END) throw new UnmappedAccess("write to ROM", addr, this.pc);

    const d0 = value & 1;
    switch (addr & 0xf800) {
      case WORK_RAM_BASE: this.workRam[addr & 0x3ff] = value; return;
      case VIDEO_RAM_BASE: this.videoRam[addr & 0x3ff] = value; return; // galaxian_videoram_w (render reads VRAM from state)
      case OBJ_RAM_BASE: this.objRam[addr & 0xff] = value; return; // galaxian_objram_w (scroll/color/sprite/bullet interpreted at render time)
      case 0x6000:
        switch (addr & 7) {
          case 0: case 1: this.io.setStartLamp(addr & 1, d0); return; // start_lamp_w D0
          case 2: this.io.setCoinLock(d0); return; // coin_lock_w D0
          case 3: this.io.setCoinCounter(0, d0); return; // coin_count_0_w D0
          default: this.io.soundLfoFreq((addr & 7) - 4, value); return; // 4-7 lfo_freq_w (galaxian_sound_device)
        }
      case 0x6800: this.io.soundWrite(addr & 7, value); return; // sound_w 0x6800-0x6807
      case 0x7000:
        switch (addr & 7) {
          case 1: this.io.setIrqEnable(d0); return; // irq_enable_w D0 (NMI-ON latch)
          case 4: this.io.setStarsEnable(d0); return; // stars_enable_w D0
          case 6: this.io.setFlipX(d0); return; // flip_screen_x_w D0
          case 7: this.io.setFlipY(d0); return; // flip_screen_y_w D0
          default: this.unmappedWrites++; return; // 0/2/3/5 unmapped in the 0x7000 block
        }
      case 0x7800: this.io.soundPitch(value); return; // pitch_w (galaxian_sound_device)
      default:
        this.unmappedWrites++; // any other unmapped write is dropped + counted
        return;
    }
  }

  read16(addr) {
    return this.read8(addr) | (this.read8((addr + 1) & 0xffff) << 8);
  }

  write16(addr, value) {
    this.write8(addr, value & 0xff);
    this.write8((addr + 1) & 0xffff, (value >> 8) & 0xff);
  }

  /** State-diff artifact: work RAM, video RAM, OBJRAM concatenated (matches hardware.json stateRegions). */
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
