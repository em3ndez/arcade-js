// SPDX-License-Identifier: GPL-3.0-only

// loc_0929  (ROM 0x0929-0x0975) -- ROM signature/protection check + display setup. Entry `ld b,b`
// is a no-op; `jr c,0x0937` is an OVERLAPPING-instruction branch: the carry path lands on the 0x8e
// byte in the middle of `ld hl,0x8e51` (0x0935 = 21 51 8e), decoding it as `adc a,(hl)`, and both
// paths converge at `inc (hl)` (0x0938). The no-carry path first runs loc_092c (ld b,0x19; call
// 0x02ce; ret nz; call 0x02e3; ld hl,0x8e51). After converging it spins until (0x07f5)==0x11, then
// walks a 7-entry signature table (IX=0x0838 downward vs a table via loc_0c45 with base 0x0976):
// any byte mismatch `jr nz,0x0976` jumps INTO the 0x0976 word-table data (a protection trap -- it is
// executed as garbage code, not a routine). All 7 matching -> ld bc,0x07d9; call 0x075d; then three
// `rst 0x38` display-command enqueues (DE=0x068b, DE=0x068e, DE=0x0200) and ret.
export function loc_0929(m) {
  const { regs, mem } = m;

  regs.b = regs.b;
  m.step(0x092a, 4);

  if (regs.fC) {
    m.step(0x0937, 12); // 092a  jr c,0x0937 (taken -> overlaps into the 0x8e byte of `ld hl,0x8e51`)
    // 0937  adc a,(hl)   [the 0x8e byte at 0x0937 decoded as an instruction]
    regs.adc(mem.read8(regs.hl));
    m.step(0x0938, 7);
  } else {
    m.step(0x092c, 7);

    // loc_092c
    regs.b = 0x19;
    m.step(0x092e, 7);

    m.push16(0x0931);
    m.step(0x02ce, 17);
    m.call(0x02ce, "loc_02ce -- returns Z/NZ (gates the ret nz below)");

    if (regs.fNZ) {
      return m.ret(11);
    }
    m.step(0x0932, 5);

    m.push16(0x0935);
    m.step(0x02e3, 17);
    m.call(0x02e3, "loc_02e3");

    regs.hl = 0x8e51;
    m.step(0x0938, 10);
  }

  // 0938  inc (hl)  -- convergence point for both branches
  regs.incMem8(mem, regs.hl);
  m.step(0x0939, 11);

  m.push16(0x093c);
  m.step(0x02b9, 17);
  m.call(0x02b9, "loc_02b9 -- zero-fill RAM regions");

  regs.hl = 0x07f5;
  m.step(0x093f, 10);

  regs.a = 0x11;
  m.step(0x0941, 7);

  // loc_0941: spin-wait until (0x07f5) == 0x11
  for (;;) {
    regs.cp(mem.read8(regs.hl));
    m.step(0x0942, 7);
    if (regs.fNZ) {
      m.step(0x0941, 12);
      continue;
    }
    m.step(0x0944, 7);
    break;
  }

  regs.ix = 0x0838;
  m.step(0x0948, 14);

  regs.b = 0x07;
  m.step(0x094a, 7);

  // loc_094a: compare 7 signature bytes (IX walking down) against the table via loc_0c45
  for (;;) {
    regs.hl = 0x0976;
    m.step(0x094d, 10);

    regs.a = regs.b;
    m.step(0x094e, 4);

    m.push16(0x0951);
    m.step(0x0c45, 17);
    m.call(0x0c45, "loc_0c45 -- indexed table lookup (HL=0x0976 base, A=index) -> DE ptr");

    regs.a = 0x1c;
    m.step(0x0953, 7);

    regs.add(regs.e);
    m.step(0x0954, 4);

    regs.e = regs.a;
    m.step(0x0955, 4);

    if (regs.fNC) {
      m.step(0x0958, 12);
    } else {
      m.step(0x0957, 7);
      regs.d = regs.inc8(regs.d);
      m.step(0x0958, 4);
    }

    // loc_0958
    regs.a = mem.read8(regs.de);
    m.step(0x0959, 7);

    regs.c = regs.a;
    m.step(0x095a, 4);

    regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
    m.step(0x095d, 19);

    regs.cp(regs.c);
    m.step(0x095e, 4);

    // 095e  jr nz,0x0976  -- signature mismatch: jump INTO the 0x0976 word table (protection trap;
    //                        executed as garbage, not a real routine). Control leaves loc_0929.
    if (regs.fNZ) {
      m.step(0x0976, 12);
      return;
    }
    m.step(0x0960, 7);

    regs.ix = (regs.ix - 1) & 0xffff;
    m.step(0x0962, 10);

    regs.djnz();
    if (regs.b !== 0) {
      m.step(0x094a, 13);
      continue;
    }
    m.step(0x0964, 8);
    break;
  }

  regs.bc = 0x07d9;
  m.step(0x0967, 10);

  m.push16(0x096a);
  m.step(0x075d, 17);
  m.call(0x075d, "loc_075d");

  regs.de = 0x068b;
  m.step(0x096d, 10);

  m.push16(0x096e);
  m.step(0x0038, 11);
  m.call(0x0038, "loc_0038 display-command enqueue");

  regs.e = 0x8e;
  m.step(0x0970, 7); // 096e  ld e,0x8e  (D unchanged=0x06 -> DE=0x068e)

  m.push16(0x0971);
  m.step(0x0038, 11);
  m.call(0x0038, "loc_0038 display-command enqueue");

  regs.de = 0x0200;
  m.step(0x0974, 10);

  m.push16(0x0975);
  m.step(0x0038, 11);
  m.call(0x0038, "loc_0038 display-command enqueue");

  return m.ret();
}
