# How arcade-js works

The thesis of this project is simple and unusual:

> **Don't reimplement the game from observation — translate its actual machine code.**
> Disassemble the original ROM, translate every routine to JavaScript that mirrors the
> original instruction-for-instruction, and prove the result **pixel-exact against MAME**.

Reimplementing an arcade game by watching it and guessing the rules *diverges*: every
behaviour you didn't observe is a bug waiting to happen. Translating the ROM *converges*:
the JavaScript does what the silicon did because it runs the same logic the same way, and a
frame-against-frame diff against a reference emulator (MAME) catches any place it doesn't.

The pipeline, end to end: disassemble the ROM into code, data, and a model of the hardware;
translate each routine into faithful *assembly-JavaScript* — the frozen oracle in
`translated/`; prove the whole machine pixel-exact against MAME; then rewrite each routine into
idiomatic JavaScript in `idiomatic/`, holding every rewrite memory-equivalent to the oracle.

Start with [How the agents worked](01-how-the-agents-worked.md) — the port is produced by AI
agents, and that document covers the division of labour, the failure modes actually hit, and
what the structure has to do about them. It is the experiment; the rest is the method.

The remaining documents describe the strategies, in the order you would apply them to a new game.
**The number in each filename *is* this reading order** — insert a document and you renumber the
ones after it, so the sequence always reads straight through.

1. [Disassembly](02-disassembly.md) — recovering code and hardware structure from the ROM.
2. [Translation to "assembly-JavaScript"](03-translation.md) — turning Z80 routines into the faithful oracle.
3. [Drafter testing & mutation](04-drafter-testing-and-mutation.md) — per-routine tests proven to have teeth.
4. [Integration testing](05-integration-testing.md) — the MAME ground-truth harness.
5. [The pixel gate](06-pixel-gate.md) — byte-exact where it must be, tolerant where reality is jittery.
6. [Understanding the mechanisms](07-understanding-the-mechanisms.md) — the living, code-grounded model of how the game plays; built from the code + attract mode, required reading before the idiomatic pass.
7. [The decompiler pipeline](08-decompiler-pipeline.md) — rewriting the faithful translation into idiomatic JavaScript, one memory-equivalence-gated routine at a time.
8. [Porting a new game](09-porting-a-new-game.md) — the CPU / board / game layering in practice.

The running example throughout is **Donkey Kong** (Z80, Nintendo `dkong` board). Nothing about
the method is DK-specific; see [the decompiler pipeline](08-decompiler-pipeline.md) for what
transfers to the next game.
