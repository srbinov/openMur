import { getPlatform } from "./platform";

const CODE_TO_KEY: Record<string, string> = {
  Backquote: "`",
  Digit1: "1",
  Digit2: "2",
  Digit3: "3",
  Digit4: "4",
  Digit5: "5",
  Digit6: "6",
  Digit7: "7",
  Digit8: "8",
  Digit9: "9",
  Digit0: "0",
  Minus: "-",
  Equal: "=",
  KeyQ: "Q",
  KeyW: "W",
  KeyE: "E",
  KeyR: "R",
  KeyT: "T",
  KeyY: "Y",
  KeyU: "U",
  KeyI: "I",
  KeyO: "O",
  KeyP: "P",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  KeyA: "A",
  KeyS: "S",
  KeyD: "D",
  KeyF: "F",
  KeyG: "G",
  KeyH: "H",
  KeyJ: "J",
  KeyK: "K",
  KeyL: "L",
  Semicolon: ";",
  Quote: "'",
  KeyZ: "Z",
  KeyX: "X",
  KeyC: "C",
  KeyV: "V",
  KeyB: "B",
  KeyN: "N",
  KeyM: "M",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Space: "Space",
  Escape: "Esc",
  Tab: "Tab",
  Enter: "Enter",
  Backspace: "Backspace",
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
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
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
  Numpad0: "num0",
  Numpad1: "num1",
  Numpad2: "num2",
  Numpad3: "num3",
  Numpad4: "num4",
  Numpad5: "num5",
  Numpad6: "num6",
  Numpad7: "num7",
  Numpad8: "num8",
  Numpad9: "num9",
  NumpadAdd: "numadd",
  NumpadSubtract: "numsub",
  NumpadMultiply: "nummult",
  NumpadDivide: "numdiv",
  NumpadDecimal: "numdec",
  NumpadEnter: "Enter",
  MediaPlayPause: "MediaPlayPause",
  MediaStop: "MediaStop",
  MediaTrackNext: "MediaNextTrack",
  MediaTrackPrevious: "MediaPreviousTrack",
};

export const MODIFIER_CODES = new Set([
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

export type KeyboardInputLike = {
  code: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  control?: boolean;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean;
};

export function getModifierFlags(input: KeyboardInputLike): {
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
} {
  return {
    ctrl: input.ctrlKey ?? input.control ?? false,
    meta: input.metaKey ?? input.meta ?? false,
    alt: input.altKey ?? input.alt ?? false,
    shift: input.shiftKey ?? input.shift ?? false,
  };
}

export function buildModifierOnlyHotkey(
  modifiers: { ctrl: boolean; meta: boolean; alt: boolean; shift: boolean },
  codes: { ctrl?: string; meta?: string; alt?: string; shift?: string },
  platform = getPlatform()
): string | null {
  const isMac = platform === "darwin";
  const rightSidePressed: string[] = [];
  if (codes.ctrl === "ControlRight") rightSidePressed.push("RightControl");
  if (codes.meta === "MetaRight") rightSidePressed.push(isMac ? "RightCommand" : "RightSuper");
  if (codes.alt === "AltRight") rightSidePressed.push(isMac ? "RightOption" : "RightAlt");
  if (codes.shift === "ShiftRight") rightSidePressed.push("RightShift");

  if (rightSidePressed.length === 1) {
    const activeCount = [modifiers.ctrl, modifiers.meta, modifiers.alt, modifiers.shift].filter(
      Boolean
    ).length;
    if (activeCount === 1) {
      return rightSidePressed[0];
    }
  }

  const parts: string[] = [];
  if (modifiers.ctrl) parts.push("Control");
  if (modifiers.meta) parts.push(isMac ? "Command" : "Super");
  if (modifiers.alt) parts.push("Alt");
  if (modifiers.shift) parts.push("Shift");

  if (parts.length >= 2) {
    return parts.join("+");
  }
  return null;
}

export function mapKeyboardInputToHotkey(
  input: KeyboardInputLike,
  platform = getPlatform()
): string | null {
  if (MODIFIER_CODES.has(input.code)) {
    return null;
  }

  const baseKey = CODE_TO_KEY[input.code];
  if (!baseKey) {
    return null;
  }

  const modifiers = getModifierFlags(input);
  const parts: string[] = [];

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

/** Returns a hotkey string for keyDown events, including modifier-only combos. */
export function captureHotkeyFromKeyDown(
  input: KeyboardInputLike,
  modifierCodes: { ctrl?: string; meta?: string; alt?: string; shift?: string },
  platform = getPlatform()
): string | null {
  const modifiers = getModifierFlags(input);

  if (MODIFIER_CODES.has(input.code)) {
    return buildModifierOnlyHotkey(modifiers, modifierCodes, platform);
  }

  return mapKeyboardInputToHotkey(input, platform);
}

/** Whether the OS should swallow this key during capture (prevents Start menu / overview). */
export function shouldSuppressNativeKeyDuringCapture(input: KeyboardInputLike): boolean {
  return MODIFIER_CODES.has(input.code);
}

export function countModifiers(modifiers: {
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
}): number {
  return [modifiers.ctrl, modifiers.meta, modifiers.alt, modifiers.shift].filter(Boolean).length;
}

export function updatePressedModifierCode(
  pressedCodes: Set<string>,
  code: string,
  isKeyDown: boolean
): void {
  if (!MODIFIER_CODES.has(code)) return;
  if (isKeyDown) {
    pressedCodes.add(code);
  } else {
    pressedCodes.delete(code);
  }
}

/** Derive combined modifier state from individually tracked physical keys. */
export function modifiersFromPressedCodes(pressedCodes: Set<string>): {
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
} {
  return {
    ctrl: pressedCodes.has("ControlLeft") || pressedCodes.has("ControlRight"),
    meta: pressedCodes.has("MetaLeft") || pressedCodes.has("MetaRight"),
    alt: pressedCodes.has("AltLeft") || pressedCodes.has("AltRight"),
    shift: pressedCodes.has("ShiftLeft") || pressedCodes.has("ShiftRight"),
  };
}

export function modifierCodesFromPressedCodes(pressedCodes: Set<string>): {
  ctrl?: string;
  meta?: string;
  alt?: string;
  shift?: string;
} {
  const codes: { ctrl?: string; meta?: string; alt?: string; shift?: string } = {};
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

export function activeModifierLabels(
  modifiers: { ctrl: boolean; meta: boolean; alt: boolean; shift: boolean },
  platform = getPlatform()
): string[] {
  const isMac = platform === "darwin";
  const isWindows = platform === "win32";
  const labels: string[] = [];
  if (modifiers.ctrl) labels.push("Ctrl");
  if (modifiers.meta) labels.push(isMac ? "Cmd" : isWindows ? "Win" : "Super");
  if (modifiers.alt) labels.push(isMac ? "Option" : "Alt");
  if (modifiers.shift) labels.push("Shift");
  return labels;
}
