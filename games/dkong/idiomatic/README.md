# `idiomatic/` — the go-forward routine layer

This directory holds the **idiomatic, cycle-free, memory-equivalent** rewrites of the translated
routines. It is the go-forward layer (see [docs/decompiler-pipeline](../../../docs/decompiler-pipeline.md)
for the full method and the reasoning); the earlier `optimized/` layer it replaced has been deleted.
New routine work is generated **here**.

## The contract (short form — full detail in docs/decompiler-pipeline)

- **Memory-equivalence, not byte-exactness.** A routine is validated against its `translated/`
  `loc_<addr>` oracle on **RAM (minus `STACK_SCRATCH`) + pc + SP + declared live-out** — never the
  full register file, never cycles. Determine live-out by reading the exit successors. PRNG
  entropy-pinned; every gate carries teeth. Validate via unit-capture at real dispatches + a
  reachability sweep + crafted entries for unreached arms. (The strict whole-machine byte-exact
  gate does **not** apply — cycle-free code under-charges and shifts the NMI.)
- **Direct function calls.** No `m.call`/registry, no `push16`/stack modelling. Computed dispatch →
  a table of function references. The caller-skip idiom → a boolean return + `if (!callee(m)) return;`.
- **Bottom-up.** Decompile callees before callers, so a callee is a real JS signature by the time
  its caller needs it (no register-ABI marshalling).
- **Naming.** Baseline `loc_<addr>`. Promote to an English name only where earned, and always keep
  the identifier clean — the address goes in a `// ROM 0x<addr>` header and the manifest key, never in the name (`snapYToGirder`, not `snapYToGirder_2333`). Same evidence bar
  as the RAM names.

## File header template

```js
// SPDX-License-Identifier: GPL-3.0-only
/**
 * <name> — <one-line role>.  ROM 0x<addr>.
 *
 * Memory-equivalent to the frozen oracle — equivalence-<addr>.test.js.
 * GATE:     <strict | convergent | crafted-entry>; <reachability one-liner>.
 * LIVE-OUT: <memory-only | + which regs/flags>.
 * NAMES:    <imported ram.js names | hex-kept addrs + one-word why>.
 */
```

The swap engine (`resolveAllIdiomatic` in machine.js, reading the `ROUTINES` map in `ram.js`) lays
each idiomatic routine over its `translated/` `loc_<addr>` oracle at its ROM address, so the game
runs idiomatic where developed and translated everywhere else. A routine joins the layer by: land
`idiomatic/<name>.js` + `idiomatic/test/equivalence-<addr>.test.js`, add its address→`{name}` entry
to the `ROUTINES` map in `ram.js`, gate.
