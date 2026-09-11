// SPDX-License-Identifier: GPL-3.0-only
// Atari Tempest board I/O. Devices + input ports from MAME atari/tempest.cpp. The AVG (boards/tempest/avg.js)
// is owned here: colorram writes (0x0800-080F), go/reset (0x4800/0x5800), done_r (IN0 bit6), flip (0x4000).
// UNIMPLEMENTED devices (mathbox, POKEY read, EAROM) THROW NotImplemented (runbook §2) so the boot-gap crawl
// names them; POKEY writes are recorded for the §5 audio seam. Input idle values are the DIP defaults,
// flagged pending an exact MAME probe (not read before the first §3 boot gap).

import { Avg } from "./avg.js";
import { Pokey } from "./pokey.js";
import { Mathbox } from "./mathbox.js";

export class NotImplemented extends Error {
  constructor(msg) {
    super(msg);
    this.name = "NotImplemented";
  }
}

// ER2055 EAROM -- GI 64x8 electrically-alterable ROM (high-score NVRAM). Fresh = 0xff. Erase-before-write
// (a write ANDs into the cell); reads latch on the CLK falling edge with C1. mame-src/.../machine/er2055.cpp.
export class Er2055 {
  constructor() {
    this.cells = new Uint8Array(64).fill(0xff);
    this.addr = 0;
    this.latch = 0xff;
    this.cs1 = 0; this.cs2 = 0; this.c1 = 0; this.c2 = 0; this.ck = 0;
  }
  setAddress(a) { this.addr = a & 0x3f; }
  setData(d) { this.latch = d & 0xff; }
  read() { return this.latch; }
  setControl(cs1, cs2, c1, c2) {
    const changed = cs1 !== this.cs1 || cs2 !== this.cs2 || c1 !== this.c1 || c2 !== this.c2;
    this.cs1 = cs1; this.cs2 = cs2; this.c1 = c1; this.c2 = c2;
    if (!(cs1 && cs2) || !changed) return;
    this._update();
  }
  setClk(state) {
    const old = this.ck;
    this.ck = state ? 1 : 0;
    if (this.cs1 && this.cs2 && this.ck !== old && !state) { // falling edge, selected
      if (this.c1) this.latch = this.cells[this.addr]; // read mode
      this._update();
    }
  }
  _update() {
    if (!this.c1 && !this.c2) this.cells[this.addr] &= this.latch; // write (erase-before-write AND)
    else if (this.c2 && !this.c1) this.cells[this.addr] = 0xff; // erase
  }
  clone() {
    const e = new Er2055();
    e.cells.set(this.cells);
    e.addr = this.addr; e.latch = this.latch;
    e.cs1 = this.cs1; e.cs2 = this.cs2; e.c1 = this.c1; e.c2 = this.c2; e.ck = this.ck;
    return e;
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
    this.earom = new Er2055(); // ER2055 high-score NVRAM (0x6000-603F write, 0x6040 control, 0x6050 read)
    this.mathbox = new Mathbox(); // 3D-tube math coprocessor (0x6080-609F go, 0x6040 R status, 0x6060/70 result)
    // 2x POKEY @0x60C0/0x60D0: pots carry input (spinner+buttons+dips as 1-bit paddles), RANDOM RNG, sound.
    // pot bit set => that line reads active (0); clear => inactive (228, ramps). ⚠ exact pot<-input mapping
    // PENDING grounding -- idle (0) for now so all lines read inactive (attract-consistent). Sound writes
    // are recorded via onPokeyWrite for §5 (no synth yet).
    this.pokeys = [
      new Pokey(() => this.pokey1PotBits(), (r, v, c) => this.onPokeyWrite && this.onPokeyWrite(0, r, v, c)),
      new Pokey(() => this.pokey2PotBits(), (r, v, c) => this.onPokeyWrite && this.onPokeyWrite(1, r, v, c)),
    ];

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
  mathboxStatus() { return this.mathbox.statusR(); } // 0x6040 R: bit7 busy = 0 (instantaneous)
  mathboxLo() { return this.mathbox.loR(); }
  mathboxHi() { return this.mathbox.hiR(); }
  mathboxGo(op, v) { this.mathbox.goW(op, v); } // 0x6080-609F: offset = opcode, data = operand
  // EAROM (ER2055): earom_write @0x6000-603F, earom_control_w @0x6040, earom_read @0x6050 (tempest.cpp:451-467).
  // Control wiring: CK=EDB0, C1=/EDB2, C2=EDB1, CS1=EDB3, /CS2=GND -> set_control(bit3, 1, !bit2, bit1).
  earomRead() { return this.earom.read(); }
  earomWrite(off, v) { this.earom.setAddress(off & 0x3f); this.earom.setData(v); }
  earomControl(v) {
    this.earom.setControl((v >> 3) & 1, 1, ((v >> 2) & 1) ? 0 : 1, (v >> 1) & 1);
    this.earom.setClk(v & 1);
  }
  // POKEY pot inputs (1-bit paddles): pokey1 <- IN1 (spinner b0-3, cabinet b4), pokey2 <- IN2 (dips/buttons/
  // start). ⚠ idle 0 (all inactive) PENDING the input-grounding pass; refine the exact bit map then.
  pokey1PotBits() { return 0; }
  pokey2PotBits() { return 0; }
  pokeyRead(chip, reg, cycles) { return this.pokeys[chip].read(reg, cycles); }
  pokeyWrite(chip, reg, v, cycles) { this.pokeys[chip].write(reg, v, cycles); }
}
