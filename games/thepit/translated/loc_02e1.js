// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_02e1  (ROM 0x02e1-0x02fc, The Pit) — the loop head: repeats a four-call
 * body, counting down the memory counter (0x800a), then TAIL-jumps to loc_031a.
 *
 *   02e1  cd e1 47     call 0x47e1
 *   02e4  3e 0a        ld   a,0x0a
 *   02e6  cd ff 4b     call 0x4bff        ; A=0x0a argument
 *   02e9  cd 16 48     call 0x4816
 *   02ec  3e 05        ld   a,0x05
 *   02ee  cd ff 4b     call 0x4bff        ; A=0x05 argument
 *   02f1  3a 0a 80     ld   a,(0x800a)    ; reload counter
 *   02f4  3d           dec  a             ; sets Z when it reaches 0
 *   02f5  32 0a 80     ld   (0x800a),a
 *   02f8  20 e7        jr   nz,0x02e1     ; loop while counter != 0
 *   02fa  c3 1a 03     jp   0x031a        ; TAIL -> loc_031a
 *
 * This is a separate disassembly label (0x02e1) reached two ways: the `call 0x483a`
 * at 0x02de returns HERE (its return address 0x02e1 is this loop head, so the body
 * fires the first time), and the body's own `jr nz,0x02e1` loops back to the top —
 * modelled as a `do { ... } while (regs.fNZ)`. The counter lives in RAM at (0x800a),
 * so this is a MEMORY-counter loop, not `djnz`: `dec a` carries the full dec8 flag
 * semantics and the intervening `ld (0x800a),a` (which touches no flags) lets the Z
 * from `dec a` survive to the `jr nz`. The body always runs at least once (the loop
 * head decides continuation only AFTER the body), which is why it is `do/while`. The
 * counter is 8-bit, so an entry value of 0 wraps 0xff..0x00 and runs 256 times —
 * faithful to the ROM.
 *
 * The closing `jp 0x031a` is an unconditional TAIL-jump that pushes nothing, so it
 * is modelled as `return m.call(0x031a)`: loc_031a's own `ret` pops OUR caller's
 * return and lands one frame up, exactly as the discarded return demands. It is NOT
 * `m.call; m.ret()` — that shape would push a spurious word onto the diffed stack and
 * charge a second ret (see loc_02a1.js / loc_02ca.js). This routine has NO ret of its
 * own. Work-RAM stores to 0x800a take no bus offset.
 */
export function loc_02e1(m) {
  const { regs, mem } = m;

  // loc_02e1: four-call body, repeated until (0x800a) counts down to 0.
  do {
    m.push16(0x02e4);
    m.step(0x47e1, 17); // 02e1  call 0x47e1
    m.call(0x47e1);

    regs.a = 0x0a;
    m.step(0x02e6, 7); // 02e4  ld a,0x0a
    m.push16(0x02e9);
    m.step(0x4bff, 17); // 02e6  call 0x4bff (A=0x0a)
    m.call(0x4bff);

    m.push16(0x02ec);
    m.step(0x4816, 17); // 02e9  call 0x4816
    m.call(0x4816);

    regs.a = 0x05;
    m.step(0x02ee, 7); // 02ec  ld a,0x05
    m.push16(0x02f1);
    m.step(0x4bff, 17); // 02ee  call 0x4bff (A=0x05)
    m.call(0x4bff);

    regs.a = mem.read8(0x800a);
    m.step(0x02f4, 13); // 02f1  ld a,(0x800a) -- reload counter
    regs.a = regs.dec8(regs.a); // 02f4  dec a -- Z set when counter hits 0
    m.step(0x02f5, 4);
    mem.write8(0x800a, regs.a);
    m.step(0x02f8, 13); // 02f5  ld (0x800a),a -- store, no flags
    // 02f8  jr nz,0x02e1 -- loop back while counter != 0, else fall to 0x02fa
    m.step(regs.fNZ ? 0x02e1 : 0x02fa, regs.fNZ ? 12 : 7);
  } while (regs.fNZ);

  // 02fa  jp 0x031a -- unconditional TAIL-jump; loc_031a's ret returns to OUR caller
  m.step(0x031a, 10);
  return m.call(0x031a);
}
