// SPDX-License-Identifier: GPL-3.0-only

// loc_59e8  (ROM 0x59e8-0x5a05) -- credit/coinage-gated update chain.
// If either coinage nibble (0x882c or 0x882f, seeded at boot) reads 0x0f (free play), return early.
// Otherwise run the five sub-updates (0x5a06, 0x5a56, 0x5a1f, 0x5a9c, 0x7e6d) and tail-jump into
// 0x5ac0 (its ret returns to loc_59e8's caller).
export function loc_59e8(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x882c);
  m.step(0x59eb, 13); // 59e8  ld a,(0882ch)
  regs.cp(0x0f);
  m.step(0x59ed, 7); // 59eb  cp 00fh
  if (regs.fZ) {
    m.ret(11); // 59ed  ret z (free play)
    return;
  }
  m.step(0x59ee, 5); // 59ed  ret z (not taken)
  regs.a = mem.read8(0x882f);
  m.step(0x59f1, 13); // 59ee  ld a,(0882fh)
  regs.cp(0x0f);
  m.step(0x59f3, 7); // 59f1  cp 00fh
  if (regs.fZ) {
    m.ret(11); // 59f3  ret z (free play)
    return;
  }
  m.step(0x59f4, 5); // 59f3  ret z (not taken)
  m.push16(0x59f7); m.step(0x5a06, 17); m.call(0x5a06); // 59f4  call 05a06h (pattern A: rets to 0x59f7)
  m.push16(0x59fa); m.step(0x5a56, 17); m.call(0x5a56); // 59f7  call 05a56h
  m.push16(0x59fd); m.step(0x5a1f, 17); m.call(0x5a1f); // 59fa  call 05a1fh
  m.push16(0x5a00); m.step(0x5a9c, 17); m.call(0x5a9c); // 59fd  call 05a9ch
  m.push16(0x5a03); m.step(0x7e6d, 17); m.call(0x7e6d); // 5a00  call 07e6dh
  m.step(0x5ac0, 10); // 5a03  jp 05ac0h (tail)
  return m.call(0x5ac0);
}
