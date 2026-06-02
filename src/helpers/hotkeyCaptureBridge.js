/**
 * Main-process hotkey capture helpers (mirrors src/utils/hotkeyCapture.ts).
 */

const MODIFIER_CODES = new Set([
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
  "CapsLock",
]);

const CODE_TO_KEY = {
  Backquote: "`",
  Space: "Space",
  Escape: "Esc",
  Tab: "Tab",
  Enter: "Enter",
  Backspace: "Backspace",
  Insert: "Insert",
  Delete: "Delete",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  Pause: "Pause",
  ScrollLock: "Scrolllock",
  PrintScreen: "PrintScreen",
  NumLock: "Numlock",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  F1: "F1",
  F2: "F2",
  F3: "F3",
  F4: "F4",
  F5: "F5",
  F6: "F6",
  F7: "F7",
  F8: "F8",
  F9: "F9",
  F10: "F10",
  F11: "F11",
  F12: "F12",
  F13: "F13",
  F14: "F14",
  F15: "F15",
  F16: "F16",
  F17: "F17",
  F18: "F18",
  F19: "F19",
  F20: "F20",
  F21: "F21",
  F22: "F22",
  F23: "F23",
  F24: "F24",
};

for (let i = 0; i <= 9; i++) {
  CODE_TO_KEY[`Digit${i}`] = String(i);
}

"QWERTYUIOPASDFGHJKLZXCVBNM".split("").forEach((letter) => {
  CODE_TO_KEY[`Key${letter}`] = letter;
});

function getModifierFlags(input) {
  return {
    ctrl: input.ctrlKey ?? input.control ?? false,
    meta: input.metaKey ?? input.meta ?? false,
    alt: input.altKey ?? input.alt ?? false,
    shift: input.shiftKey ?? input.shift ?? false,
  };
}

function countModifiers(modifiers) {
  return [modifiers.ctrl, modifiers.meta, modifiers.alt, modifiers.shift].filter(Boolean).length;
}

function updatePressedModifierCode(pressedCodes, code, isKeyDown) {
  if (!MODIFIER_CODES.has(code)) return;
  if (isKeyDown) pressedCodes.add(code);
  else pressedCodes.delete(code);
}

function modifiersFromPressedCodes(pressedCodes) {
  return {
    ctrl: pressedCodes.has("ControlLeft") || pressedCodes.has("ControlRight"),
    meta: pressedCodes.has("MetaLeft") || pressedCodes.has("MetaRight"),
    alt: pressedCodes.has("AltLeft") || pressedCodes.has("AltRight"),
    shift: pressedCodes.has("ShiftLeft") || pressedCodes.has("ShiftRight"),
  };
}

function modifierCodesFromPressedCodes(pressedCodes) {
  const codes = {};
  if (pressedCodes.has("ControlLeft")) codes.ctrl = "ControlLeft";
  else if (pressedCodes.has("ControlRight")) codes.ctrl = "ControlRight";
  if (pressedCodes.has("MetaLeft")) codes.meta = "MetaLeft";
  else if (pressedCodes.has("MetaRight")) codes.meta = "MetaRight";
  if (pressedCodes.has("AltLeft")) codes.alt = "AltLeft";
  else if (pressedCodes.has("AltRight")) codes.alt = "AltRight";
  if (pressedCodes.has("ShiftLeft")) codes.shift = "ShiftLeft";
  else if (pressedCodes.has("ShiftRight")) codes.shift = "ShiftRight";
  return codes;
}

function syncStateFromPressedCodes(state) {
  state.held = modifiersFromPressedCodes(state.pressedCodes);
  state.modifierCodes = modifierCodesFromPressedCodes(state.pressedCodes);
  const count = countModifiers(state.held);
  if (count > state.peakCount) {
    state.peakCount = count;
    state.peakHeld = { ...state.held };
    state.peakCodes = { ...state.modifierCodes };
  }
}

function buildModifierOnlyHotkey(modifiers, codes, platform) {
  const isMac = platform === "darwin";
  const rightSidePressed = [];
  if (codes.ctrl === "ControlRight") rightSidePressed.push("RightControl");
  if (codes.meta === "MetaRight") rightSidePressed.push(isMac ? "RightCommand" : "RightSuper");
  if (codes.alt === "AltRight") rightSidePressed.push(isMac ? "RightOption" : "RightAlt");
  if (codes.shift === "ShiftRight") rightSidePressed.push("RightShift");

  if (rightSidePressed.length === 1) {
    const activeCount = countModifiers(modifiers);
    if (activeCount === 1) {
      return rightSidePressed[0];
    }
  }

  const parts = [];
  if (modifiers.ctrl) parts.push("Control");
  if (modifiers.meta) parts.push(isMac ? "Command" : "Super");
  if (modifiers.alt) parts.push("Alt");
  if (modifiers.shift) parts.push("Shift");

  return parts.length >= 2 ? parts.join("+") : null;
}

function mapKeyboardInputToHotkey(input, platform) {
  if (MODIFIER_CODES.has(input.code)) {
    return null;
  }

  const baseKey = CODE_TO_KEY[input.code];
  if (!baseKey) {
    return null;
  }

  const modifiers = getModifierFlags(input);
  const parts = [];

  if (platform === "darwin") {
    if (modifiers.ctrl) parts.push("Control");
    if (modifiers.meta) parts.push("Command");
  } else {
    if (modifiers.ctrl) parts.push("Control");
    if (modifiers.meta) parts.push("Super");
  }

  if (modifiers.alt) parts.push("Alt");
  if (modifiers.shift) parts.push("Shift");

  return parts.length > 0 ? [...parts, baseKey].join("+") : baseKey;
}

function captureHotkeyFromKeyDown(input, modifierCodes, platform) {
  const modifiers = getModifierFlags(input);

  if (MODIFIER_CODES.has(input.code)) {
    return buildModifierOnlyHotkey(modifiers, modifierCodes, platform);
  }

  return mapKeyboardInputToHotkey(input, platform);
}

function shouldSuppressNativeKeyDuringCapture(input) {
  return MODIFIER_CODES.has(input.code);
}

function createHotkeyCaptureState() {
  return {
    pressedCodes: new Set(),
    modifierCodes: {},
    held: { ctrl: false, meta: false, alt: false, shift: false },
    peakCount: 0,
    peakHeld: { ctrl: false, meta: false, alt: false, shift: false },
    peakCodes: {},
    lastEmittedHotkey: null,
    lastEmittedAt: 0,
  };
}

function updateModifierCodes(state, code) {
  if (code === "ControlLeft" || code === "ControlRight") {
    state.modifierCodes.ctrl = code;
  } else if (code === "MetaLeft" || code === "MetaRight") {
    state.modifierCodes.meta = code;
  } else if (code === "AltLeft" || code === "AltRight") {
    state.modifierCodes.alt = code;
  } else if (code === "ShiftLeft" || code === "ShiftRight") {
    state.modifierCodes.shift = code;
  }
}

function resetHotkeyCaptureState(state) {
  state.pressedCodes = new Set();
  state.modifierCodes = {};
  state.held = { ctrl: false, meta: false, alt: false, shift: false };
  state.peakCount = 0;
  state.peakHeld = { ctrl: false, meta: false, alt: false, shift: false };
  state.peakCodes = {};
  state.lastEmittedHotkey = null;
  state.lastEmittedAt = 0;
}

function handleNativeCaptureInput(state, input, platform) {
  if (input.type === "keyDown") {
    if (MODIFIER_CODES.has(input.code)) {
      updatePressedModifierCode(state.pressedCodes, input.code, true);
      syncStateFromPressedCodes(state);
    } else {
      state.held = getModifierFlags(input);
      const count = countModifiers(state.held);
      if (count > state.peakCount) {
        state.peakCount = count;
        state.peakHeld = { ...state.held };
        state.peakCodes = { ...state.modifierCodes };
      }
    }

    const hotkey = MODIFIER_CODES.has(input.code)
      ? buildModifierOnlyHotkey(state.held, state.modifierCodes, platform)
      : mapKeyboardInputToHotkey(input, platform);

    if (hotkey) {
      return { hotkey, suppress: shouldSuppressNativeKeyDuringCapture(input) };
    }
    return { hotkey: null, suppress: shouldSuppressNativeKeyDuringCapture(input) };
  }

  if (input.type === "keyUp") {
    let hotkey = null;
    if (MODIFIER_CODES.has(input.code) && state.peakCount >= 2) {
      hotkey = buildModifierOnlyHotkey(state.peakHeld, state.peakCodes, platform);
    }

    if (MODIFIER_CODES.has(input.code)) {
      updatePressedModifierCode(state.pressedCodes, input.code, false);
      syncStateFromPressedCodes(state);
      if (countModifiers(state.held) === 0) {
        state.peakCount = 0;
        state.peakHeld = { ctrl: false, meta: false, alt: false, shift: false };
        state.peakCodes = {};
      }
    }

    return { hotkey, suppress: MODIFIER_CODES.has(input.code) };
  }

  return { hotkey: null, suppress: false };
}

function shouldDedupeCapture(state, hotkey) {
  const now = Date.now();
  if (state.lastEmittedHotkey === hotkey && now - state.lastEmittedAt < 250) {
    return true;
  }
  state.lastEmittedHotkey = hotkey;
  state.lastEmittedAt = now;
  return false;
}

module.exports = {
  MODIFIER_CODES,
  captureHotkeyFromKeyDown,
  shouldSuppressNativeKeyDuringCapture,
  createHotkeyCaptureState,
  updateModifierCodes,
  resetHotkeyCaptureState,
  handleNativeCaptureInput,
  shouldDedupeCapture,
  buildModifierOnlyHotkey,
};
