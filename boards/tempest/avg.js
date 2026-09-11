// SPDX-License-Identifier: GPL-3.0-only
// Atari Analog Vector Generator (AVG), Tempest variant (AVG_TEMPEST). A byte-exact port of MAME 0.288
// src/devices/video/avgdvg.cpp (avg_device + avg_tempest_device). The AVG is a microcoded state machine
// whose sequencing lives in a 256-byte state PROM (136002-125.d7); the handlers are reproduced here. It
// walks the display list the 6502 builds in vector RAM (0x2000-0x2FFF) plus vector ROM (0x3000-0x3FFF),
// and emits an ordered add_point list {x,y,col,intensity} (already expanded to move/draw pairs by
// vg_flush) that feeds the rasterizer. All geometry is 32-bit integer; the position update overflows a
// signed 32-bit int by design (avgdvg.cpp:636-637) and is reproduced with Math.imul 2's-complement wrap.
// Line refs below are avgdvg.cpp unless noted.

const XCENTER = 290 << 16; // (visarea xmax 580)/2 << 16, avgdvg.cpp:1349-1355 / tempest.cpp set_visarea(0,580,0,570)
const YCENTER = 285 << 16; // (visarea ymax 570)/2 << 16
const XDAC_XOR = 0x200;
const YDAC_XOR = 0x200;
const VGSLICE = 10000;

export class Avg {
  // readVec(addr): byte at CPU program address 0x2000..0x3FFF (vector RAM 0x2000-0x2FFF live, vector ROM
  // 0x3000-0x3FFF). prom: Uint8Array(256) state PROM. colorram: Uint8Array(16) (CPU 0x0800-0x080F, active-low).
  constructor({ prom, colorram, readVec }) {
    this.prom = prom;
    this.colorram = colorram;
    this.readVec = readVec;
    this.flipX = false;
    this.flipY = false;
    this.out = []; // the flushed add_point list for the current frame
    this.vectbuf = [];
    this.reset();
  }

  reset() {
    this.pc = 0;
    this.sp = 0;
    this.stack = [0, 0, 0, 0];
    this.op = 0;
    this.dvy12 = 0;
    this.dvy = 0;
    this.dvx = 0;
    this.intLatch = 0;
    this.data = 0;
    this.stateLatch = 0;
    this.scale = 0;
    this.binScale = 0;
    this.intensity = 0;
    this.color = 0;
    this.timer = 0;
    this.halt = 1;
    this.xpos = XCENTER;
    this.ypos = YCENTER;
  }

  op0() { return this.op & 1; }
  op1() { return (this.op >> 1) & 1; }
  op2() { return (this.op >> 2) & 1; }

  stateAddr() {
    return ((((this.stateLatch >> 4) ^ 1) << 7) | (this.op << 4) | (this.stateLatch & 0xf)) & 0xff;
  }

  updateDatabus() {
    this.data = this.readVec(0x2000 + ((this.pc ^ 1) & 0x1fff)) & 0xff;
  }

  // Walk the display list from pc=0 (as go_w does) until the JMPL-to-0 frame boundary flushes the buffer;
  // that flush is one frame's add_point list. Tempest keeps the AVG in an endless JMPL-0 loop
  // (avgdvg.cpp:568-588), so one pass to the first flush-with-content is the frame.
  run() {
    this.reset();
    this.halt = 0;
    this.vectbuf.length = 0;
    this.out.length = 0;
    let guard = 0;
    while (guard++ < 4_000_000) {
      // one micro-state (avgdvg.cpp:1206-1236)
      this.stateLatch = (this.stateLatch & 0x10) | (this.prom[this.stateAddr()] & 0xf);
      if (this.stateLatch & 0x08) {
        this.updateDatabus();
        const flushed = this.dispatch(this.stateLatch & 7);
        if (flushed) return this.out;
      }
      this.stateLatch = ((this.halt << 4) | (this.stateLatch & 0xf)) & 0x1f;
    }
    return this.out; // guard tripped (malformed list) — return what we have
  }

  dispatch(h) {
    switch (h) {
      case 0: this.dvy = (this.dvy & 0x1f00) | this.data; this.pc++; return false;
      case 1:
        this.dvy12 = (this.data >> 4) & 1;
        this.op = this.data >> 5;
        this.intLatch = 0;
        this.dvy = (this.dvy12 << 12) | ((this.data & 0xf) << 8);
        this.dvx = 0;
        this.pc++;
        return false;
      case 2: this.dvx = (this.dvx & 0x1f00) | this.data; this.pc++; return false;
      case 3:
        this.intLatch = this.data >> 4;
        this.dvx = ((this.intLatch & 1) << 12) | ((this.data & 0xf) << 8) | (this.dvx & 0xff);
        this.pc++;
        return false;
      case 4: return this.strobe0();
      case 5: return this.strobe1();
      case 6: return this.strobe2();
      case 7: return this.strobe3();
    }
    return false;
  }

  strobe0() { // avgdvg.cpp:490-526
    if (this.op0()) {
      this.stack[this.sp & 3] = this.pc;
    } else {
      let i = 0;
      while (
        ((this.dvy ^ (this.dvy << 1)) & 0x1000) === 0 &&
        ((this.dvx ^ (this.dvx << 1)) & 0x1000) === 0 &&
        i++ < 16
      ) {
        this.dvy = (this.dvy & 0x1000) | ((this.dvy << 1) & 0x1fff);
        this.dvx = (this.dvx & 0x1000) | ((this.dvx << 1) & 0x1fff);
        this.timer = (this.timer >> 1) & 0xffff;
        this.timer = (this.timer | 0x4000 | (this.op1() << 7)) & 0xffff;
      }
      if (this.op1()) this.timer &= 0xff;
    }
    return false;
  }

  strobe1() { // avgdvg.cpp:529-555
    if (!this.op2()) {
      for (let i = this.binScale; i > 0; i--) {
        this.timer = (this.timer >> 1) & 0xffff;
        this.timer = (this.timer | 0x4000 | (this.op1() << 7)) & 0xffff;
      }
      if (this.op1()) this.timer &= 0xff;
    }
    if (this.op2()) this.sp = (this.op1() ? this.sp - 1 : this.sp + 1) & 0xf;
    return false;
  }

  strobe2() { // tempest_strobe2 (679-691) + avg_common_strobe2 (558-605)
    if (!this.op2() && !this.dvy12) {
      if (this.dvy & 0x800) this.color = this.dvy & 0xf;
      else this.intensity = (this.dvy >> 4) & 0xf;
    }
    if (this.op2()) {
      if (this.op0()) {
        this.pc = (this.dvy << 1) & 0xffff;
        if (this.dvy === 0) {
          // JMPL 0: frame boundary — flush the accumulated buffer as this frame's list.
          this.vgFlush();
          return this.vectbufHadContent;
        }
      } else {
        this.pc = this.stack[this.sp & 3];
      }
    } else if (this.dvy12) {
      this.scale = this.dvy & 0xff;
      this.binScale = (this.dvy >> 8) & 7;
    }
    return false;
  }

  strobe3() { // tempest_strobe3 (693-722) + avg_common_strobe3 (618-650)
    this.halt = this.op0();
    if (!this.op0() && !this.op2()) {
      const cycles = this.op1() ? (0x100 - (this.timer & 0xff)) : (0x8000 - this.timer);
      this.timer = 0;
      const dacx = (((this.dvx >> 3) ^ XDAC_XOR) - 0x200) | 0;
      const dacy = (((this.dvy >> 3) ^ YDAC_XOR) - 0x200) | 0;
      const sc = this.scale ^ 0xff;
      this.xpos = (this.xpos + (Math.imul(Math.imul(dacx, cycles), sc) >> 4)) | 0;
      this.ypos = (this.ypos - (Math.imul(Math.imul(dacy, cycles), sc) >> 4)) | 0;

      let x = this.xpos, y = this.ypos;
      if (this.flipX) x = (x + ((XCENTER - x) << 1)) | 0;
      if (this.flipY) y = (y + ((YCENTER - y) << 1)) | 0;

      const data = this.colorram[this.color];
      const bit3 = (~data >> 3) & 1, bit2 = (~data >> 2) & 1, bit1 = (~data >> 1) & 1, bit0 = (~data) & 1;
      const r = bit1 * 0xf3 + bit0 * 0x0c;
      const g = bit3 * 0xf3;
      const b = bit2 * 0xf3;
      const col = ((r << 16) | (g << 8) | b) >>> 0;
      const inten = ((this.intLatch >> 1) === 1 ? this.intensity : this.intLatch & 0xe) << 4;
      this.addPointBuf((y - YCENTER + XCENTER) | 0, (x - XCENTER + YCENTER) | 0, col, inten);
    }
    if (this.op2()) {
      this.timer = 0;
      this.xpos = XCENTER;
      this.ypos = YCENTER;
      this.addPointBuf(this.xpos, this.ypos, 0, 0); // CNTR: buffered move to center
    }
    return false;
  }

  addPointBuf(x, y, col, intensity) {
    this.vectbuf.push({ x, y, col, intensity });
  }

  // vg_flush (avgdvg.cpp:56-144): each buffered point becomes a (move, draw) segment from the previous
  // point, clipped to the default window [0, 0x5000000]. Emits into this.out as add_point calls.
  vgFlush() {
    const buf = this.vectbuf;
    this.vectbufHadContent = buf.length > 0;
    if (buf.length === 0) { return; }
    const cx0 = 0, cy0 = 0, cx1 = 0x5000000, cy1 = 0x5000000;
    let xs = buf[0].x, ys = buf[0].y;
    for (let i = 0; i < buf.length; i++) {
      let x0 = xs, y0 = ys, x1 = buf[i].x, y1 = buf[i].y;
      xs = buf[i].x; ys = buf[i].y;
      if ((x0 < cx0 && x1 < cx0) || (x0 > cx1 && x1 > cx1)) continue;
      if (x0 < cx0) { y0 += idiv(BigInt(cx0 - x0) * BigInt(y1 - y0), BigInt(x1 - x0)); x0 = cx0; }
      else if (x0 > cx1) { y0 += idiv(BigInt(cx1 - x0) * BigInt(y1 - y0), BigInt(x1 - x0)); x0 = cx1; }
      if (x1 < cx0) { y1 += idiv(BigInt(cx0 - x1) * BigInt(y1 - y0), BigInt(x1 - x0)); x1 = cx0; }
      else if (x1 > cx1) { y1 += idiv(BigInt(cx1 - x1) * BigInt(y1 - y0), BigInt(x1 - x0)); x1 = cx1; }
      if ((y0 < cy0 && y1 < cy0) || (y0 > cy1 && y1 > cy1)) continue;
      if (y0 < cy0) { x0 += idiv(BigInt(cy0 - y0) * BigInt(x1 - x0), BigInt(y1 - y0)); y0 = cy0; }
      else if (y0 > cy1) { x0 += idiv(BigInt(cy1 - y0) * BigInt(x1 - x0), BigInt(y1 - y0)); y0 = cy1; }
      if (y1 < cy0) { x1 += idiv(BigInt(cy0 - y1) * BigInt(x1 - x0), BigInt(y1 - y0)); y1 = cy0; }
      else if (y1 > cy1) { x1 += idiv(BigInt(cy1 - y1) * BigInt(x1 - x0), BigInt(y1 - y0)); y1 = cy1; }
      this.out.push({ x: x0, y: y0, col: buf[i].col, intensity: 0 });
      this.out.push({ x: x1, y: y1, col: buf[i].col, intensity: buf[i].intensity });
    }
    buf.length = 0;
  }
}

// s64 integer division truncating toward zero (C++ operator/), returned as a JS number.
function idiv(num, den) {
  return Number(num / den);
}
