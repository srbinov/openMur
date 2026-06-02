/**
 * Windows Key Listener for Push-to-Talk
 *
 * Uses Windows Low-Level Keyboard Hook to detect key up/down events.
 * Accepts a virtual key code as command line argument.
 * Outputs "KEY_DOWN" and "KEY_UP" to stdout.
 *
 * Compile with: cl /O2 windows-key-listener.c /Fe:windows-key-listener.exe user32.lib
 * Or with MinGW: gcc -O2 windows-key-listener.c -o windows-key-listener.exe -luser32
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static HHOOK g_hook = NULL;
static DWORD g_targetVk = 0;
static BOOL g_isKeyDown = FALSE;

// Modifier key requirements
static BOOL g_requireCtrl = FALSE;
static BOOL g_requireAlt = FALSE;
static BOOL g_requireShift = FALSE;
static BOOL g_requireWin = FALSE;
static BOOL g_useModifiersOnly = FALSE;
static BOOL g_ctrlDown = FALSE;
static BOOL g_altDown = FALSE;
static BOOL g_shiftDown = FALSE;
static BOOL g_leftWinDown = FALSE;
static BOOL g_rightWinDown = FALSE;

// Hotkey capture mode (--capture): report any pressed combo via stdout
static BOOL g_captureMode = FALSE;
static int g_peakModCount = 0;
static BOOL g_peakCtrl = FALSE;
static BOOL g_peakAlt = FALSE;
static BOOL g_peakShift = FALSE;
static BOOL g_peakWin = FALSE;
static BOOL g_captureEmitted = FALSE;

static int CountPressedModifiers(void) {
    int count = 0;
    if (g_ctrlDown) count++;
    if (g_altDown) count++;
    if (g_shiftDown) count++;
    if (g_leftWinDown || g_rightWinDown) count++;
    return count;
}

static void UpdatePeakModifiers(void) {
    int count = CountPressedModifiers();
    if (count > g_peakModCount) {
        g_peakModCount = count;
        g_peakCtrl = g_ctrlDown;
        g_peakAlt = g_altDown;
        g_peakShift = g_shiftDown;
        g_peakWin = g_leftWinDown || g_rightWinDown;
    }
}

static void FormatPeakHotkey(char* buf, size_t bufSize) {
    size_t pos = 0;
    buf[0] = '\0';

    if (g_peakCtrl) {
        pos += snprintf(buf + pos, bufSize - pos, "%sControl", pos > 0 ? "+" : "");
    }
    if (g_peakAlt) {
        pos += snprintf(buf + pos, bufSize - pos, "%sAlt", pos > 0 ? "+" : "");
    }
    if (g_peakShift) {
        pos += snprintf(buf + pos, bufSize - pos, "%sShift", pos > 0 ? "+" : "");
    }
    if (g_peakWin) {
        pos += snprintf(buf + pos, bufSize - pos, "%sSuper", pos > 0 ? "+" : "");
    }
}

static void EmitCapturedHotkey(void) {
    char buf[128];

    if (g_peakModCount < 2 || g_captureEmitted) {
        return;
    }

    FormatPeakHotkey(buf, sizeof(buf));
    if (buf[0] != '\0') {
        printf("CAPTURED %s\n", buf);
        fflush(stdout);
        g_captureEmitted = TRUE;
    }
}

static void ResetCaptureState(void) {
    if (CountPressedModifiers() == 0) {
        g_peakModCount = 0;
        g_peakCtrl = FALSE;
        g_peakAlt = FALSE;
        g_peakShift = FALSE;
        g_peakWin = FALSE;
        g_captureEmitted = FALSE;
    }
}

static BOOL IsCtrlVk(DWORD vkCode) {
    return vkCode == VK_CONTROL || vkCode == VK_LCONTROL || vkCode == VK_RCONTROL;
}

static BOOL IsAltVk(DWORD vkCode) {
    return vkCode == VK_MENU || vkCode == VK_LMENU || vkCode == VK_RMENU;
}

static BOOL IsShiftVk(DWORD vkCode) {
    return vkCode == VK_SHIFT || vkCode == VK_LSHIFT || vkCode == VK_RSHIFT;
}

static BOOL IsWinVk(DWORD vkCode) {
    return vkCode == VK_LWIN || vkCode == VK_RWIN;
}

static void UpdateModifierState(DWORD vkCode, BOOL isKeyDown) {
    if (IsCtrlVk(vkCode)) {
        g_ctrlDown = isKeyDown;
        return;
    }

    if (IsAltVk(vkCode)) {
        g_altDown = isKeyDown;
        return;
    }

    if (IsShiftVk(vkCode)) {
        g_shiftDown = isKeyDown;
        return;
    }

    if (vkCode == VK_LWIN) {
        g_leftWinDown = isKeyDown;
        return;
    }

    if (vkCode == VK_RWIN) {
        g_rightWinDown = isKeyDown;
    }
}

static BOOL IsRequiredModifierEvent(DWORD vkCode) {
    return (g_requireCtrl && IsCtrlVk(vkCode)) ||
           (g_requireAlt && IsAltVk(vkCode)) ||
           (g_requireShift && IsShiftVk(vkCode)) ||
           (g_requireWin && IsWinVk(vkCode));
}

// Sync tracked modifier state with actual key state for keys that are NOT
// the current hook event. GetAsyncKeyState() is unreliable for the key that
// triggered the current hook callback, but accurate for all other keys.
// This corrects stale state caused by missed key-up events (e.g. Win+L lock).
static void SyncModifierState(DWORD currentVkCode) {
    if (!IsCtrlVk(currentVkCode))
        g_ctrlDown = (GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0;
    if (!IsAltVk(currentVkCode))
        g_altDown = (GetAsyncKeyState(VK_MENU) & 0x8000) != 0;
    if (!IsShiftVk(currentVkCode))
        g_shiftDown = (GetAsyncKeyState(VK_SHIFT) & 0x8000) != 0;
    if (currentVkCode != VK_LWIN)
        g_leftWinDown = (GetAsyncKeyState(VK_LWIN) & 0x8000) != 0;
    if (currentVkCode != VK_RWIN)
        g_rightWinDown = (GetAsyncKeyState(VK_RWIN) & 0x8000) != 0;
}

static BOOL AreRequiredModifiersPressed(void) {
    if (g_requireCtrl && !g_ctrlDown) return FALSE;
    if (g_requireAlt && !g_altDown) return FALSE;
    if (g_requireShift && !g_shiftDown) return FALSE;
    if (g_requireWin && !(g_leftWinDown || g_rightWinDown)) return FALSE;
    return TRUE;
}

// Map key name to virtual key code
DWORD ParseKeyCode(const char* keyName) {
    // Function keys (F1-F12)
    if (_stricmp(keyName, "F1") == 0) return VK_F1;
    if (_stricmp(keyName, "F2") == 0) return VK_F2;
    if (_stricmp(keyName, "F3") == 0) return VK_F3;
    if (_stricmp(keyName, "F4") == 0) return VK_F4;
    if (_stricmp(keyName, "F5") == 0) return VK_F5;
    if (_stricmp(keyName, "F6") == 0) return VK_F6;
    if (_stricmp(keyName, "F7") == 0) return VK_F7;
    if (_stricmp(keyName, "F8") == 0) return VK_F8;
    if (_stricmp(keyName, "F9") == 0) return VK_F9;
    if (_stricmp(keyName, "F10") == 0) return VK_F10;
    if (_stricmp(keyName, "F11") == 0) return VK_F11;
    if (_stricmp(keyName, "F12") == 0) return VK_F12;

    // Extended function keys (F13-F24)
    if (_stricmp(keyName, "F13") == 0) return VK_F13;
    if (_stricmp(keyName, "F14") == 0) return VK_F14;
    if (_stricmp(keyName, "F15") == 0) return VK_F15;
    if (_stricmp(keyName, "F16") == 0) return VK_F16;
    if (_stricmp(keyName, "F17") == 0) return VK_F17;
    if (_stricmp(keyName, "F18") == 0) return VK_F18;
    if (_stricmp(keyName, "F19") == 0) return VK_F19;
    if (_stricmp(keyName, "F20") == 0) return VK_F20;
    if (_stricmp(keyName, "F21") == 0) return VK_F21;
    if (_stricmp(keyName, "F22") == 0) return VK_F22;
    if (_stricmp(keyName, "F23") == 0) return VK_F23;
    if (_stricmp(keyName, "F24") == 0) return VK_F24;

    // Special keys
    if (_stricmp(keyName, "Pause") == 0) return VK_PAUSE;
    if (_stricmp(keyName, "ScrollLock") == 0) return VK_SCROLL;
    if (_stricmp(keyName, "Insert") == 0) return VK_INSERT;
    if (_stricmp(keyName, "Home") == 0) return VK_HOME;
    if (_stricmp(keyName, "End") == 0) return VK_END;
    if (_stricmp(keyName, "PageUp") == 0) return VK_PRIOR;
    if (_stricmp(keyName, "PageDown") == 0) return VK_NEXT;
    if (_stricmp(keyName, "Space") == 0) return VK_SPACE;
    if (_stricmp(keyName, "Escape") == 0 || _stricmp(keyName, "Esc") == 0) return VK_ESCAPE;
    if (_stricmp(keyName, "Tab") == 0) return VK_TAB;
    if (_stricmp(keyName, "CapsLock") == 0) return VK_CAPITAL;
    if (_stricmp(keyName, "NumLock") == 0) return VK_NUMLOCK;

    // Right-side modifier keys (used as single-key hotkeys)
    if (_stricmp(keyName, "RightAlt") == 0 || _stricmp(keyName, "RightOption") == 0) return VK_RMENU;
    if (_stricmp(keyName, "RightControl") == 0 || _stricmp(keyName, "RightCtrl") == 0) return VK_RCONTROL;
    if (_stricmp(keyName, "RightShift") == 0) return VK_RSHIFT;
    if (_stricmp(keyName, "RightSuper") == 0 || _stricmp(keyName, "RightWin") == 0 ||
        _stricmp(keyName, "RightMeta") == 0 || _stricmp(keyName, "RightCommand") == 0 ||
        _stricmp(keyName, "RightCmd") == 0) return VK_RWIN;

    // Backtick/tilde - the default hotkey
    if (strcmp(keyName, "`") == 0 || _stricmp(keyName, "Backquote") == 0) return VK_OEM_3;

    // Other punctuation
    if (strcmp(keyName, "-") == 0 || _stricmp(keyName, "Minus") == 0) return VK_OEM_MINUS;
    if (strcmp(keyName, "=") == 0 || _stricmp(keyName, "Equal") == 0) return VK_OEM_PLUS;
    if (strcmp(keyName, "[") == 0) return VK_OEM_4;
    if (strcmp(keyName, "]") == 0) return VK_OEM_6;
    if (strcmp(keyName, "\\") == 0) return VK_OEM_5;
    if (strcmp(keyName, ";") == 0) return VK_OEM_1;
    if (strcmp(keyName, "'") == 0) return VK_OEM_7;
    if (strcmp(keyName, ",") == 0) return VK_OEM_COMMA;
    if (strcmp(keyName, ".") == 0) return VK_OEM_PERIOD;
    if (strcmp(keyName, "/") == 0) return VK_OEM_2;

    // Single letter/number - convert to VK code
    if (strlen(keyName) == 1) {
        char c = keyName[0];
        if (c >= 'a' && c <= 'z') return (DWORD)(c - 'a' + 'A');
        if (c >= 'A' && c <= 'Z') return (DWORD)c;
        if (c >= '0' && c <= '9') return (DWORD)c;
    }

    // Try parsing as hex or decimal number (for direct VK codes)
    if (keyName[0] == '0' && (keyName[1] == 'x' || keyName[1] == 'X')) {
        return (DWORD)strtol(keyName, NULL, 16);
    }

    return (DWORD)atoi(keyName);
}

LRESULT CALLBACK LowLevelKeyboardProc(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode == HC_ACTION) {
        KBDLLHOOKSTRUCT* kbd = (KBDLLHOOKSTRUCT*)lParam;
        BOOL isKeyDown = (wParam == WM_KEYDOWN || wParam == WM_SYSKEYDOWN);
        BOOL isKeyUp = (wParam == WM_KEYUP || wParam == WM_SYSKEYUP);
        BOOL isModifierEvent = IsCtrlVk(kbd->vkCode) || IsAltVk(kbd->vkCode) ||
                               IsShiftVk(kbd->vkCode) || IsWinVk(kbd->vkCode);

        if (g_captureMode) {
            if ((isKeyDown || isKeyUp) && isModifierEvent) {
                if (isKeyDown) {
                    UpdateModifierState(kbd->vkCode, TRUE);
                    SyncModifierState(kbd->vkCode);
                    UpdatePeakModifiers();
                    if (g_peakModCount >= 2) {
                        EmitCapturedHotkey();
                    }
                } else {
                    if (g_peakModCount >= 2) {
                        EmitCapturedHotkey();
                    }
                    UpdateModifierState(kbd->vkCode, FALSE);
                    SyncModifierState(kbd->vkCode);
                    ResetCaptureState();
                }
            } else if (isKeyDown && !isModifierEvent) {
                SyncModifierState(kbd->vkCode);
                char buf[128];
                size_t pos = 0;
                buf[0] = '\0';

                if (g_ctrlDown) pos += snprintf(buf + pos, sizeof(buf) - pos, "Control+");
                if (g_altDown) pos += snprintf(buf + pos, sizeof(buf) - pos, "Alt+");
                if (g_shiftDown) pos += snprintf(buf + pos, sizeof(buf) - pos, "Shift+");
                if (g_leftWinDown || g_rightWinDown) pos += snprintf(buf + pos, sizeof(buf) - pos, "Super+");

                const char* keyName = NULL;
                if (kbd->vkCode == VK_OEM_3) keyName = "`";
                else if (kbd->vkCode >= 'A' && kbd->vkCode <= 'Z') {
                    snprintf(buf + pos, sizeof(buf) - pos, "%c", (char)kbd->vkCode);
                    keyName = buf + pos;
                } else if (kbd->vkCode >= VK_F1 && kbd->vkCode <= VK_F24) {
                    snprintf(buf + pos, sizeof(buf) - pos, "F%d", (int)(kbd->vkCode - VK_F1 + 1));
                    keyName = buf + pos;
                }

                if (keyName && pos > 0) {
                    printf("CAPTURED %s\n", buf);
                    fflush(stdout);
                } else if (keyName && pos == 0) {
                    printf("CAPTURED %s\n", keyName);
                    fflush(stdout);
                }
            }
            return CallNextHookEx(g_hook, nCode, wParam, lParam);
        }

        if ((isKeyDown || isKeyUp) && isModifierEvent) {
            UpdateModifierState(kbd->vkCode, isKeyDown);
            SyncModifierState(kbd->vkCode);
        }

        // Stop an active press as soon as one of its required modifiers is released.
        if (g_isKeyDown && isKeyUp && IsRequiredModifierEvent(kbd->vkCode) &&
            !AreRequiredModifiersPressed()) {
            g_isKeyDown = FALSE;
            printf("KEY_UP\n");
            fflush(stdout);
        }

        // Self-heal a missed target-key KEY_UP. GetAsyncKeyState is only reliable
        // for keys other than the one in the current callback, so verify here.
        if (g_isKeyDown && !g_useModifiersOnly && kbd->vkCode != g_targetVk &&
            !(GetAsyncKeyState(g_targetVk) & 0x8000)) {
            g_isKeyDown = FALSE;
            printf("KEY_UP\n");
            fflush(stdout);
        }

        if (g_useModifiersOnly) {
            if (isKeyDown) {
                if (!g_isKeyDown && AreRequiredModifiersPressed()) {
                    g_isKeyDown = TRUE;
                    printf("KEY_DOWN\n");
                    fflush(stdout);
                }
            } else if (isKeyUp) {
                if (g_isKeyDown && !AreRequiredModifiersPressed()) {
                    g_isKeyDown = FALSE;
                    printf("KEY_UP\n");
                    fflush(stdout);
                }
            }
            return CallNextHookEx(g_hook, nCode, wParam, lParam);
        }

        // Check for the target key
        if (kbd->vkCode == g_targetVk) {
            if (isKeyDown) {
                // Only trigger if modifiers are satisfied and not already down
                if (!g_isKeyDown && AreRequiredModifiersPressed()) {
                    g_isKeyDown = TRUE;
                    printf("KEY_DOWN\n");
                    fflush(stdout);
                }
            } else if (isKeyUp) {
                // Target key released
                if (g_isKeyDown) {
                    g_isKeyDown = FALSE;
                    printf("KEY_UP\n");
                    fflush(stdout);
                }
            }
        }
    }
    return CallNextHookEx(g_hook, nCode, wParam, lParam);
}

BOOL WINAPI ConsoleHandler(DWORD signal) {
    if (signal == CTRL_C_EVENT || signal == CTRL_BREAK_EVENT || signal == CTRL_CLOSE_EVENT) {
        if (g_hook) {
            UnhookWindowsHookEx(g_hook);
            g_hook = NULL;
        }
        ExitProcess(0);
    }
    return TRUE;
}

// Parse a compound hotkey like "CommandOrControl+Shift+F11"
// Sets g_requireCtrl, g_requireAlt, g_requireShift and returns the main key VK code
DWORD ParseCompoundHotkey(const char* hotkey) {
    char buffer[256];
    strncpy(buffer, hotkey, sizeof(buffer) - 1);
    buffer[sizeof(buffer) - 1] = '\0';

    // Reset modifier requirements
    g_requireCtrl = FALSE;
    g_requireAlt = FALSE;
    g_requireShift = FALSE;
    g_requireWin = FALSE;
    g_useModifiersOnly = FALSE;

    DWORD mainKeyVk = 0;
    char* token = strtok(buffer, "+");

    while (token != NULL) {
        // Trim leading/trailing spaces
        while (*token == ' ') token++;
        char* end = token + strlen(token) - 1;
        while (end > token && *end == ' ') *end-- = '\0';

        // Check for modifiers
        if (_stricmp(token, "CommandOrControl") == 0 ||
            _stricmp(token, "Control") == 0 ||
            _stricmp(token, "Ctrl") == 0 ||
            _stricmp(token, "CmdOrCtrl") == 0) {
            g_requireCtrl = TRUE;
        } else if (_stricmp(token, "Alt") == 0 ||
                   _stricmp(token, "Option") == 0) {
            g_requireAlt = TRUE;
        } else if (_stricmp(token, "Shift") == 0) {
            g_requireShift = TRUE;
        } else if (_stricmp(token, "Super") == 0 ||
                   _stricmp(token, "Meta") == 0 ||
                   _stricmp(token, "Win") == 0 ||
                   _stricmp(token, "Command") == 0 ||
                   _stricmp(token, "Cmd") == 0) {
            // Windows key
            g_requireWin = TRUE;
        } else {
            // This should be the main key
            mainKeyVk = ParseKeyCode(token);
        }

        token = strtok(NULL, "+");
    }

    return mainKeyVk;
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        fprintf(stderr, "Usage: %s <key>|--capture\n", argv[0]);
        fprintf(stderr, "Examples:\n");
        fprintf(stderr, "  %s --capture                 (hotkey capture mode)\n", argv[0]);
        fprintf(stderr, "  %s `                        (backtick)\n", argv[0]);
        fprintf(stderr, "  %s F8                       (function key F1-F12)\n", argv[0]);
        fprintf(stderr, "  %s F13                      (extended function key F13-F24)\n", argv[0]);
        fprintf(stderr, "  %s CommandOrControl+F11     (with modifier)\n", argv[0]);
        fprintf(stderr, "  %s Ctrl+Shift+Space         (multiple modifiers)\n", argv[0]);
        return 1;
    }

    if (_stricmp(argv[1], "--capture") == 0) {
        g_captureMode = TRUE;
        fprintf(stderr, "Capture mode enabled\n");
    } else {
        g_targetVk = ParseCompoundHotkey(argv[1]);
        if (g_targetVk == 0 && (g_requireCtrl || g_requireAlt || g_requireShift || g_requireWin)) {
            g_useModifiersOnly = TRUE;
        }

        if (g_targetVk == 0 && !g_useModifiersOnly) {
            fprintf(stderr, "Error: Invalid key '%s'\n", argv[1]);
            return 1;
        }

        fprintf(stderr, "Listening for: %s (VK=0x%02X, Ctrl=%d, Alt=%d, Shift=%d, Win=%d, ModOnly=%d)\n",
                argv[1], g_targetVk, g_requireCtrl, g_requireAlt, g_requireShift, g_requireWin, g_useModifiersOnly);
    }

    // Set up console handler for clean shutdown
    SetConsoleCtrlHandler(ConsoleHandler, TRUE);

    // Install the low-level keyboard hook
    g_hook = SetWindowsHookEx(WH_KEYBOARD_LL, LowLevelKeyboardProc, NULL, 0);
    if (!g_hook) {
        fprintf(stderr, "Error: Failed to install keyboard hook (error %lu)\n", GetLastError());
        return 1;
    }

    // Signal that we're ready
    printf("READY\n");
    fflush(stdout);

    // Message loop - required for low-level hooks to work
    MSG msg;
    while (GetMessage(&msg, NULL, 0, 0) > 0) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }

    UnhookWindowsHookEx(g_hook);
    return 0;
}
