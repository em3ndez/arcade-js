# The Pit

> ## Provenance & transparency — please read first
>
> **This disassembly, RAM map, and game model were produced by AI agents.** They come
> from the open [**arcade-js**](https://github.com/qarl/arcade-js) project — a
> Z80-to-JavaScript port of the original ROM, built and checked by LLM agents.
>
> They are offered here because they are **falsifiably verified**, not hand-asserted:
> - the translation is **memory-equivalent** to the original ROM (the JavaScript is
>   diffed against the ROM's own execution, byte-for-byte, in work/colour/video/sprite RAM);
> - the running JavaScript port is **pixel-exact versus MAME 0.288** (frame-for-frame
>   rendered-image comparison);
> - the game model — every role, gate, and mechanic named below — was confirmed by
>   **live MAME grounding**: poke-and-observe experiments on the real romset, where a
>   value is forced in memory and the on-screen consequence is watched.
>
> We think an AI-produced reverse-engineering that is *machine-checked against the ROM and
> against MAME* is better corroborated than an uncorroborated hand disassembly — and we
> label it plainly, as AI work, for exactly that reason. Verify it against the evidence,
> not against the byline.

## What The Pit is

*The Pit* (Zilec Electronics / Centuri / Taito, 1982) is a dig-and-escape game. You are an
**astronaut-explorer** on a forbidden planet. You **dig down** through a dirt/tunnel field
to a bottom treasure chamber, **grab jewels** (sparse crystals and diamonds — the
ubiquitous red field is diggable *dirt*, not loot), and **climb back up to your ship**.
The final stretch of the escape is the **"Pit"** crossing.

A rival craft has also landed, so **three rival explorers** roam the tunnels; they are
hostile and all three are shootable with your **horizontal laser**. Falling rocks and
arrows and the Pit crossing *block* movement but do not take a life. A board **completes**
when the player reaches the **top rung carrying at least one diamond** — the ship then
descends to carry you off, and the board rebuilds one level higher and faster.

## Navigation

- [Hardware](Hardware.md) — CPU, memory map, I/O ports, LS259 control latch, sprite format
- [Work RAM](RAMUse.md) — 143 named work-RAM cells (0x8000-0x87FF)
- [Main CPU code](Code.md) — the annotated Z80 disassembly

## Coverage — what the "54%" does and doesn't mean

A static reachability trace from the two entry points — the **reset vector** (`0x0000`) and
the **vblank NMI** (`0x0066`) — walks **11098 of the 20480 ROM bytes (54%) as executable
code**. That reachable code is **fully worked**: all **169 routines** are disassembled here,
and every one is translated to JavaScript, rewritten idiomatically, and proven
memory-equivalent to the ROM and pixel-exact versus MAME — the running port plays the whole
game, all boards, frame-exact. So "54%" is *how many ROM bytes are code*, **not** how much of
the game is understood.

The other **9382 bytes (46%)** are what the static trace did not reach as code: overwhelmingly
**data tables** (tilemaps, ROM lookup tables, the drop queue, stop-tile lists, text), plus a
small residue of code entered only through runtime-computed dispatch that a static trace can't
follow. All of it is shown as `defb` data rather than guessed-at instructions — it is **not
un-analyzed code, it is mostly not code at all**.

The **RAM map and game model are grounded across the whole game** — the completion gate,
scoring, the enemy/laser/hazard subsystems, board progression, and the high-score entry flow
were all exercised and observed in live MAME, not inferred from the reachable code alone.
