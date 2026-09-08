// SPDX-License-Identifier: GPL-3.0-only
// loc_2962  (ROM 0x2962-0x2a90) -- per-segment centipede mover for entity X: advances phase $34+X,
// tests wall/edge state ($54/$63/$64+X vs $F0), links neighbour segments ($34..$74 over Y), and tail-
// exits (JMP 0x2ac7/0x2a92/0x2aa6/0x2a90) to the matching step handler. Irreducible CFG -> block switch.
export function loc_2962(m) {
  const { regs, mem } = m;
  let blk = 0x2962;
  while (true) {
    switch (blk) {
      case 0x2962: {
        regs.a = mem.read8((0x34 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2964, 4);
        if (regs.fPl) { m.step(0x2969, 3); blk = 0x2969; break; }                          // 2964 bpl $2969
        m.step(0x2966, 2);                                                                  // 2964 bpl (fall)
        m.step(0x2ac7, 3); return m.call(0x2ac7);                                           // 2966 jmp $2ac7
      }
      case 0x2969: {
        regs.a = mem.read8(0x0000); regs.setNZ(regs.a); m.step(0x296b, 3);
        regs.and(0x01); m.step(0x296d, 2);
        if (regs.fNZ) { m.step(0x2978, 3); blk = 0x2978; break; }                           // 296d bne $2978
        m.step(0x296f, 2);                                                                  // 296d bne (fall)
        regs.a = mem.read8((0x34 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2971, 4);
        regs.clc(); m.step(0x2972, 2);
        regs.adc(0x01); m.step(0x2974, 2);
        regs.and(0xf7); m.step(0x2976, 2);
        mem.write8((0x34 + regs.x) & 0xff, regs.a); m.step(0x2978, 4);
        blk = 0x2978; break;
      }
      case 0x2978: {
        regs.y = 0x01; regs.setNZ(regs.y); m.step(0x297a, 2);
        regs.a = mem.read8((0x64 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x297c, 4);
        regs.eor(mem.read8(0x00f0)); m.step(0x297e, 3);
        regs.cmp(0x09); m.step(0x2980, 2);
        if (regs.fC) { m.step(0x298c, 3); blk = 0x298c; break; }                            // 2980 bcs $298c
        m.step(0x2982, 2);                                                                  // 2980 bcs (fall)
        regs.a = mem.read8((0x34 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2984, 4);
        regs.cmp(0x10); m.step(0x2986, 2);
        if (regs.fC) { m.step(0x298a, 3); blk = 0x298a; break; }                            // 2986 bcs $298a
        m.step(0x2988, 2);                                                                  // 2986 bcs (fall)
        mem.write8(0x0097, regs.y); m.step(0x298a, 3);
        blk = 0x298a; break;
      }
      case 0x298a: {
        regs.a = mem.read8((0x64 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x298c, 4);
        blk = 0x298c; break;
      }
      case 0x298c: {
        regs.and(0x07); m.step(0x298e, 2);
        if (regs.fNZ) { m.step(0x2a03, 4); blk = 0x2a03; break; }                           // 298e bne $2a03
        m.step(0x2990, 2);                                                                  // 298e bne (fall)
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x2991, 2);
        regs.y = mem.read8(0x0088); regs.setNZ(regs.y); m.step(0x2993, 3);
        { const ea = (0x0094 + regs.y) & 0xffff; regs.cmp(mem.read8(ea)); m.step(0x2996, (0x0094 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
        if (regs.fNZ) { m.step(0x29ac, 3); blk = 0x29ac; break; }                           // 2996 bne $29ac
        m.step(0x2998, 2);                                                                  // 2996 bne (fall)
        regs.a = 0x02; regs.setNZ(regs.a); m.step(0x299a, 2);
        regs.y = mem.read8((0x44 + regs.x) & 0xff); regs.setNZ(regs.y); m.step(0x299c, 4);
        if (regs.fPl) { m.step(0x29a0, 3); blk = 0x29a0; break; }                           // 299c bpl $29a0
        m.step(0x299e, 2);                                                                  // 299c bpl (fall)
        regs.a = 0xfe; regs.setNZ(regs.a); m.step(0x29a0, 2);
        blk = 0x29a0; break;
      }
      case 0x29a0: {
        mem.write8((0x44 + regs.x) & 0xff, regs.a); m.step(0x29a2, 4);
        regs.a = 0x02; regs.setNZ(regs.a); m.step(0x29a4, 2);
        regs.y = mem.read8((0x74 + regs.x) & 0xff); regs.setNZ(regs.y); m.step(0x29a6, 4);
        if (regs.fPl) { m.step(0x29aa, 3); blk = 0x29aa; break; }                           // 29a6 bpl $29aa
        m.step(0x29a8, 2);                                                                  // 29a6 bpl (fall)
        regs.a = 0xfe; regs.setNZ(regs.a); m.step(0x29aa, 2);
        blk = 0x29aa; break;
      }
      case 0x29aa: {
        mem.write8((0x74 + regs.x) & 0xff, regs.a); m.step(0x29ac, 4);
        blk = 0x29ac; break;
      }
      case 0x29ac: {
        regs.a = mem.read8((0x34 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x29ae, 4);
        regs.and(0x40); m.step(0x29b0, 2);
        if (regs.fZ) { m.step(0x29c1, 3); blk = 0x29c1; break; }                            // 29b0 beq $29c1
        m.step(0x29b2, 2);                                                                  // 29b0 beq (fall)
        regs.a = mem.read8((0x63 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x29b4, 4);
        regs.sec(); m.step(0x29b5, 2);
        regs.sbc(mem.read8((0x64 + regs.x) & 0xff)); m.step(0x29b7, 4);
        m.step(0x29ba, 6); m.call(0x382b);
        regs.cmp(0x08); m.step(0x29bc, 2);
        if (regs.fC) { m.step(0x2a03, 4); blk = 0x2a03; break; }                            // 29bc bcs $2a03
        m.step(0x29be, 2);                                                                  // 29bc bcs (fall)
        blk = 0x29be; break;
      }
      case 0x29be: {
        m.step(0x2a92, 3); return m.call(0x2a92);                                           // 29be jmp $2a92
      }
      case 0x29c1: {
        regs.a = mem.read8((0x34 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x29c3, 4);
        regs.and(0x20); m.step(0x29c5, 2);
        if (regs.fNZ) { m.step(0x2a03, 4); blk = 0x2a03; break; }                           // 29c5 bne $2a03
        m.step(0x29c7, 2);                                                                  // 29c5 bne (fall)
        regs.a = mem.read8((0x54 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x29c9, 4);
        regs.cmp(0xf0); m.step(0x29cb, 2);
        if (regs.fNC) { m.step(0x29d7, 3); blk = 0x29d7; break; }                           // 29cb bcc $29d7
        m.step(0x29cd, 2);                                                                  // 29cb bcc (fall)
        regs.y = mem.read8((0x74 + regs.x) & 0xff); regs.setNZ(regs.y); m.step(0x29cf, 4);
        if (regs.fZ) { m.step(0x29df, 3); blk = 0x29df; break; }                            // 29cf beq $29df
        m.step(0x29d1, 2);                                                                  // 29cf beq (fall)
        regs.y = mem.read8((0x44 + regs.x) & 0xff); regs.setNZ(regs.y); m.step(0x29d3, 4);
        if (regs.fPl) { m.step(0x2a03, 4); blk = 0x2a03; break; }                           // 29d3 bpl $2a03
        m.step(0x29d5, 2);                                                                  // 29d3 bpl (fall)
        if (regs.fN) { m.step(0x29e6, 3); blk = 0x29e6; break; }                            // 29d5 bmi $29e6
        m.step(0x29d7, 2); blk = 0x29d7; break;                                             // 29d5 bmi (fall)
      }
      case 0x29d7: {
        regs.cmp(0x10); m.step(0x29d9, 2);
        if (regs.fC) { m.step(0x29e6, 3); blk = 0x29e6; break; }                            // 29d9 bcs $29e6
        m.step(0x29db, 2);                                                                  // 29d9 bcs (fall)
        regs.y = mem.read8((0x74 + regs.x) & 0xff); regs.setNZ(regs.y); m.step(0x29dd, 4);
        if (regs.fNZ) { m.step(0x29e2, 3); blk = 0x29e2; break; }                           // 29dd bne $29e2
        m.step(0x29df, 2); blk = 0x29df; break;                                             // 29dd bne (fall)
      }
      case 0x29df: {
        m.step(0x2aa6, 3); return m.call(0x2aa6);                                           // 29df jmp $2aa6
      }
      case 0x29e2: {
        regs.y = mem.read8((0x44 + regs.x) & 0xff); regs.setNZ(regs.y); m.step(0x29e4, 4);
        if (regs.fN) { m.step(0x2a03, 4); blk = 0x2a03; break; }                            // 29e4 bmi $2a03
        m.step(0x29e6, 2); blk = 0x29e6; break;                                             // 29e4 bmi (fall)
      }
      case 0x29e6: {
        m.step(0x29e9, 6); m.call(0x2310);
        m.step(0x29ec, 6); m.call(0x2c2b);
        if (regs.fZ) { m.step(0x29fe, 3); blk = 0x29fe; break; }                            // 29ec beq $29fe
        m.step(0x29ee, 2);                                                                  // 29ec beq (fall)
        regs.cmp(0x38); m.step(0x29f0, 2);
        if (regs.fNC) { m.step(0x2a03, 4); blk = 0x2a03; break; }                           // 29f0 bcc $2a03
        m.step(0x29f2, 2);                                                                  // 29f0 bcc (fall)
        regs.cmp(0x3c); m.step(0x29f4, 2);
        if (regs.fC) { m.step(0x2a03, 4); blk = 0x2a03; break; }                            // 29f4 bcs $2a03
        m.step(0x29f6, 2);                                                                  // 29f4 bcs (fall)
        regs.a = mem.read8((0x34 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x29f8, 4);
        regs.ora(0x20); m.step(0x29fa, 2);
        mem.write8((0x34 + regs.x) & 0xff, regs.a); m.step(0x29fc, 4);
        if (regs.fNC) { m.step(0x2a03, 4); blk = 0x2a03; break; }                           // 29fc bcc $2a03
        m.step(0x29fe, 2); blk = 0x29fe; break;                                             // 29fc bcc (fall)
      }
      case 0x29fe: {
        m.step(0x2a01, 6); m.call(0x2c6b);
        if (regs.fNC) { m.step(0x29be, 4); blk = 0x29be; break; }                           // 2a01 bcc $29be
        m.step(0x2a03, 2); blk = 0x2a03; break;                                             // 2a01 bcc (fall)
      }
      case 0x2a03: {
        regs.a = mem.read8((0x64 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2a05, 4);
        regs.eor(mem.read8(0x00f0)); m.step(0x2a07, 3);
        regs.y = mem.read8((0x74 + regs.x) & 0xff); regs.setNZ(regs.y); m.step(0x2a09, 4);
        if (regs.fZ) { m.step(0x29df, 4); blk = 0x29df; break; }                            // 2a09 beq $29df
        m.step(0x2a0b, 2);                                                                  // 2a09 beq (fall)
        if (regs.fPl) { m.step(0x2a1f, 3); blk = 0x2a1f; break; }                           // 2a0b bpl $2a1f
        m.step(0x2a0d, 2);                                                                  // 2a0b bpl (fall)
        regs.y = mem.read8(0x00ef); regs.setNZ(regs.y); m.step(0x2a0f, 3);
        if (regs.fZ) { m.step(0x2a19, 3); blk = 0x2a19; break; }                            // 2a0f beq $2a19
        m.step(0x2a11, 2);                                                                  // 2a0f beq (fall)
        regs.eor(mem.read8(0x00f0)); m.step(0x2a13, 3);
        regs.cmp(0xc9); m.step(0x2a15, 2);
        if (regs.fNC) { m.step(0x2a7a, 3); blk = 0x2a7a; break; }                           // 2a15 bcc $2a7a
        m.step(0x2a17, 2);                                                                  // 2a15 bcc (fall)
        m.step(0x2a81, 3); blk = 0x2a81; break;                                             // 2a17 bcs $2a81
      }
      case 0x2a19: {
        regs.cmp(0x30); m.step(0x2a1b, 2);
        if (regs.fC) { m.step(0x2a7a, 3); blk = 0x2a7a; break; }                            // 2a1b bcs $2a7a
        m.step(0x2a1d, 2);                                                                  // 2a1b bcs (fall)
        m.step(0x2a81, 3); blk = 0x2a81; break;                                             // 2a1d bcc $2a81
      }
      case 0x2a1f: {
        regs.cmp(0x09); m.step(0x2a21, 2);
        if (regs.fC) { m.step(0x2a81, 3); blk = 0x2a81; break; }                            // 2a21 bcs $2a81
        m.step(0x2a23, 2);                                                                  // 2a21 bcs (fall)
        regs.a = mem.read8((0x34 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2a25, 4);
        regs.and(0x40); m.step(0x2a27, 2);
        if (regs.fNZ) { m.step(0x2a7a, 3); blk = 0x2a7a; break; }                           // 2a27 bne $2a7a
        m.step(0x2a29, 2);                                                                  // 2a27 bne (fall)
        regs.a = mem.read8((0x34 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2a2b, 4);
        regs.and(0xdf); m.step(0x2a2d, 2);
        mem.write8((0x34 + regs.x) & 0xff, regs.a); m.step(0x2a2f, 4);
        regs.cpx(0x0b); m.step(0x2a31, 2);
        if (regs.fZ) { m.step(0x2a7a, 3); blk = 0x2a7a; break; }                            // 2a31 beq $2a7a
        m.step(0x2a33, 2);                                                                  // 2a31 beq (fall)
        regs.a = regs.x; regs.setNZ(regs.a); m.step(0x2a34, 2);
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0x2a35, 2);
        regs.y = regs.inc8(regs.y); m.step(0x2a36, 2);
        { const ea = (0x0034 + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0x2a39, (0x0034 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
        if (regs.fN) { m.step(0x2a7a, 3); blk = 0x2a7a; break; }                            // 2a39 bmi $2a7a
        m.step(0x2a3b, 2);                                                                  // 2a39 bmi (fall)
        regs.and(0x40); m.step(0x2a3d, 2);
        if (regs.fZ) { m.step(0x2a7a, 3); blk = 0x2a7a; break; }                            // 2a3d beq $2a7a
        m.step(0x2a3f, 2); blk = 0x2a3f; break;                                             // 2a3d beq (fall)
      }
      case 0x2a3f: {
        regs.cpy(0x0b); m.step(0x2a41, 2);
        if (regs.fZ) { m.step(0x2a4c, 3); blk = 0x2a4c; break; }                            // 2a41 beq $2a4c
        m.step(0x2a43, 2);                                                                  // 2a41 beq (fall)
        { const ea = (0x0035 + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0x2a46, (0x0035 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
        if (regs.fN) { m.step(0x2a4c, 3); blk = 0x2a4c; break; }                            // 2a46 bmi $2a4c
        m.step(0x2a48, 2);                                                                  // 2a46 bmi (fall)
        regs.and(0x40); m.step(0x2a4a, 2);
        if (regs.fNZ) { m.step(0x2a75, 3); blk = 0x2a75; break; }                           // 2a4a bne $2a75
        m.step(0x2a4c, 2); blk = 0x2a4c; break;                                             // 2a4a bne (fall)
      }
      case 0x2a4c: {
        { const ea = (0x0064 + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0x2a4f, (0x0064 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
        regs.eor(mem.read8(0x00f0)); m.step(0x2a51, 3);
        regs.cmp(0x09); m.step(0x2a53, 2);
        if (regs.fC) { m.step(0x2a7a, 3); blk = 0x2a7a; break; }                            // 2a53 bcs $2a7a
        m.step(0x2a55, 2);                                                                  // 2a53 bcs (fall)
        { const ea = (0x0034 + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0x2a58, (0x0034 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
        regs.and(0x07); m.step(0x2a5a, 2);
        mem.write8((0x0034 + regs.y) & 0xffff, regs.a); m.step(0x2a5d, 5);
        { const ea = (0x0044 + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0x2a60, (0x0044 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
        m.step(0x2a63, 6); m.call(0x382d);
        mem.write8((0x0044 + regs.y) & 0xffff, regs.a); m.step(0x2a66, 5);
        { const ea = (0x0064 + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0x2a69, (0x0064 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
        regs.and(0xf8); m.step(0x2a6b, 2);
        mem.write8((0x0064 + regs.y) & 0xffff, regs.a); m.step(0x2a6e, 5);
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x2a70, 2);
        mem.write8((0x0074 + regs.y) & 0xffff, regs.a); m.step(0x2a73, 5);
        m.step(0x2a7a, 3); blk = 0x2a7a; break;                                             // 2a73 beq $2a7a
      }
      case 0x2a75: {
        regs.y = regs.inc8(regs.y); m.step(0x2a76, 2);
        regs.cpy(0x0c); m.step(0x2a78, 2);
        if (regs.fNC) { m.step(0x2a3f, 3); blk = 0x2a3f; break; }                           // 2a78 bcc $2a3f
        m.step(0x2a7a, 2); blk = 0x2a7a; break;                                             // 2a78 bcc (fall)
      }
      case 0x2a7a: {
        regs.a = mem.read8((0x74 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2a7c, 4);
        m.step(0x2a7f, 6); m.call(0x382d);
        mem.write8((0x74 + regs.x) & 0xff, regs.a); m.step(0x2a81, 4);
        blk = 0x2a81; break;
      }
      case 0x2a81: {
        regs.a = mem.read8((0x64 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2a83, 4);
        regs.y = mem.read8(0x00ef); regs.setNZ(regs.y); m.step(0x2a85, 3);
        if (regs.fZ) { m.step(0x2a8d, 3); blk = 0x2a8d; break; }                            // 2a85 beq $2a8d
        m.step(0x2a87, 2);                                                                  // 2a85 beq (fall)
        regs.clc(); m.step(0x2a88, 2);
        regs.adc(mem.read8((0x74 + regs.x) & 0xff)); m.step(0x2a8a, 4);
        m.step(0x2a90, 3); return m.call(0x2a90);                                           // 2a8a jmp $2a90
      }
      case 0x2a8d: {
        regs.sec(); m.step(0x2a8e, 2);
        regs.sbc(mem.read8((0x74 + regs.x) & 0xff)); m.step(0x2a90, 4);
        return m.call(0x2a90);                                                              // fall-through into loc_2a90
      }
    }
  }
}
