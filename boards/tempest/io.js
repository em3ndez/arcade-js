// SPDX-License-Identifier: GPL-3.0-only
// Atari Tempest board I/O. Devices + input ports from MAME atari/tempest.cpp. The AVG (boards/tempest/avg.js)
// is owned here: colorram writes (0x0800-080F), go/reset (0x4800/0x5800), done_r (IN0 bit6), flip (0x4000).
// UNIMPLEMENTED devices (mathbox, POKEY read, EAROM) THROW NotImplemented (runbook §2) so the boot-gap crawl
// names them; POKEY writes are recorded for the §5 audio seam. Input idle values are the DIP defaults,
// flagged pending an exact MAME probe (not read before the first §3 boot gap).

import { Avg } from "./avg.js";

export class NotImplemented extends Error {
  constructor(msg) {
    super(msg);
    this.name = "NotImplemented";
  }
}

export class Io {
  constructor(assets = {}) {
    this.prom = assets.avgprom || new Uint8Array(256); // AVG state PROM (136002-125.d7)
    this.colorram = new Uint8Array(16); // 0x0800-0x080F, active-low nibble per entry
    this.flipX = false;
    this.flipY = false;
    this.playerSelect = 0; // 0x60E0 bit2 (cocktail P1/P2 select)
    this.onAckIrq = null; // Machine sets this (wdclr clears the IRQ line)
    this.onPokeyWrite = null; // §5 audio capture seam
    this.avg = null; // built in attachMemory (needs vector RAM/ROM readback)

    // Input idle values (active-low ports read high). ⚠ PENDING exact MAME probe.
    this.dsw2 = 0x00;
    this.cabinet = 0x10; // IN1 bit4: 1 = upright (default)
  }

  attachMemory(mem) {
    this.mem = mem;
    const readVec = (addr) => {
      if (addr >= 0x2000 && addr <= 0x2fff) return mem.vectorRam[addr - 0x2000];
      if (addr >= 0x3000 && addr <= 0x3fff) return mem.vectorRom[addr - 0x3000];
      return 0;
    };
    this.avg = new Avg({ prom: this.prom, colorram: this.colorram, readVec });
    this.avg.flipX = this.flipX;
    this.avg.flipY = this.flipY;
  }

  // IN0 (0x0C00): b0 coin3, b1 coin2, b2 coin1, b3 tilt, b4 self-test, b5 diag-step -- all ACTIVE-LOW (idle
  // 1); b6 = AVG done_r (ACTIVE-HIGH, 0 = busy, MAME's default); b7 = 3kHz clock = (total_cycles & 0x100).
  readIn0(cycles) {
    let v = 0x3f; // b0-b5 idle high (nothing pressed)
    if (this.avg && this.avg.doneFlag) v |= 0x40;
    if (cycles & 0x100) v |= 0x80;
    return v;
  }

  // IN1 (0x0D00): b0-3 spinner knob (tempest_knob_r), b4 cabinet dip. Knob idle 0 pending input grounding.
  readIn1() {
    return (this.cabinet & 0x10) | 0x20; // b5 IPT_UNKNOWN reads high; knob idle 0
  }
  readDsw2() {
    return this.dsw2;
  }

  colorramWrite(i, v) {
    this.colorram[i & 0x0f] = v & 0xff;
  }

  coinW(value) {
    this.flipX = !!(value & 0x08);
    this.flipY = !!(value & 0x10);
    if (this.avg) { this.avg.flipX = this.flipX; this.avg.flipY = this.flipY; }
  }
  ledW(value) {
    this.playerSelect = value & 0x04;
  }

  avgGo() {
    if (this.avg) this.avg.goPending = true; // §2: the CPU signals "draw the list" (see video.js)
  }
  avgReset() {
    if (this.avg) this.avg.doneFlag = false;
  }
  wdclr() {
    if (this.onAckIrq) this.onAckIrq();
  }

  // --- unimplemented devices: THROW until §3 reaches them (runbook §2) ---
  mathboxStatus() { throw new NotImplemented("mathbox status_r (0x6040) -- unimplemented"); }
  mathboxLo() { throw new NotImplemented("mathbox lo_r (0x6060) -- unimplemented"); }
  mathboxHi() { throw new NotImplemented("mathbox hi_r (0x6070) -- unimplemented"); }
  mathboxGo(op, v) { throw new NotImplemented(`mathbox go_w (0x6080+${op.toString(16)}) -- unimplemented`); }
  earomRead() { throw new NotImplemented("EAROM read (0x6050) -- unimplemented"); }
  earomWrite(off, v) { throw new NotImplemented(`EAROM write (0x6000+${off.toString(16)}) -- unimplemented`); }
  earomControl(v) { throw new NotImplemented("EAROM control (0x6040 W) -- unimplemented"); }
  pokeyRead(chip, reg, cycles) { throw new NotImplemented(`POKEY${chip + 1} read reg 0x${reg.toString(16)} -- unimplemented`); }
  pokeyWrite(chip, reg, v, cycles) {
    if (this.onPokeyWrite) this.onPokeyWrite(chip, reg, v, cycles); // §5 audio seam; not thrown
  }
}
