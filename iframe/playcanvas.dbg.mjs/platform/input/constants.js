const ACTION_MOUSE = 'mouse';
const ACTION_KEYBOARD = 'keyboard';
const ACTION_GAMEPAD = 'gamepad';
const AXIS_MOUSE_X = 'mousex';
const AXIS_MOUSE_Y = 'mousey';
const AXIS_PAD_L_X = 'padlx';
const AXIS_PAD_L_Y = 'padly';
const AXIS_PAD_R_X = 'padrx';
const AXIS_PAD_R_Y = 'padry';
const AXIS_KEY = 'key';

/**
 * Name of event fired when a key is pressed.
 *
 * @type {string}
 * @category Input
 */
const EVENT_KEYDOWN = 'keydown';

/**
 * Name of event fired when a key is released.
 *
 * @type {string}
 * @category Input
 */
const EVENT_KEYUP = 'keyup';

/**
 * Name of event fired when a mouse button is pressed.
 *
 * @type {string}
 * @category Input
 */
const EVENT_MOUSEDOWN = 'mousedown';

/**
 * Name of event fired when the mouse is moved.
 *
 * @type {string}
 * @category Input
 */
const EVENT_MOUSEMOVE = 'mousemove';

/**
 * Name of event fired when a mouse button is released.
 *
 * @type {string}
 * @category Input
 */
const EVENT_MOUSEUP = 'mouseup';

/**
 * Name of event fired when the mouse wheel is rotated.
 *
 * @type {string}
 * @category Input
 */
const EVENT_MOUSEWHEEL = 'mousewheel';

/**
 * Name of event fired when a new touch occurs. For example, a finger is placed on the device.
 *
 * @type {string}
 * @category Input
 */
const EVENT_TOUCHSTART = 'touchstart';

/**
 * Name of event fired when touch ends. For example, a finger is lifted off the device.
 *
 * @type {string}
 * @category Input
 */
const EVENT_TOUCHEND = 'touchend';

/**
 * Name of event fired when a touch moves.
 *
 * @type {string}
 * @category Input
 */
const EVENT_TOUCHMOVE = 'touchmove';

/**
 * Name of event fired when a touch point is interrupted in some way. The exact reasons for
 * canceling a touch can vary from device to device. For example, a modal alert pops up during the
 * interaction; the touch point leaves the document area, or there are more touch points than the
 * device supports, in which case the earliest touch point is canceled.
 *
 * @type {string}
 * @category Input
 */
const EVENT_TOUCHCANCEL = 'touchcancel';

/**
 * Name of event fired when a new xr select occurs. For example, primary trigger was pressed.
 *
 * @type {string}
 * @category Input
 */
const EVENT_SELECT = 'select';

/**
 * Name of event fired when a new xr select starts. For example, primary trigger is now pressed.
 *
 * @type {string}
 * @category Input
 */
const EVENT_SELECTSTART = 'selectstart';

/**
 * Name of event fired when xr select ends. For example, a primary trigger is now released.
 *
 * @type {string}
 * @category Input
 */
const EVENT_SELECTEND = 'selectend';

/**
 * @type {number}
 * @category Input
 */
const KEY_BACKSPACE = 8;

/**
 * @type {number}
 * @category Input
 */
const KEY_TAB = 9;

/**
 * @type {number}
 * @category Input
 */
const KEY_RETURN = 13;

/**
 * @type {number}
 * @category Input
 */
const KEY_ENTER = 13;

/**
 * @type {number}
 * @category Input
 */
const KEY_SHIFT = 16;

/**
 * @type {number}
 * @category Input
 */
const KEY_CONTROL = 17;

/**
 * @type {number}
 * @category Input
 */
const KEY_ALT = 18;

/**
 * @type {number}
 * @category Input
 */
const KEY_PAUSE = 19;

/**
 * @type {number}
 * @category Input
 */
const KEY_CAPS_LOCK = 20;

/**
 * @type {number}
 * @category Input
 */
const KEY_ESCAPE = 27;

/**
 * @type {number}
 * @category Input
 */
const KEY_SPACE = 32;

/**
 * @type {number}
 * @category Input
 */
const KEY_PAGE_UP = 33;

/**
 * @type {number}
 * @category Input
 */
const KEY_PAGE_DOWN = 34;

/**
 * @type {number}
 * @category Input
 */
const KEY_END = 35;

/**
 * @type {number}
 * @category Input
 */
const KEY_HOME = 36;

/**
 * @type {number}
 * @category Input
 */
const KEY_LEFT = 37;

/**
 * @type {number}
 * @category Input
 */
const KEY_UP = 38;

/**
 * @type {number}
 * @category Input
 */
const KEY_RIGHT = 39;

/**
 * @type {number}
 * @category Input
 */
const KEY_DOWN = 40;

/**
 * @type {number}
 * @category Input
 */
const KEY_PRINT_SCREEN = 44;

/**
 * @type {number}
 * @category Input
 */
const KEY_INSERT = 45;

/**
 * @type {number}
 * @category Input
 */
const KEY_DELETE = 46;

/**
 * @type {number}
 * @category Input
 */
const KEY_0 = 48;

/**
 * @type {number}
 * @category Input
 */
const KEY_1 = 49;

/**
 * @type {number}
 * @category Input
 */
const KEY_2 = 50;

/**
 * @type {number}
 * @category Input
 */
const KEY_3 = 51;

/**
 * @type {number}
 * @category Input
 */
const KEY_4 = 52;

/**
 * @type {number}
 * @category Input
 */
const KEY_5 = 53;

/**
 * @type {number}
 * @category Input
 */
const KEY_6 = 54;

/**
 * @type {number}
 * @category Input
 */
const KEY_7 = 55;

/**
 * @type {number}
 * @category Input
 */
const KEY_8 = 56;

/**
 * @type {number}
 * @category Input
 */
const KEY_9 = 57;

/**
 * @type {number}
 * @category Input
 */
const KEY_SEMICOLON = 59;

/**
 * @type {number}
 * @category Input
 */
const KEY_EQUAL = 61;

/**
 * @type {number}
 * @category Input
 */
const KEY_A = 65;

/**
 * @type {number}
 * @category Input
 */
const KEY_B = 66;

/**
 * @type {number}
 * @category Input
 */
const KEY_C = 67;

/**
 * @type {number}
 * @category Input
 */
const KEY_D = 68;

/**
 * @type {number}
 * @category Input
 */
const KEY_E = 69;

/**
 * @type {number}
 * @category Input
 */
const KEY_F = 70;

/**
 * @type {number}
 * @category Input
 */
const KEY_G = 71;

/**
 * @type {number}
 * @category Input
 */
const KEY_H = 72;

/**
 * @type {number}
 * @category Input
 */
const KEY_I = 73;

/**
 * @type {number}
 * @category Input
 */
const KEY_J = 74;

/**
 * @type {number}
 * @category Input
 */
const KEY_K = 75;

/**
 * @type {number}
 * @category Input
 */
const KEY_L = 76;

/**
 * @type {number}
 * @category Input
 */
const KEY_M = 77;

/**
 * @type {number}
 * @category Input
 */
const KEY_N = 78;

/**
 * @type {number}
 * @category Input
 */
const KEY_O = 79;

/**
 * @type {number}
 * @category Input
 */
const KEY_P = 80;

/**
 * @type {number}
 * @category Input
 */
const KEY_Q = 81;

/**
 * @type {number}
 * @category Input
 */
const KEY_R = 82;

/**
 * @type {number}
 * @category Input
 */
const KEY_S = 83;

/**
 * @type {number}
 * @category Input
 */
const KEY_T = 84;

/**
 * @type {number}
 * @category Input
 */
const KEY_U = 85;

/**
 * @type {number}
 * @category Input
 */
const KEY_V = 86;

/**
 * @type {number}
 * @category Input
 */
const KEY_W = 87;

/**
 * @type {number}
 * @category Input
 */
const KEY_X = 88;

/**
 * @type {number}
 * @category Input
 */
const KEY_Y = 89;

/**
 * @type {number}
 * @category Input
 */
const KEY_Z = 90;

/**
 * @type {number}
 * @category Input
 */
const KEY_WINDOWS = 91;

/**
 * @type {number}
 * @category Input
 */
const KEY_CONTEXT_MENU = 93;

/**
 * @type {number}
 * @category Input
 */
const KEY_NUMPAD_0 = 96;

/**
 * @type {number}
 * @category Input
 */
const KEY_NUMPAD_1 = 97;

/**
 * @type {number}
 * @category Input
 */
const KEY_NUMPAD_2 = 98;

/**
 * @type {number}
 * @category Input
 */
const KEY_NUMPAD_3 = 99;

/**
 * @type {number}
 * @category Input
 */
const KEY_NUMPAD_4 = 100;

/**
 * @type {number}
 * @category Input
 */
const KEY_NUMPAD_5 = 101;

/**
 * @type {number}
 * @category Input
 */
const KEY_NUMPAD_6 = 102;

/**
 * @type {number}
 * @category Input
 */
const KEY_NUMPAD_7 = 103;

/**
 * @type {number}
 * @category Input
 */
const KEY_NUMPAD_8 = 104;

/**
 * @type {number}
 * @category Input
 */
const KEY_NUMPAD_9 = 105;

/**
 * @type {number}
 * @category Input
 */
const KEY_MULTIPLY = 106;

/**
 * @type {number}
 * @category Input
 */
const KEY_ADD = 107;

/**
 * @type {number}
 * @category Input
 */
const KEY_SEPARATOR = 108;

/**
 * @type {number}
 * @category Input
 */
const KEY_SUBTRACT = 109;

/**
 * @type {number}
 * @category Input
 */
const KEY_DECIMAL = 110;

/**
 * @type {number}
 * @category Input
 */
const KEY_DIVIDE = 111;

/**
 * @type {number}
 * @category Input
 */
const KEY_F1 = 112;

/**
 * @type {number}
 * @category Input
 */
const KEY_F2 = 113;

/**
 * @type {number}
 * @category Input
 */
const KEY_F3 = 114;

/**
 * @type {number}
 * @category Input
 */
const KEY_F4 = 115;

/**
 * @type {number}
 * @category Input
 */
const KEY_F5 = 116;

/**
 * @type {number}
 * @category Input
 */
const KEY_F6 = 117;

/**
 * @type {number}
 * @category Input
 */
const KEY_F7 = 118;

/**
 * @type {number}
 * @category Input
 */
const KEY_F8 = 119;

/**
 * @type {number}
 * @category Input
 */
const KEY_F9 = 120;

/**
 * @type {number}
 * @category Input
 */
const KEY_F10 = 121;

/**
 * @type {number}
 * @category Input
 */
const KEY_F11 = 122;

/**
 * @type {number}
 * @category Input
 */
const KEY_F12 = 123;

/**
 * @type {number}
 * @category Input
 */
const KEY_COMMA = 188;

/**
 * @type {number}
 * @category Input
 */
const KEY_PERIOD = 190;

/**
 * @type {number}
 * @category Input
 */
const KEY_SLASH = 191;

/**
 * @type {number}
 * @category Input
 */
const KEY_OPEN_BRACKET = 219;

/**
 * @type {number}
 * @category Input
 */
const KEY_BACK_SLASH = 220;

/**
 * @type {number}
 * @category Input
 */
const KEY_CLOSE_BRACKET = 221;

/**
 * @type {number}
 * @category Input
 */
const KEY_META = 224;

/**
 * No mouse buttons pressed.
 *
 * @type {number}
 * @category Input
 */
const MOUSEBUTTON_NONE = -1;

/**
 * The left mouse button.
 *
 * @type {number}
 * @category Input
 */
const MOUSEBUTTON_LEFT = 0;

/**
 * The middle mouse button.
 *
 * @type {number}
 * @category Input
 */
const MOUSEBUTTON_MIDDLE = 1;

/**
 * The right mouse button.
 *
 * @type {number}
 * @category Input
 */
const MOUSEBUTTON_RIGHT = 2;

/**
 * Index for pad 1.
 *
 * @type {number}
 * @category Input
 */
const PAD_1 = 0;

/**
 * Index for pad 2.
 *
 * @type {number}
 * @category Input
 */
const PAD_2 = 1;

/**
 * Index for pad 3.
 *
 * @type {number}
 * @category Input
 */
const PAD_3 = 2;

/**
 * Index for pad 4.
 *
 * @type {number}
 * @category Input
 */
const PAD_4 = 3;

/**
 * The first face button, from bottom going clockwise.
 *
 * @type {number}
 * @category Input
 */
const PAD_FACE_1 = 0;

/**
 * The second face button, from bottom going clockwise.
 *
 * @type {number}
 * @category Input
 */
const PAD_FACE_2 = 1;

/**
 * The third face button, from bottom going clockwise.
 *
 * @type {number}
 * @category Input
 */
const PAD_FACE_3 = 2;

/**
 * The fourth face button, from bottom going clockwise.
 *
 * @type {number}
 * @category Input
 */
const PAD_FACE_4 = 3;

/**
 * The first shoulder button on the left.
 *
 * @type {number}
 * @category Input
 */
const PAD_L_SHOULDER_1 = 4;

/**
 * The first shoulder button on the right.
 *
 * @type {number}
 * @category Input
 */
const PAD_R_SHOULDER_1 = 5;

/**
 * The second shoulder button on the left.
 *
 * @type {number}
 * @category Input
 */
const PAD_L_SHOULDER_2 = 6;

/**
 * The second shoulder button on the right.
 *
 * @type {number}
 * @category Input
 */
const PAD_R_SHOULDER_2 = 7;

/**
 * The select button.
 *
 * @type {number}
 * @category Input
 */
const PAD_SELECT = 8;

/**
 * The start button.
 *
 * @type {number}
 * @category Input
 */
const PAD_START = 9;

/**
 * The button when depressing the left analogue stick.
 *
 * @type {number}
 * @category Input
 */
const PAD_L_STICK_BUTTON = 10;

/**
 * The button when depressing the right analogue stick.
 *
 * @type {number}
 * @category Input
 */
const PAD_R_STICK_BUTTON = 11;

/**
 * Direction pad up.
 *
 * @type {number}
 * @category Input
 */
const PAD_UP = 12;

/**
 * Direction pad down.
 *
 * @type {number}
 * @category Input
 */
const PAD_DOWN = 13;

/**
 * Direction pad left.
 *
 * @type {number}
 * @category Input
 */
const PAD_LEFT = 14;

/**
 * Direction pad right.
 *
 * @type {number}
 * @category Input
 */
const PAD_RIGHT = 15;

/**
 * Vendor specific button.
 *
 * @type {number}
 * @category Input
 */
const PAD_VENDOR = 16;

/**
 * Horizontal axis on the left analogue stick.
 *
 * @type {number}
 * @category Input
 */
const PAD_L_STICK_X = 0;

/**
 * Vertical axis on the left analogue stick.
 *
 * @type {number}
 * @category Input
 */
const PAD_L_STICK_Y = 1;

/**
 * Horizontal axis on the right analogue stick.
 *
 * @type {number}
 * @category Input
 */
const PAD_R_STICK_X = 2;

/**
 * Vertical axis on the right analogue stick.
 *
 * @type {number}
 * @category Input
 */
const PAD_R_STICK_Y = 3;

/**
 * Name of event fired when a gamepad connects.
 *
 * @type {string}
 * @category Input
 */
const EVENT_GAMEPADCONNECTED = 'gamepadconnected';

/**
 * Name of event fired when a gamepad disconnects.
 *
 * @type {string}
 * @category Input
 */
const EVENT_GAMEPADDISCONNECTED = 'gamepaddisconnected';

/**
 * Horizontal axis on the touchpad of a XR pad.
 *
 * @type {number}
 * @category Input
 */
const XRPAD_TOUCHPAD_X = 0;

/**
 * Vertical axis on the thouchpad of a XR pad.
 *
 * @type {number}
 * @category Input
 */
const XRPAD_TOUCHPAD_Y = 1;

/**
 * Horizontal axis on the stick of a XR pad.
 *
 * @type {number}
 * @category Input
 */
const XRPAD_STICK_X = 2;

/**
 * Vertical axis on the stick of a XR pad.
 *
 * @type {number}
 * @category Input
 */
const XRPAD_STICK_Y = 3;

/**
 * The button when pressing the XR pad's touchpad.
 *
 * @type {number}
 * @category Input
 */
const XRPAD_TOUCHPAD_BUTTON = 2;

/**
 * The trigger button from XR pad.
 *
 * @type {number}
 * @category Input
 */
const XRPAD_TRIGGER = 0;

/**
 * The squeeze button from XR pad.
 *
 * @type {number}
 * @category Input
 */
const XRPAD_SQUEEZE = 1;

/**
 * The button when pressing the XR pad's stick.
 *
 * @type {number}
 * @category Input
 */
const XRPAD_STICK_BUTTON = 3;

/**
 * The A button from XR pad.
 *
 * @type {number}
 * @category Input
 */
const XRPAD_A = 4;

/**
 * The B button from XR pad.
 *
 * @type {number}
 * @category Input
 */
const XRPAD_B = 5;

export { ACTION_GAMEPAD, ACTION_KEYBOARD, ACTION_MOUSE, AXIS_KEY, AXIS_MOUSE_X, AXIS_MOUSE_Y, AXIS_PAD_L_X, AXIS_PAD_L_Y, AXIS_PAD_R_X, AXIS_PAD_R_Y, EVENT_GAMEPADCONNECTED, EVENT_GAMEPADDISCONNECTED, EVENT_KEYDOWN, EVENT_KEYUP, EVENT_MOUSEDOWN, EVENT_MOUSEMOVE, EVENT_MOUSEUP, EVENT_MOUSEWHEEL, EVENT_SELECT, EVENT_SELECTEND, EVENT_SELECTSTART, EVENT_TOUCHCANCEL, EVENT_TOUCHEND, EVENT_TOUCHMOVE, EVENT_TOUCHSTART, KEY_0, KEY_1, KEY_2, KEY_3, KEY_4, KEY_5, KEY_6, KEY_7, KEY_8, KEY_9, KEY_A, KEY_ADD, KEY_ALT, KEY_B, KEY_BACKSPACE, KEY_BACK_SLASH, KEY_C, KEY_CAPS_LOCK, KEY_CLOSE_BRACKET, KEY_COMMA, KEY_CONTEXT_MENU, KEY_CONTROL, KEY_D, KEY_DECIMAL, KEY_DELETE, KEY_DIVIDE, KEY_DOWN, KEY_E, KEY_END, KEY_ENTER, KEY_EQUAL, KEY_ESCAPE, KEY_F, KEY_F1, KEY_F10, KEY_F11, KEY_F12, KEY_F2, KEY_F3, KEY_F4, KEY_F5, KEY_F6, KEY_F7, KEY_F8, KEY_F9, KEY_G, KEY_H, KEY_HOME, KEY_I, KEY_INSERT, KEY_J, KEY_K, KEY_L, KEY_LEFT, KEY_M, KEY_META, KEY_MULTIPLY, KEY_N, KEY_NUMPAD_0, KEY_NUMPAD_1, KEY_NUMPAD_2, KEY_NUMPAD_3, KEY_NUMPAD_4, KEY_NUMPAD_5, KEY_NUMPAD_6, KEY_NUMPAD_7, KEY_NUMPAD_8, KEY_NUMPAD_9, KEY_O, KEY_OPEN_BRACKET, KEY_P, KEY_PAGE_DOWN, KEY_PAGE_UP, KEY_PAUSE, KEY_PERIOD, KEY_PRINT_SCREEN, KEY_Q, KEY_R, KEY_RETURN, KEY_RIGHT, KEY_S, KEY_SEMICOLON, KEY_SEPARATOR, KEY_SHIFT, KEY_SLASH, KEY_SPACE, KEY_SUBTRACT, KEY_T, KEY_TAB, KEY_U, KEY_UP, KEY_V, KEY_W, KEY_WINDOWS, KEY_X, KEY_Y, KEY_Z, MOUSEBUTTON_LEFT, MOUSEBUTTON_MIDDLE, MOUSEBUTTON_NONE, MOUSEBUTTON_RIGHT, PAD_1, PAD_2, PAD_3, PAD_4, PAD_DOWN, PAD_FACE_1, PAD_FACE_2, PAD_FACE_3, PAD_FACE_4, PAD_LEFT, PAD_L_SHOULDER_1, PAD_L_SHOULDER_2, PAD_L_STICK_BUTTON, PAD_L_STICK_X, PAD_L_STICK_Y, PAD_RIGHT, PAD_R_SHOULDER_1, PAD_R_SHOULDER_2, PAD_R_STICK_BUTTON, PAD_R_STICK_X, PAD_R_STICK_Y, PAD_SELECT, PAD_START, PAD_UP, PAD_VENDOR, XRPAD_A, XRPAD_B, XRPAD_SQUEEZE, XRPAD_STICK_BUTTON, XRPAD_STICK_X, XRPAD_STICK_Y, XRPAD_TOUCHPAD_BUTTON, XRPAD_TOUCHPAD_X, XRPAD_TOUCHPAD_Y, XRPAD_TRIGGER };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vaW5wdXQvY29uc3RhbnRzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBjb25zdCBBQ1RJT05fTU9VU0UgPSAnbW91c2UnO1xuZXhwb3J0IGNvbnN0IEFDVElPTl9LRVlCT0FSRCA9ICdrZXlib2FyZCc7XG5leHBvcnQgY29uc3QgQUNUSU9OX0dBTUVQQUQgPSAnZ2FtZXBhZCc7XG5cbmV4cG9ydCBjb25zdCBBWElTX01PVVNFX1ggPSAnbW91c2V4JztcbmV4cG9ydCBjb25zdCBBWElTX01PVVNFX1kgPSAnbW91c2V5JztcbmV4cG9ydCBjb25zdCBBWElTX1BBRF9MX1ggPSAncGFkbHgnO1xuZXhwb3J0IGNvbnN0IEFYSVNfUEFEX0xfWSA9ICdwYWRseSc7XG5leHBvcnQgY29uc3QgQVhJU19QQURfUl9YID0gJ3BhZHJ4JztcbmV4cG9ydCBjb25zdCBBWElTX1BBRF9SX1kgPSAncGFkcnknO1xuZXhwb3J0IGNvbnN0IEFYSVNfS0VZID0gJ2tleSc7XG5cbi8qKlxuICogTmFtZSBvZiBldmVudCBmaXJlZCB3aGVuIGEga2V5IGlzIHByZXNzZWQuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgRVZFTlRfS0VZRE9XTiA9ICdrZXlkb3duJztcblxuLyoqXG4gKiBOYW1lIG9mIGV2ZW50IGZpcmVkIHdoZW4gYSBrZXkgaXMgcmVsZWFzZWQuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgRVZFTlRfS0VZVVAgPSAna2V5dXAnO1xuXG4vKipcbiAqIE5hbWUgb2YgZXZlbnQgZmlyZWQgd2hlbiBhIG1vdXNlIGJ1dHRvbiBpcyBwcmVzc2VkLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEVWRU5UX01PVVNFRE9XTiA9ICdtb3VzZWRvd24nO1xuXG4vKipcbiAqIE5hbWUgb2YgZXZlbnQgZmlyZWQgd2hlbiB0aGUgbW91c2UgaXMgbW92ZWQuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgRVZFTlRfTU9VU0VNT1ZFID0gJ21vdXNlbW92ZSc7XG5cbi8qKlxuICogTmFtZSBvZiBldmVudCBmaXJlZCB3aGVuIGEgbW91c2UgYnV0dG9uIGlzIHJlbGVhc2VkLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEVWRU5UX01PVVNFVVAgPSAnbW91c2V1cCc7XG5cbi8qKlxuICogTmFtZSBvZiBldmVudCBmaXJlZCB3aGVuIHRoZSBtb3VzZSB3aGVlbCBpcyByb3RhdGVkLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEVWRU5UX01PVVNFV0hFRUwgPSAnbW91c2V3aGVlbCc7XG5cbi8qKlxuICogTmFtZSBvZiBldmVudCBmaXJlZCB3aGVuIGEgbmV3IHRvdWNoIG9jY3Vycy4gRm9yIGV4YW1wbGUsIGEgZmluZ2VyIGlzIHBsYWNlZCBvbiB0aGUgZGV2aWNlLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEVWRU5UX1RPVUNIU1RBUlQgPSAndG91Y2hzdGFydCc7XG5cbi8qKlxuICogTmFtZSBvZiBldmVudCBmaXJlZCB3aGVuIHRvdWNoIGVuZHMuIEZvciBleGFtcGxlLCBhIGZpbmdlciBpcyBsaWZ0ZWQgb2ZmIHRoZSBkZXZpY2UuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgRVZFTlRfVE9VQ0hFTkQgPSAndG91Y2hlbmQnO1xuXG4vKipcbiAqIE5hbWUgb2YgZXZlbnQgZmlyZWQgd2hlbiBhIHRvdWNoIG1vdmVzLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEVWRU5UX1RPVUNITU9WRSA9ICd0b3VjaG1vdmUnO1xuXG4vKipcbiAqIE5hbWUgb2YgZXZlbnQgZmlyZWQgd2hlbiBhIHRvdWNoIHBvaW50IGlzIGludGVycnVwdGVkIGluIHNvbWUgd2F5LiBUaGUgZXhhY3QgcmVhc29ucyBmb3JcbiAqIGNhbmNlbGluZyBhIHRvdWNoIGNhbiB2YXJ5IGZyb20gZGV2aWNlIHRvIGRldmljZS4gRm9yIGV4YW1wbGUsIGEgbW9kYWwgYWxlcnQgcG9wcyB1cCBkdXJpbmcgdGhlXG4gKiBpbnRlcmFjdGlvbjsgdGhlIHRvdWNoIHBvaW50IGxlYXZlcyB0aGUgZG9jdW1lbnQgYXJlYSwgb3IgdGhlcmUgYXJlIG1vcmUgdG91Y2ggcG9pbnRzIHRoYW4gdGhlXG4gKiBkZXZpY2Ugc3VwcG9ydHMsIGluIHdoaWNoIGNhc2UgdGhlIGVhcmxpZXN0IHRvdWNoIHBvaW50IGlzIGNhbmNlbGVkLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEVWRU5UX1RPVUNIQ0FOQ0VMID0gJ3RvdWNoY2FuY2VsJztcblxuLyoqXG4gKiBOYW1lIG9mIGV2ZW50IGZpcmVkIHdoZW4gYSBuZXcgeHIgc2VsZWN0IG9jY3Vycy4gRm9yIGV4YW1wbGUsIHByaW1hcnkgdHJpZ2dlciB3YXMgcHJlc3NlZC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBFVkVOVF9TRUxFQ1QgPSAnc2VsZWN0JztcblxuLyoqXG4gKiBOYW1lIG9mIGV2ZW50IGZpcmVkIHdoZW4gYSBuZXcgeHIgc2VsZWN0IHN0YXJ0cy4gRm9yIGV4YW1wbGUsIHByaW1hcnkgdHJpZ2dlciBpcyBub3cgcHJlc3NlZC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBFVkVOVF9TRUxFQ1RTVEFSVCA9ICdzZWxlY3RzdGFydCc7XG5cbi8qKlxuICogTmFtZSBvZiBldmVudCBmaXJlZCB3aGVuIHhyIHNlbGVjdCBlbmRzLiBGb3IgZXhhbXBsZSwgYSBwcmltYXJ5IHRyaWdnZXIgaXMgbm93IHJlbGVhc2VkLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEVWRU5UX1NFTEVDVEVORCA9ICdzZWxlY3RlbmQnO1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9CQUNLU1BBQ0UgPSA4O1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9UQUIgPSA5O1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9SRVRVUk4gPSAxMztcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfRU5URVIgPSAxMztcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfU0hJRlQgPSAxNjtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfQ09OVFJPTCA9IDE3O1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9BTFQgPSAxODtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfUEFVU0UgPSAxOTtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfQ0FQU19MT0NLID0gMjA7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX0VTQ0FQRSA9IDI3O1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9TUEFDRSA9IDMyO1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9QQUdFX1VQID0gMzM7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX1BBR0VfRE9XTiA9IDM0O1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9FTkQgPSAzNTtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfSE9NRSA9IDM2O1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9MRUZUID0gMzc7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX1VQID0gMzg7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX1JJR0hUID0gMzk7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX0RPV04gPSA0MDtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfUFJJTlRfU0NSRUVOID0gNDQ7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX0lOU0VSVCA9IDQ1O1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9ERUxFVEUgPSA0NjtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfMCA9IDQ4O1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV8xID0gNDk7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZXzIgPSA1MDtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfMyA9IDUxO1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV80ID0gNTI7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZXzUgPSA1MztcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfNiA9IDU0O1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV83ID0gNTU7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZXzggPSA1NjtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfOSA9IDU3O1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9TRU1JQ09MT04gPSA1OTtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfRVFVQUwgPSA2MTtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfQSA9IDY1O1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9CID0gNjY7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX0MgPSA2NztcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfRCA9IDY4O1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9FID0gNjk7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX0YgPSA3MDtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfRyA9IDcxO1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9IID0gNzI7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX0kgPSA3MztcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfSiA9IDc0O1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9LID0gNzU7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX0wgPSA3NjtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfTSA9IDc3O1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9OID0gNzg7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX08gPSA3OTtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfUCA9IDgwO1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9RID0gODE7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX1IgPSA4MjtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfUyA9IDgzO1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9UID0gODQ7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX1UgPSA4NTtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfViA9IDg2O1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9XID0gODc7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX1ggPSA4ODtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfWSA9IDg5O1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9aID0gOTA7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX1dJTkRPV1MgPSA5MTtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfQ09OVEVYVF9NRU5VID0gOTM7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX05VTVBBRF8wID0gOTY7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX05VTVBBRF8xID0gOTc7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX05VTVBBRF8yID0gOTg7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX05VTVBBRF8zID0gOTk7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX05VTVBBRF80ID0gMTAwO1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9OVU1QQURfNSA9IDEwMTtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfTlVNUEFEXzYgPSAxMDI7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX05VTVBBRF83ID0gMTAzO1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9OVU1QQURfOCA9IDEwNDtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfTlVNUEFEXzkgPSAxMDU7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX01VTFRJUExZID0gMTA2O1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9BREQgPSAxMDc7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX1NFUEFSQVRPUiA9IDEwODtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfU1VCVFJBQ1QgPSAxMDk7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX0RFQ0lNQUwgPSAxMTA7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX0RJVklERSA9IDExMTtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfRjEgPSAxMTI7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX0YyID0gMTEzO1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9GMyA9IDExNDtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfRjQgPSAxMTU7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX0Y1ID0gMTE2O1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9GNiA9IDExNztcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfRjcgPSAxMTg7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX0Y4ID0gMTE5O1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9GOSA9IDEyMDtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfRjEwID0gMTIxO1xuXG4vKipcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEtFWV9GMTEgPSAxMjI7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX0YxMiA9IDEyMztcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfQ09NTUEgPSAxODg7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX1BFUklPRCA9IDE5MDtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfU0xBU0ggPSAxOTE7XG5cbi8qKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgS0VZX09QRU5fQlJBQ0tFVCA9IDIxOTtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfQkFDS19TTEFTSCA9IDIyMDtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfQ0xPU0VfQlJBQ0tFVCA9IDIyMTtcblxuLyoqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBLRVlfTUVUQSA9IDIyNDtcblxuLyoqXG4gKiBObyBtb3VzZSBidXR0b25zIHByZXNzZWQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgTU9VU0VCVVRUT05fTk9ORSA9IC0xO1xuXG4vKipcbiAqIFRoZSBsZWZ0IG1vdXNlIGJ1dHRvbi5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBNT1VTRUJVVFRPTl9MRUZUID0gMDtcblxuLyoqXG4gKiBUaGUgbWlkZGxlIG1vdXNlIGJ1dHRvbi5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBNT1VTRUJVVFRPTl9NSURETEUgPSAxO1xuXG4vKipcbiAqIFRoZSByaWdodCBtb3VzZSBidXR0b24uXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgTU9VU0VCVVRUT05fUklHSFQgPSAyO1xuXG4vKipcbiAqIEluZGV4IGZvciBwYWQgMS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBQQURfMSA9IDA7XG5cbi8qKlxuICogSW5kZXggZm9yIHBhZCAyLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IFBBRF8yID0gMTtcblxuLyoqXG4gKiBJbmRleCBmb3IgcGFkIDMuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgUEFEXzMgPSAyO1xuXG4vKipcbiAqIEluZGV4IGZvciBwYWQgNC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBQQURfNCA9IDM7XG5cbi8qKlxuICogVGhlIGZpcnN0IGZhY2UgYnV0dG9uLCBmcm9tIGJvdHRvbSBnb2luZyBjbG9ja3dpc2UuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgUEFEX0ZBQ0VfMSA9IDA7XG5cbi8qKlxuICogVGhlIHNlY29uZCBmYWNlIGJ1dHRvbiwgZnJvbSBib3R0b20gZ29pbmcgY2xvY2t3aXNlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IFBBRF9GQUNFXzIgPSAxO1xuXG4vKipcbiAqIFRoZSB0aGlyZCBmYWNlIGJ1dHRvbiwgZnJvbSBib3R0b20gZ29pbmcgY2xvY2t3aXNlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IFBBRF9GQUNFXzMgPSAyO1xuXG4vKipcbiAqIFRoZSBmb3VydGggZmFjZSBidXR0b24sIGZyb20gYm90dG9tIGdvaW5nIGNsb2Nrd2lzZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBQQURfRkFDRV80ID0gMztcblxuLyoqXG4gKiBUaGUgZmlyc3Qgc2hvdWxkZXIgYnV0dG9uIG9uIHRoZSBsZWZ0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IFBBRF9MX1NIT1VMREVSXzEgPSA0O1xuXG4vKipcbiAqIFRoZSBmaXJzdCBzaG91bGRlciBidXR0b24gb24gdGhlIHJpZ2h0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IFBBRF9SX1NIT1VMREVSXzEgPSA1O1xuXG4vKipcbiAqIFRoZSBzZWNvbmQgc2hvdWxkZXIgYnV0dG9uIG9uIHRoZSBsZWZ0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IFBBRF9MX1NIT1VMREVSXzIgPSA2O1xuXG4vKipcbiAqIFRoZSBzZWNvbmQgc2hvdWxkZXIgYnV0dG9uIG9uIHRoZSByaWdodC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBQQURfUl9TSE9VTERFUl8yID0gNztcblxuLyoqXG4gKiBUaGUgc2VsZWN0IGJ1dHRvbi5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBQQURfU0VMRUNUID0gODtcblxuLyoqXG4gKiBUaGUgc3RhcnQgYnV0dG9uLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IFBBRF9TVEFSVCA9IDk7XG5cbi8qKlxuICogVGhlIGJ1dHRvbiB3aGVuIGRlcHJlc3NpbmcgdGhlIGxlZnQgYW5hbG9ndWUgc3RpY2suXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgUEFEX0xfU1RJQ0tfQlVUVE9OID0gMTA7XG5cbi8qKlxuICogVGhlIGJ1dHRvbiB3aGVuIGRlcHJlc3NpbmcgdGhlIHJpZ2h0IGFuYWxvZ3VlIHN0aWNrLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IFBBRF9SX1NUSUNLX0JVVFRPTiA9IDExO1xuXG4vKipcbiAqIERpcmVjdGlvbiBwYWQgdXAuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgUEFEX1VQID0gMTI7XG5cbi8qKlxuICogRGlyZWN0aW9uIHBhZCBkb3duLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IFBBRF9ET1dOID0gMTM7XG5cbi8qKlxuICogRGlyZWN0aW9uIHBhZCBsZWZ0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IFBBRF9MRUZUID0gMTQ7XG5cbi8qKlxuICogRGlyZWN0aW9uIHBhZCByaWdodC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBQQURfUklHSFQgPSAxNTtcblxuLyoqXG4gKiBWZW5kb3Igc3BlY2lmaWMgYnV0dG9uLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IFBBRF9WRU5ET1IgPSAxNjtcblxuLyoqXG4gKiBIb3Jpem9udGFsIGF4aXMgb24gdGhlIGxlZnQgYW5hbG9ndWUgc3RpY2suXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgUEFEX0xfU1RJQ0tfWCA9IDA7XG5cbi8qKlxuICogVmVydGljYWwgYXhpcyBvbiB0aGUgbGVmdCBhbmFsb2d1ZSBzdGljay5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBQQURfTF9TVElDS19ZID0gMTtcblxuLyoqXG4gKiBIb3Jpem9udGFsIGF4aXMgb24gdGhlIHJpZ2h0IGFuYWxvZ3VlIHN0aWNrLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IFBBRF9SX1NUSUNLX1ggPSAyO1xuXG4vKipcbiAqIFZlcnRpY2FsIGF4aXMgb24gdGhlIHJpZ2h0IGFuYWxvZ3VlIHN0aWNrLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IFBBRF9SX1NUSUNLX1kgPSAzO1xuXG4vKipcbiAqIE5hbWUgb2YgZXZlbnQgZmlyZWQgd2hlbiBhIGdhbWVwYWQgY29ubmVjdHMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgRVZFTlRfR0FNRVBBRENPTk5FQ1RFRCA9ICdnYW1lcGFkY29ubmVjdGVkJztcblxuLyoqXG4gKiBOYW1lIG9mIGV2ZW50IGZpcmVkIHdoZW4gYSBnYW1lcGFkIGRpc2Nvbm5lY3RzLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IEVWRU5UX0dBTUVQQURESVNDT05ORUNURUQgPSAnZ2FtZXBhZGRpc2Nvbm5lY3RlZCc7XG5cbi8qKlxuICogSG9yaXpvbnRhbCBheGlzIG9uIHRoZSB0b3VjaHBhZCBvZiBhIFhSIHBhZC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBYUlBBRF9UT1VDSFBBRF9YID0gMDtcblxuLyoqXG4gKiBWZXJ0aWNhbCBheGlzIG9uIHRoZSB0aG91Y2hwYWQgb2YgYSBYUiBwYWQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBjYXRlZ29yeSBJbnB1dFxuICovXG5leHBvcnQgY29uc3QgWFJQQURfVE9VQ0hQQURfWSA9IDE7XG5cbi8qKlxuICogSG9yaXpvbnRhbCBheGlzIG9uIHRoZSBzdGljayBvZiBhIFhSIHBhZC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBYUlBBRF9TVElDS19YID0gMjtcblxuLyoqXG4gKiBWZXJ0aWNhbCBheGlzIG9uIHRoZSBzdGljayBvZiBhIFhSIHBhZC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBYUlBBRF9TVElDS19ZID0gMztcblxuLyoqXG4gKiBUaGUgYnV0dG9uIHdoZW4gcHJlc3NpbmcgdGhlIFhSIHBhZCdzIHRvdWNocGFkLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IFhSUEFEX1RPVUNIUEFEX0JVVFRPTiA9IDI7XG5cbi8qKlxuICogVGhlIHRyaWdnZXIgYnV0dG9uIGZyb20gWFIgcGFkLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IFhSUEFEX1RSSUdHRVIgPSAwO1xuXG4vKipcbiAqIFRoZSBzcXVlZXplIGJ1dHRvbiBmcm9tIFhSIHBhZC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBYUlBBRF9TUVVFRVpFID0gMTtcblxuLyoqXG4gKiBUaGUgYnV0dG9uIHdoZW4gcHJlc3NpbmcgdGhlIFhSIHBhZCdzIHN0aWNrLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IFhSUEFEX1NUSUNLX0JVVFRPTiA9IDM7XG5cbi8qKlxuICogVGhlIEEgYnV0dG9uIGZyb20gWFIgcGFkLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAY2F0ZWdvcnkgSW5wdXRcbiAqL1xuZXhwb3J0IGNvbnN0IFhSUEFEX0EgPSA0O1xuXG4vKipcbiAqIFRoZSBCIGJ1dHRvbiBmcm9tIFhSIHBhZC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQGNhdGVnb3J5IElucHV0XG4gKi9cbmV4cG9ydCBjb25zdCBYUlBBRF9CID0gNTtcbiJdLCJuYW1lcyI6WyJBQ1RJT05fTU9VU0UiLCJBQ1RJT05fS0VZQk9BUkQiLCJBQ1RJT05fR0FNRVBBRCIsIkFYSVNfTU9VU0VfWCIsIkFYSVNfTU9VU0VfWSIsIkFYSVNfUEFEX0xfWCIsIkFYSVNfUEFEX0xfWSIsIkFYSVNfUEFEX1JfWCIsIkFYSVNfUEFEX1JfWSIsIkFYSVNfS0VZIiwiRVZFTlRfS0VZRE9XTiIsIkVWRU5UX0tFWVVQIiwiRVZFTlRfTU9VU0VET1dOIiwiRVZFTlRfTU9VU0VNT1ZFIiwiRVZFTlRfTU9VU0VVUCIsIkVWRU5UX01PVVNFV0hFRUwiLCJFVkVOVF9UT1VDSFNUQVJUIiwiRVZFTlRfVE9VQ0hFTkQiLCJFVkVOVF9UT1VDSE1PVkUiLCJFVkVOVF9UT1VDSENBTkNFTCIsIkVWRU5UX1NFTEVDVCIsIkVWRU5UX1NFTEVDVFNUQVJUIiwiRVZFTlRfU0VMRUNURU5EIiwiS0VZX0JBQ0tTUEFDRSIsIktFWV9UQUIiLCJLRVlfUkVUVVJOIiwiS0VZX0VOVEVSIiwiS0VZX1NISUZUIiwiS0VZX0NPTlRST0wiLCJLRVlfQUxUIiwiS0VZX1BBVVNFIiwiS0VZX0NBUFNfTE9DSyIsIktFWV9FU0NBUEUiLCJLRVlfU1BBQ0UiLCJLRVlfUEFHRV9VUCIsIktFWV9QQUdFX0RPV04iLCJLRVlfRU5EIiwiS0VZX0hPTUUiLCJLRVlfTEVGVCIsIktFWV9VUCIsIktFWV9SSUdIVCIsIktFWV9ET1dOIiwiS0VZX1BSSU5UX1NDUkVFTiIsIktFWV9JTlNFUlQiLCJLRVlfREVMRVRFIiwiS0VZXzAiLCJLRVlfMSIsIktFWV8yIiwiS0VZXzMiLCJLRVlfNCIsIktFWV81IiwiS0VZXzYiLCJLRVlfNyIsIktFWV84IiwiS0VZXzkiLCJLRVlfU0VNSUNPTE9OIiwiS0VZX0VRVUFMIiwiS0VZX0EiLCJLRVlfQiIsIktFWV9DIiwiS0VZX0QiLCJLRVlfRSIsIktFWV9GIiwiS0VZX0ciLCJLRVlfSCIsIktFWV9JIiwiS0VZX0oiLCJLRVlfSyIsIktFWV9MIiwiS0VZX00iLCJLRVlfTiIsIktFWV9PIiwiS0VZX1AiLCJLRVlfUSIsIktFWV9SIiwiS0VZX1MiLCJLRVlfVCIsIktFWV9VIiwiS0VZX1YiLCJLRVlfVyIsIktFWV9YIiwiS0VZX1kiLCJLRVlfWiIsIktFWV9XSU5ET1dTIiwiS0VZX0NPTlRFWFRfTUVOVSIsIktFWV9OVU1QQURfMCIsIktFWV9OVU1QQURfMSIsIktFWV9OVU1QQURfMiIsIktFWV9OVU1QQURfMyIsIktFWV9OVU1QQURfNCIsIktFWV9OVU1QQURfNSIsIktFWV9OVU1QQURfNiIsIktFWV9OVU1QQURfNyIsIktFWV9OVU1QQURfOCIsIktFWV9OVU1QQURfOSIsIktFWV9NVUxUSVBMWSIsIktFWV9BREQiLCJLRVlfU0VQQVJBVE9SIiwiS0VZX1NVQlRSQUNUIiwiS0VZX0RFQ0lNQUwiLCJLRVlfRElWSURFIiwiS0VZX0YxIiwiS0VZX0YyIiwiS0VZX0YzIiwiS0VZX0Y0IiwiS0VZX0Y1IiwiS0VZX0Y2IiwiS0VZX0Y3IiwiS0VZX0Y4IiwiS0VZX0Y5IiwiS0VZX0YxMCIsIktFWV9GMTEiLCJLRVlfRjEyIiwiS0VZX0NPTU1BIiwiS0VZX1BFUklPRCIsIktFWV9TTEFTSCIsIktFWV9PUEVOX0JSQUNLRVQiLCJLRVlfQkFDS19TTEFTSCIsIktFWV9DTE9TRV9CUkFDS0VUIiwiS0VZX01FVEEiLCJNT1VTRUJVVFRPTl9OT05FIiwiTU9VU0VCVVRUT05fTEVGVCIsIk1PVVNFQlVUVE9OX01JRERMRSIsIk1PVVNFQlVUVE9OX1JJR0hUIiwiUEFEXzEiLCJQQURfMiIsIlBBRF8zIiwiUEFEXzQiLCJQQURfRkFDRV8xIiwiUEFEX0ZBQ0VfMiIsIlBBRF9GQUNFXzMiLCJQQURfRkFDRV80IiwiUEFEX0xfU0hPVUxERVJfMSIsIlBBRF9SX1NIT1VMREVSXzEiLCJQQURfTF9TSE9VTERFUl8yIiwiUEFEX1JfU0hPVUxERVJfMiIsIlBBRF9TRUxFQ1QiLCJQQURfU1RBUlQiLCJQQURfTF9TVElDS19CVVRUT04iLCJQQURfUl9TVElDS19CVVRUT04iLCJQQURfVVAiLCJQQURfRE9XTiIsIlBBRF9MRUZUIiwiUEFEX1JJR0hUIiwiUEFEX1ZFTkRPUiIsIlBBRF9MX1NUSUNLX1giLCJQQURfTF9TVElDS19ZIiwiUEFEX1JfU1RJQ0tfWCIsIlBBRF9SX1NUSUNLX1kiLCJFVkVOVF9HQU1FUEFEQ09OTkVDVEVEIiwiRVZFTlRfR0FNRVBBRERJU0NPTk5FQ1RFRCIsIlhSUEFEX1RPVUNIUEFEX1giLCJYUlBBRF9UT1VDSFBBRF9ZIiwiWFJQQURfU1RJQ0tfWCIsIlhSUEFEX1NUSUNLX1kiLCJYUlBBRF9UT1VDSFBBRF9CVVRUT04iLCJYUlBBRF9UUklHR0VSIiwiWFJQQURfU1FVRUVaRSIsIlhSUEFEX1NUSUNLX0JVVFRPTiIsIlhSUEFEX0EiLCJYUlBBRF9CIl0sIm1hcHBpbmdzIjoiQUFBTyxNQUFNQSxZQUFZLEdBQUcsUUFBTztBQUM1QixNQUFNQyxlQUFlLEdBQUcsV0FBVTtBQUNsQyxNQUFNQyxjQUFjLEdBQUcsVUFBUztBQUVoQyxNQUFNQyxZQUFZLEdBQUcsU0FBUTtBQUM3QixNQUFNQyxZQUFZLEdBQUcsU0FBUTtBQUM3QixNQUFNQyxZQUFZLEdBQUcsUUFBTztBQUM1QixNQUFNQyxZQUFZLEdBQUcsUUFBTztBQUM1QixNQUFNQyxZQUFZLEdBQUcsUUFBTztBQUM1QixNQUFNQyxZQUFZLEdBQUcsUUFBTztBQUM1QixNQUFNQyxRQUFRLEdBQUcsTUFBSzs7QUFFN0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsYUFBYSxHQUFHLFVBQVM7O0FBRXRDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFdBQVcsR0FBRyxRQUFPOztBQUVsQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxlQUFlLEdBQUcsWUFBVzs7QUFFMUM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsZUFBZSxHQUFHLFlBQVc7O0FBRTFDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGFBQWEsR0FBRyxVQUFTOztBQUV0QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxnQkFBZ0IsR0FBRyxhQUFZOztBQUU1QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxnQkFBZ0IsR0FBRyxhQUFZOztBQUU1QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxjQUFjLEdBQUcsV0FBVTs7QUFFeEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsZUFBZSxHQUFHLFlBQVc7O0FBRTFDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGlCQUFpQixHQUFHLGNBQWE7O0FBRTlDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFlBQVksR0FBRyxTQUFROztBQUVwQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxpQkFBaUIsR0FBRyxjQUFhOztBQUU5QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxlQUFlLEdBQUcsWUFBVzs7QUFFMUM7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxhQUFhLEdBQUcsRUFBQzs7QUFFOUI7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxPQUFPLEdBQUcsRUFBQzs7QUFFeEI7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxVQUFVLEdBQUcsR0FBRTs7QUFFNUI7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxTQUFTLEdBQUcsR0FBRTs7QUFFM0I7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxTQUFTLEdBQUcsR0FBRTs7QUFFM0I7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxXQUFXLEdBQUcsR0FBRTs7QUFFN0I7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxPQUFPLEdBQUcsR0FBRTs7QUFFekI7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxTQUFTLEdBQUcsR0FBRTs7QUFFM0I7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxhQUFhLEdBQUcsR0FBRTs7QUFFL0I7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxVQUFVLEdBQUcsR0FBRTs7QUFFNUI7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxTQUFTLEdBQUcsR0FBRTs7QUFFM0I7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxXQUFXLEdBQUcsR0FBRTs7QUFFN0I7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxhQUFhLEdBQUcsR0FBRTs7QUFFL0I7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxPQUFPLEdBQUcsR0FBRTs7QUFFekI7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxRQUFRLEdBQUcsR0FBRTs7QUFFMUI7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxRQUFRLEdBQUcsR0FBRTs7QUFFMUI7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxNQUFNLEdBQUcsR0FBRTs7QUFFeEI7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxTQUFTLEdBQUcsR0FBRTs7QUFFM0I7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxRQUFRLEdBQUcsR0FBRTs7QUFFMUI7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxnQkFBZ0IsR0FBRyxHQUFFOztBQUVsQztBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFVBQVUsR0FBRyxHQUFFOztBQUU1QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFVBQVUsR0FBRyxHQUFFOztBQUU1QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGFBQWEsR0FBRyxHQUFFOztBQUUvQjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFNBQVMsR0FBRyxHQUFFOztBQUUzQjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxHQUFFOztBQUV2QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFdBQVcsR0FBRyxHQUFFOztBQUU3QjtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGdCQUFnQixHQUFHLEdBQUU7O0FBRWxDO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsWUFBWSxHQUFHLEdBQUU7O0FBRTlCO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsWUFBWSxHQUFHLEdBQUU7O0FBRTlCO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsWUFBWSxHQUFHLEdBQUU7O0FBRTlCO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsWUFBWSxHQUFHLEdBQUU7O0FBRTlCO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsWUFBWSxHQUFHLElBQUc7O0FBRS9CO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsWUFBWSxHQUFHLElBQUc7O0FBRS9CO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsWUFBWSxHQUFHLElBQUc7O0FBRS9CO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsWUFBWSxHQUFHLElBQUc7O0FBRS9CO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsWUFBWSxHQUFHLElBQUc7O0FBRS9CO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsWUFBWSxHQUFHLElBQUc7O0FBRS9CO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsWUFBWSxHQUFHLElBQUc7O0FBRS9CO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsT0FBTyxHQUFHLElBQUc7O0FBRTFCO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsYUFBYSxHQUFHLElBQUc7O0FBRWhDO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsWUFBWSxHQUFHLElBQUc7O0FBRS9CO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsV0FBVyxHQUFHLElBQUc7O0FBRTlCO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsVUFBVSxHQUFHLElBQUc7O0FBRTdCO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsTUFBTSxHQUFHLElBQUc7O0FBRXpCO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsTUFBTSxHQUFHLElBQUc7O0FBRXpCO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsTUFBTSxHQUFHLElBQUc7O0FBRXpCO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsTUFBTSxHQUFHLElBQUc7O0FBRXpCO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsTUFBTSxHQUFHLElBQUc7O0FBRXpCO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsTUFBTSxHQUFHLElBQUc7O0FBRXpCO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsTUFBTSxHQUFHLElBQUc7O0FBRXpCO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsTUFBTSxHQUFHLElBQUc7O0FBRXpCO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsTUFBTSxHQUFHLElBQUc7O0FBRXpCO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsT0FBTyxHQUFHLElBQUc7O0FBRTFCO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsT0FBTyxHQUFHLElBQUc7O0FBRTFCO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsT0FBTyxHQUFHLElBQUc7O0FBRTFCO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsU0FBUyxHQUFHLElBQUc7O0FBRTVCO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsVUFBVSxHQUFHLElBQUc7O0FBRTdCO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsU0FBUyxHQUFHLElBQUc7O0FBRTVCO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsZ0JBQWdCLEdBQUcsSUFBRzs7QUFFbkM7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxjQUFjLEdBQUcsSUFBRzs7QUFFakM7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxpQkFBaUIsR0FBRyxJQUFHOztBQUVwQztBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFFBQVEsR0FBRyxJQUFHOztBQUUzQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDYUMsTUFBQUEsZ0JBQWdCLEdBQUcsQ0FBQyxFQUFDOztBQUVsQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxnQkFBZ0IsR0FBRyxFQUFDOztBQUVqQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxrQkFBa0IsR0FBRyxFQUFDOztBQUVuQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxpQkFBaUIsR0FBRyxFQUFDOztBQUVsQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxLQUFLLEdBQUcsRUFBQzs7QUFFdEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsS0FBSyxHQUFHLEVBQUM7O0FBRXRCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLEtBQUssR0FBRyxFQUFDOztBQUV0QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxLQUFLLEdBQUcsRUFBQzs7QUFFdEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsVUFBVSxHQUFHLEVBQUM7O0FBRTNCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFVBQVUsR0FBRyxFQUFDOztBQUUzQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxVQUFVLEdBQUcsRUFBQzs7QUFFM0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsVUFBVSxHQUFHLEVBQUM7O0FBRTNCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGdCQUFnQixHQUFHLEVBQUM7O0FBRWpDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGdCQUFnQixHQUFHLEVBQUM7O0FBRWpDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGdCQUFnQixHQUFHLEVBQUM7O0FBRWpDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGdCQUFnQixHQUFHLEVBQUM7O0FBRWpDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFVBQVUsR0FBRyxFQUFDOztBQUUzQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxTQUFTLEdBQUcsRUFBQzs7QUFFMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsa0JBQWtCLEdBQUcsR0FBRTs7QUFFcEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsa0JBQWtCLEdBQUcsR0FBRTs7QUFFcEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsTUFBTSxHQUFHLEdBQUU7O0FBRXhCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFFBQVEsR0FBRyxHQUFFOztBQUUxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxRQUFRLEdBQUcsR0FBRTs7QUFFMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsU0FBUyxHQUFHLEdBQUU7O0FBRTNCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFVBQVUsR0FBRyxHQUFFOztBQUU1QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxhQUFhLEdBQUcsRUFBQzs7QUFFOUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsYUFBYSxHQUFHLEVBQUM7O0FBRTlCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGFBQWEsR0FBRyxFQUFDOztBQUU5QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxhQUFhLEdBQUcsRUFBQzs7QUFFOUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsc0JBQXNCLEdBQUcsbUJBQWtCOztBQUV4RDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyx5QkFBeUIsR0FBRyxzQkFBcUI7O0FBRTlEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGdCQUFnQixHQUFHLEVBQUM7O0FBRWpDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGdCQUFnQixHQUFHLEVBQUM7O0FBRWpDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGFBQWEsR0FBRyxFQUFDOztBQUU5QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxhQUFhLEdBQUcsRUFBQzs7QUFFOUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMscUJBQXFCLEdBQUcsRUFBQzs7QUFFdEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsYUFBYSxHQUFHLEVBQUM7O0FBRTlCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGFBQWEsR0FBRyxFQUFDOztBQUU5QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxrQkFBa0IsR0FBRyxFQUFDOztBQUVuQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxPQUFPLEdBQUcsRUFBQzs7QUFFeEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsT0FBTyxHQUFHOzs7OyJ9
