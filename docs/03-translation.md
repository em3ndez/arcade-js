# 3. Translation to "assembly-JavaScript"

Each ROM routine becomes a JavaScript function that operates on a machine object `m` and mirrors
the original Z80 instruction sequence **one instruction at a time**. We call the result
*assembly-JavaScript*: it is JavaScript, but its shape is the assembly's. These functions are the
frozen oracle — `translated/` — that everything downstream is measured against.

## What a translated routine looks like

A routine reads and writes the CPU registers (`m.regs`), memory (`m.mem`), and hardware (`m.io`),
and calls `m.step(addr, tstates)` at each instruction to advance the program counter to that
address and charge the instruction's T-states. A fragment that loads a byte, tests it, and branches
translates to the equivalent register/flag operations plus the `m.step(...)` calls that account for
exactly the cycles the Z80 spent.

Faithfulness is the whole point:

- **T-states are charged, not ignored.** The cycle budget per frame is fixed by the hardware, and
  the video output depends on *when* within the frame each write lands. A translation that gets the
  logic right but the timing wrong fails the pixel gate. `stepcheck` audits that every `m.step`
  target lands on a real instruction boundary — a cycle error that moves no memory is invisible to
  the state and pixel diffs, so it needs its own check.
- **Flags are exact,** including the awkward ones (`DAA`/BCD, half-carry, parity/overflow, the
  signed vs unsigned distinctions). Each flag helper is pinned against the reference CPU across all
  cases before use.
- **Control flow is modelled honestly.** Tail-jumps that discard the current return address are
  modelled as returns to the caller's caller; the `rst`-dispatch tables become switch/dispatch on
  the same state byte; "caller-skip" idioms (a subroutine that pops its own return to skip the
  caller's remainder) are modelled as an early return the caller checks. Getting these wrong changes
  *which* frame resumes where, so they are translated as the ROM actually behaves.

## Why translation converges

Because the JavaScript runs the ROM's real logic, correctness is a property you can *drive toward*
rather than *guess at*: wherever the translation diverges from the reference emulator, the diff
points at the exact routine that ran on the diverging frame, and you fix that routine. Coverage grows
monotonically — a routine, once translated and gated, stays correct. Contrast reimplementation from
observation, where an unobserved case is simply absent and nothing tells you it's missing.

## Assembly-JavaScript is the oracle, not the destination

Assembly-JavaScript is deliberately *not* idiomatic JavaScript — it trades readability for a provable
correspondence to the ROM, and it is the frozen reference the rest of the pipeline validates against.
Rewriting each routine as ordinary, higher-level JavaScript is a separate stage: the rewrite lives in
`games/<id>/idiomatic/` and stands only once it passes the gate that proves it equivalent to its
translated counterpart. See [the decompiler pipeline](07-decompiler-pipeline.md).

The conventions below keep the two layers cleanly separable. Apply them at translation time, as each
routine is written — they are behaviour-neutral, so they cost nothing up front and mean `translated/`
never needs a retrofit.

### Convention: export every translated routine

**Every top-level routine in `translated/` is `export`ed — no exceptions, from the first line of a
new game.** The idiomatic rewrite reuses the oracle's own implementation of any callee it has not
rewritten yet, so each routine has exactly one implementation and there is never a copy to drift out
of sync. You cannot predict which routines a future rewrite will call, so exporting them all up front
is the only way to avoid discovering a missing export mid-rewrite and being tempted to paste a
verbatim copy elsewhere (which reintroduces the drift the whole design avoids). `export function foo`
runs identically to `function foo`, so it costs nothing.

### Convention: make every call `m.call(0xADDR)`, not a direct function call

A translated `call 0xNNNN` is written **`m.call(0x00nn, …args)`**, never a direct `sub_00nn(m)`.
`m.call` looks the address up in the routine registry (`games/<id>/routines.js`), which maps every
ROM address to its routine, and invokes it. The `m.push16(ret)` and the `m.step(target, cycles)`
that model the CALL's stack push and cycle cost still sit at the call site next to it; only the
*invocation* goes through `m.call`. (Extra args are forwarded for a routine the translation
parameterises; the return value is forwarded for the `rst` caller-skip idiom,
`if (!m.call(0x0008)) return;`.)

The single registry seam is what makes any routine **isolable**. Because every transfer of control
passes through it, the test harness can override one address to capture its real entry states and
replay a candidate rewrite against the oracle at exactly that point (see
[integration testing](05-integration-testing.md) and
[the decompiler pipeline](07-decompiler-pipeline.md)) — a leaf subroutine exactly like a dispatch
target. Without the seam, a routine reached only by a direct call could never be intercepted, because
its caller holds a fixed reference. The registry is the patch table over the address space; `m.call`
is the one seam every transfer of control passes through, exactly like a real `CALL` fetching whatever
code lives at the target.

The address is parsed from the routine's name (`sub_0874` → `0x0874`), so exporting every routine
(above) is what lets `routines.js` build the table by itself. Names of the exact shape `prefix_hhhh`
are ROM addresses. Helper splits the translator introduces (`sub_25f2_body`, `loc_18c6_wrap`) do
**not** match that shape, so they are left out automatically and stay direct-called inside their
parent. The one name that matches the shape yet must **not** claim its address is `tail_23de` — a
tail fragment of `sub_23de`, which owns 0x23de — so it is excluded explicitly (the `NON_CANONICAL`
set in `routines.js`, its only member).

The `sub_`/`entry_`/`handler_`/`arm_`/`tail_` prefix zoo here is a translation artifact. The
idiomatic layer uses a **uniform `loc_<addr>`** baseline, promoting to an earned English name only
where the evidence supports it (always keeping the address as an anchor). See
[the decompiler pipeline](07-decompiler-pipeline.md).

### Convention: one file per routine

Each routine is its own file exporting that one function, which keeps the routine and its equivalence
test in an obvious one-to-one correspondence and — because two rewrites never touch the same file —
lets many run in parallel without collision. The idiomatic rewrite of a routine mirrors the same
one-file-per-routine shape in [`idiomatic/`](07-decompiler-pipeline.md).
