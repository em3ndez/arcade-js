-- GROUNDING: what does the chained-kill score ramp do at its TOP?
--
-- Chaining that far by playing well is not a reliable experiment, so this watches the command ring
-- for every score the machine posts AND seeds the step cell into a live chain, forcing the top in a
-- real running machine rather than arguing it from the listing. What follows the seed is real
-- behaviour; that play reaches this state unaided is NOT claimed.
--
-- OUT=<csv path>   frame,event,detail
local OUT = assert(os.getenv("OUT"), "OUT not set")
local POKE_AT = tonumber(os.getenv("POKE_AT") or "1500")
local POKE_TO = tonumber(os.getenv("POKE_TO") or "6")

local M = manager.machine
local IN0 = M.ioport.ports[":IN0"]
local IN1 = M.ioport.ports[":IN1"]
local coin, start = IN0.fields["Coin 1"], IN0.fields["1 Player Start"]
local fire = IN1.fields["P1 Button 1"]
local dirs = { IN1.fields["P1 Up"], IN1.fields["P1 Right"], IN1.fields["P1 Down"], IN1.fields["P1 Left"] }
assert(coin and start and fire, "missing coin/start/fire")

local CHAIN_WINDOW, CHAIN_STEP = 0xa99d, 0xa99e
local RING_LO, RING_HI = 0xac00, 0xac3f
local SCORE_CMD = 4

local rows = {}
local function log(f, ev, detail) rows[#rows + 1] = string.format("%d,%s,%s", f, ev, detail) end

local frame, mem, poked = 0, nil, false
-- Retain every subscription token in a global or it is collected silently and taps stop firing.
RAMP_TAPS, RAMP_SUB = {}, nil

-- The ring holds (command, argument) pairs on even/odd cells. A command byte is only meaningful
-- once its argument has been written, so a pending command is held until the next write lands.
local pending_cmd_off = nil

RAMP_SUB = emu.add_machine_frame_notifier(function()
  if not mem then
    local space = M.devices[":maincpu"].spaces["program"]
    local taps = {}
    -- Log RAW ring writes and reconstruct offline. Pairing (command, argument) live looked
    -- obvious and is not: the ring's drain releases cells by setting the high bit, and those
    -- writes interleave with a poster's two, so a live pairing silently attributes the drain's
    -- byte to a command. Raw is auditable; inferred is not.
    taps[#taps + 1] = space:install_write_tap(RING_LO, RING_HI, "ring", function(offset, data)
      log(frame, "ring", string.format("off=%d data=%d step=%d window=%d play=%d",
          offset - RING_LO, data, mem:read_u8(CHAIN_STEP), mem:read_u8(CHAIN_WINDOW),
          mem:read_u8(0xad30)))
      return data
    end)
    taps[#taps + 1] = space:install_write_tap(CHAIN_STEP, CHAIN_STEP, "step", function(offset, data)
      log(frame, "step_write", string.format("to=%d", data))
      return data
    end)
    assert(#taps == 2, "tap install failed -- refusing to sweep")
    RAMP_TAPS = taps
    mem = space
  end

  frame = frame + 1
  coin:set_value((frame >= 400 and frame < 408) and 1 or 0)
  start:set_value((frame >= 500 and frame < 508) and 1 or 0)
  fire:set_value((frame > 600 and (frame % 8) < 3) and 1 or 0)
  local want = math.floor(frame / 120) % 4
  for i, d in ipairs(dirs) do if d then d:set_value((i - 1) == want and 1 or 0) end end

  -- Force the boundary, and say so in the log so no reader mistakes it for natural play.
  --
  -- A one-shot poke does NOT work here and the first attempt proved it: a per-frame routine on
  -- the play arm resets the step to zero whenever the chain window has run down, so a step
  -- planted at an arbitrary frame is gone long before a kill arrives. Instead, plant it ONCE per
  -- live chain -- when a chain is running (window still open) and we have not already seeded
  -- this one. The chain then climbs from the seed under its own arithmetic, which is the part
  -- being observed.
  if frame >= POKE_AT then
    local window = mem:read_u8(CHAIN_WINDOW)
    if window == 0 then
      poked = false                       -- chain died; arm for the next one
    elseif not poked then
      poked = true
      mem:write_u8(CHAIN_STEP, POKE_TO)
      log(frame, "SEED", string.format("step:=%d into a live chain (forced, not natural play)", POKE_TO))
    end
  end

  if frame % 60 == 0 then
    local out = assert(io.open(OUT, "w"))
    out:write("frame,event,detail\n")
    for _, r in ipairs(rows) do out:write(r, "\n") end
    out:close()
  end
end)
