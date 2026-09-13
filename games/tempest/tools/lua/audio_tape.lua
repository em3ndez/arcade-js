-- SPDX-License-Identifier: GPL-3.0-only
-- §5 AUDIO grounding tape: drive Tempest coin -> start -> repeated fire/superzapper into sustained play, and
-- record the 2x POKEY sound-register write stream (timestamped in emu seconds, so it aligns to the -wavwrite
-- WAV timeline) for the synth-vs-MAME correlation check. Individual single-address write taps only -- a RANGE
-- tap over the POKEY (0x60c0-0x60df) SEGFAULTS. Reuses the coin/start/fire input-injection pattern of
-- gameplay_tape.lua. Retain every tap in a global or the GC drops it (a silent flatline).
local pout = assert(io.open(os.getenv("POKEY_OUT") or "pokey_writes.txt", "w"))
pout:setvbuf("no")
local machine = manager.machine
local mem = machine.devices[":maincpu"].spaces["program"]
local ports = machine.ioport.ports
local function field(port, mask)
  local p = ports[port]
  if not p then return nil end
  for _, f in pairs(p.fields) do if f.mask == mask then return f end end
  return nil
end
local coin = field(":IN0", 0x04)
local start1 = field(":IN2", 0x20)
local fire = field(":BUTTONSP1", 0x02)
local zap = field(":BUTTONSP1", 0x01)

-- One tap per sound register: chip1 @0x60c0-0x60c9, chip2 @0x60d0-0x60d9 (AUDF1..AUDCTL + STIMER).
_G.__taps = {}
local function tap(chip, base)
  for reg = 0, 9 do
    local addr = base + reg
    local c, r = chip, reg
    _G.__taps[#_G.__taps + 1] = mem:install_write_tap(addr, addr, "p" .. chip .. "_" .. reg,
      function(o, d, m)
        pout:write(string.format("%.6f %d %d %d\n", machine.time:as_double(), c, r, d & 0xff))
      end)
  end
end
tap(0, 0x60c0)
tap(1, 0x60d0)

local fn = 0
_G.__sub = emu.add_machine_frame_notifier(function()
  fn = fn + 1
  if coin then coin:set_value((fn >= 50 and fn <= 65) and 1 or 0) end
  if start1 then start1:set_value((fn >= 110 and fn <= 130) and 1 or 0) end
  -- After play begins, fire in repeated bursts and drop a superzapper, to exercise many sound contexts.
  local firing = fn >= 190 and ((fn % 26) < 10)
  if fire then fire:set_value(firing and 1 or 0) end
  if zap then zap:set_value((fn == 320 or fn == 560) and 1 or 0) end
end)
