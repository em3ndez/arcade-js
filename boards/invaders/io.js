// SPDX-License-Identifier: GPL-3.0-only
// Space Invaders I/O (midw8080/mw8080bw.cpp, invaders_state::io_map + MB14241 shift device).
// Unlike the Konami boards this is the 8080 PORT space (IN n / OUT n), reached via portIn/portOut
// (the §3 decompiler emits those for IN/OUT), NOT through the memory AddressSpace. Ports (global_mask 0x7):
//   IN  0 -> IN0    IN  1 -> IN1    IN  2 -> IN2    IN  3 -> mb14241 shift result
//   OUT 2 -> mb14241 shift COUNT/offset   OUT 3 -> sound port 1   OUT 4 -> mb14241 shift DATA
//   OUT 5 -> sound port 2                 OUT 6 -> watchdog reset
// Input polarity is MIXED, pinned from the driver INPUT_PORTS(invaders) in mw8080bw.cpp: most buttons are
// ACTIVE-HIGH (START1/2 IN1 b1/b2, the P1 control bits IN1 b4-6), but IN1 b0 COIN1 and the unused pull-ups
// (IN0 b3, IN1 b3) are ACTIVE-LOW (read 1 idle, 0 pressed). A tape drives PRESSED bits regardless of
// polarity; readInN() folds each bit in per its polarity. The DIP-derived bits (IN0 sw5-8, IN2 lives/
// bonus/coinage) stay at their default-OFF idle; the mb14241 shift direction + EI/DI->INTE are confirmed.

export class NotImplemented extends Error {
  constructor(what) {
    super(`not implemented: ${what}`);
    this.name = "NotImplemented";
  }
}

// Idle input bytes (nothing pressed), from the driver: the active-LOW bits read 1 idle. IN0 b3 unused,
// IN1 b0 COIN1 + b3 unused. IN2 DIP defaults OFF = 3 lives / 1500 bonus / coinage-on = 0x00.
export const IDLE_IN0 = 0x08; // b3 unused (active-low pull-up); DIP sw5-8 + P2 controls default 0
export const IDLE_IN1 = 0x09; // b0 COIN1 + b3 unused (both active-low pull-ups)
export const IDLE_IN2 = 0x00; // DIP defaults + P2 controls
// Active-LOW bit masks per port (a pressed bit CLEARS from idle-1 to 0); all other driven bits active-high.
export const ACTIVE_LOW_IN0 = 0x08;
export const ACTIVE_LOW_IN1 = 0x09;
export const ACTIVE_LOW_IN2 = 0x00;

// Input ports the tape/--input may drive (the three read ports).
export const PORT_ADDRS = new Set([0, 1, 2]);

export class Io {
  constructor() {
    this.in0 = IDLE_IN0;
    this.in1 = IDLE_IN1;
    this.in2 = IDLE_IN2;

    // mb14241 16-bit shift register (SI's sprite-rotation math).
    this.shiftData = 0; // 16-bit
    this.shiftAmount = 0; // 0..7, from OUT 2

    this.inte = false; // 8080 interrupt-enable flip-flop (EI/DI); the interrupt gate (2-RST) reads it
    this.watchdogKicks = 0;
    this.soundData = [0, 0]; // OUT 3 / OUT 5 latches
    this.onSoundWrite = null; // web worker audio sink; null offline
  }

  inputAssert = null; // {port: pressedBits} per frame; folded in per bit polarity (see _fold)

  _pressed(port) {
    if (!this.inputAssert) return 0;
    for (const k of Object.keys(this.inputAssert)) {
      if (!PORT_ADDRS.has(Number(k))) {
        throw new NotImplemented(`--input port ${k}: not an input port (0,1,2 only)`);
      }
    }
    return this.inputAssert[port] || 0;
  }

  // Fold the tape's pressed bits into the idle byte per polarity: an active-LOW pressed bit clears from
  // its idle 1, an active-high pressed bit sets from its idle 0.
  _fold(idle, port, activeLow) {
    const p = this._pressed(port);
    return ((idle & ~(p & activeLow)) | (p & ~activeLow)) & 0xff;
  }
  readIn0() { return this._fold(this.in0, 0, ACTIVE_LOW_IN0); }
  readIn1() { return this._fold(this.in1, 1, ACTIVE_LOW_IN1); }
  readIn2() { return this._fold(this.in2, 2, ACTIVE_LOW_IN2); }

  /** mb14241 result: the 8-bit window of the 16-bit register at the current offset.
   *  ★ direction to confirm vs mame mb14241.cpp shift_result_r. */
  _shiftResult() {
    return ((this.shiftData << this.shiftAmount) >> 8) & 0xff;
  }

  // ---- the 8080 IN/OUT port surface (what the decompiler emits) --------------------------
  portIn(port) {
    switch (port & 0x07) {
      case 0: return this.readIn0();
      case 1: return this.readIn1();
      case 2: return this.readIn2();
      case 3: return this._shiftResult();
      default: throw new NotImplemented(`IN port ${port & 7}`);
    }
  }

  portOut(port, value) {
    value &= 0xff;
    switch (port & 0x07) {
      case 2: this.shiftAmount = value & 0x07; return; // MB14241 shift count/offset
      case 3: this._sound(0, value); return; // sound port 1
      case 4: this.shiftData = ((value << 8) | (this.shiftData >> 8)) & 0xffff; return; // MB14241 data
      case 5: this._sound(1, value); return; // sound port 2
      case 6: this.watchdogKicks++; return; // watchdog reset
      default: throw new NotImplemented(`OUT port ${port & 7}`);
    }
  }

  _sound(idx, value) {
    this.soundData[idx] = value;
    if (this.onSoundWrite) this.onSoundWrite(idx === 0 ? 3 : 5, value); // audio recorded, not modelled
  }

  /** EI/DI set the interrupt-enable flip-flop. The engine's vblank gate reads `nmiMask`; here it is INTE.
   *  (The two-RST timing itself lives in games/invaders/machine.js, not this flag.) */
  setInte(on) { this.inte = !!on; }
  get nmiMask() { return this.inte; }

  loadStateFrom(other) {
    this.in0 = other.in0; this.in1 = other.in1; this.in2 = other.in2;
    this.shiftData = other.shiftData; this.shiftAmount = other.shiftAmount;
    this.inte = other.inte;
    this.watchdogKicks = other.watchdogKicks;
    this.soundData = other.soundData.slice();
    this.inputAssert = other.inputAssert;
  }
}
