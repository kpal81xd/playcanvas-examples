const ABSOLUTE_URL = new RegExp('^' +
// beginning of the url
'\\s*' +
// ignore leading spaces (some browsers trim the url automatically, but we can't assume that)
'(?:' +
// beginning of a non-captured regex group
// `{protocol}://`
'(?:' +
// beginning of protocol scheme (non-captured regex group)
'[a-z]+[a-z0-9\\-\\+\\.]*' +
// protocol scheme must (RFC 3986) consist of "a letter and followed by any combination of letters, digits, plus ("+"), period ("."), or hyphen ("-")."
':' +
// protocol scheme must end with colon character
')?' +
// end of optional scheme group, the group is optional since the string may be a protocol-relative absolute URL
'//' +
// an absolute url must always begin with two forward slash characters (ignoring any leading spaces and protocol scheme)

'|' +
// or another option(s):

// Data URL (RFC 2397), simplified
'data:' +
// Blob data
'|blob:' + ')', 'i' // non case-sensitive flag
);

/**
 * Asset type name for animation.
 *
 * @type {string}
 * @category Asset
 */
const ASSET_ANIMATION = 'animation';

/**
 * Asset type name for audio.
 *
 * @type {string}
 * @category Asset
 */
const ASSET_AUDIO = 'audio';

/**
 * Asset type name for image.
 *
 * @type {string}
 * @category Asset
 */
const ASSET_IMAGE = 'image';

/**
 * Asset type name for json.
 *
 * @type {string}
 * @category Asset
 */
const ASSET_JSON = 'json';

/**
 * Asset type name for model.
 *
 * @type {string}
 * @category Asset
 */
const ASSET_MODEL = 'model';

/**
 * Asset type name for material.
 *
 * @type {string}
 * @category Asset
 */
const ASSET_MATERIAL = 'material';

/**
 * Asset type name for text.
 *
 * @type {string}
 * @category Asset
 */
const ASSET_TEXT = 'text';

/**
 * Asset type name for texture.
 *
 * @type {string}
 * @category Asset
 */
const ASSET_TEXTURE = 'texture';

/**
 * Asset type name for textureatlas.
 *
 * @type {string}
 * @category Asset
 */
const ASSET_TEXTUREATLAS = 'textureatlas';

/**
 * Asset type name for cubemap.
 *
 * @type {string}
 * @category Asset
 */
const ASSET_CUBEMAP = 'cubemap';

/**
 * Asset type name for shader.
 *
 * @type {string}
 * @category Asset
 */
const ASSET_SHADER = 'shader';

/**
 * Asset type name for CSS.
 *
 * @type {string}
 * @category Asset
 */
const ASSET_CSS = 'css';

/**
 * Asset type name for HTML.
 *
 * @type {string}
 * @category Asset
 */
const ASSET_HTML = 'html';

/**
 * Asset type name for script.
 *
 * @type {string}
 * @category Asset
 */
const ASSET_SCRIPT = 'script';

/**
 * Asset type name for a container.
 *
 * @type {string}
 * @category Asset
 */
const ASSET_CONTAINER = 'container';

export { ABSOLUTE_URL, ASSET_ANIMATION, ASSET_AUDIO, ASSET_CONTAINER, ASSET_CSS, ASSET_CUBEMAP, ASSET_HTML, ASSET_IMAGE, ASSET_JSON, ASSET_MATERIAL, ASSET_MODEL, ASSET_SCRIPT, ASSET_SHADER, ASSET_TEXT, ASSET_TEXTURE, ASSET_TEXTUREATLAS };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2Fzc2V0L2NvbnN0YW50cy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgY29uc3QgQUJTT0xVVEVfVVJMID0gbmV3IFJlZ0V4cChcbiAgICAnXicgKyAvLyBiZWdpbm5pbmcgb2YgdGhlIHVybFxuICAgICdcXFxccyonICsgIC8vIGlnbm9yZSBsZWFkaW5nIHNwYWNlcyAoc29tZSBicm93c2VycyB0cmltIHRoZSB1cmwgYXV0b21hdGljYWxseSwgYnV0IHdlIGNhbid0IGFzc3VtZSB0aGF0KVxuICAgICcoPzonICsgIC8vIGJlZ2lubmluZyBvZiBhIG5vbi1jYXB0dXJlZCByZWdleCBncm91cFxuICAgICAgICAvLyBge3Byb3RvY29sfTovL2BcbiAgICAgICAgJyg/OicgKyAgLy8gYmVnaW5uaW5nIG9mIHByb3RvY29sIHNjaGVtZSAobm9uLWNhcHR1cmVkIHJlZ2V4IGdyb3VwKVxuICAgICAgICAgICAgJ1thLXpdK1thLXowLTlcXFxcLVxcXFwrXFxcXC5dKicgKyAvLyBwcm90b2NvbCBzY2hlbWUgbXVzdCAoUkZDIDM5ODYpIGNvbnNpc3Qgb2YgXCJhIGxldHRlciBhbmQgZm9sbG93ZWQgYnkgYW55IGNvbWJpbmF0aW9uIG9mIGxldHRlcnMsIGRpZ2l0cywgcGx1cyAoXCIrXCIpLCBwZXJpb2QgKFwiLlwiKSwgb3IgaHlwaGVuIChcIi1cIikuXCJcbiAgICAgICAgICAgICc6JyArIC8vIHByb3RvY29sIHNjaGVtZSBtdXN0IGVuZCB3aXRoIGNvbG9uIGNoYXJhY3RlclxuICAgICAgICAnKT8nICsgLy8gZW5kIG9mIG9wdGlvbmFsIHNjaGVtZSBncm91cCwgdGhlIGdyb3VwIGlzIG9wdGlvbmFsIHNpbmNlIHRoZSBzdHJpbmcgbWF5IGJlIGEgcHJvdG9jb2wtcmVsYXRpdmUgYWJzb2x1dGUgVVJMXG4gICAgICAgICcvLycgKyAvLyBhbiBhYnNvbHV0ZSB1cmwgbXVzdCBhbHdheXMgYmVnaW4gd2l0aCB0d28gZm9yd2FyZCBzbGFzaCBjaGFyYWN0ZXJzIChpZ25vcmluZyBhbnkgbGVhZGluZyBzcGFjZXMgYW5kIHByb3RvY29sIHNjaGVtZSlcblxuICAgICAgICAnfCcgKyAvLyBvciBhbm90aGVyIG9wdGlvbihzKTpcblxuICAgICAgICAvLyBEYXRhIFVSTCAoUkZDIDIzOTcpLCBzaW1wbGlmaWVkXG4gICAgICAgICdkYXRhOicgK1xuXG4gICAgICAgIC8vIEJsb2IgZGF0YVxuICAgICAgICAnfGJsb2I6JyArXG4gICAgJyknLFxuICAgICdpJyAvLyBub24gY2FzZS1zZW5zaXRpdmUgZmxhZ1xuKTtcblxuLyoqXG4gKiBBc3NldCB0eXBlIG5hbWUgZm9yIGFuaW1hdGlvbi5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEFzc2V0XG4gKi9cbmV4cG9ydCBjb25zdCBBU1NFVF9BTklNQVRJT04gPSAnYW5pbWF0aW9uJztcblxuLyoqXG4gKiBBc3NldCB0eXBlIG5hbWUgZm9yIGF1ZGlvLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgQXNzZXRcbiAqL1xuZXhwb3J0IGNvbnN0IEFTU0VUX0FVRElPID0gJ2F1ZGlvJztcblxuLyoqXG4gKiBBc3NldCB0eXBlIG5hbWUgZm9yIGltYWdlLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgQXNzZXRcbiAqL1xuZXhwb3J0IGNvbnN0IEFTU0VUX0lNQUdFID0gJ2ltYWdlJztcblxuLyoqXG4gKiBBc3NldCB0eXBlIG5hbWUgZm9yIGpzb24uXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBBc3NldFxuICovXG5leHBvcnQgY29uc3QgQVNTRVRfSlNPTiA9ICdqc29uJztcblxuLyoqXG4gKiBBc3NldCB0eXBlIG5hbWUgZm9yIG1vZGVsLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgQXNzZXRcbiAqL1xuZXhwb3J0IGNvbnN0IEFTU0VUX01PREVMID0gJ21vZGVsJztcblxuLyoqXG4gKiBBc3NldCB0eXBlIG5hbWUgZm9yIG1hdGVyaWFsLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgQXNzZXRcbiAqL1xuZXhwb3J0IGNvbnN0IEFTU0VUX01BVEVSSUFMID0gJ21hdGVyaWFsJztcblxuLyoqXG4gKiBBc3NldCB0eXBlIG5hbWUgZm9yIHRleHQuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBBc3NldFxuICovXG5leHBvcnQgY29uc3QgQVNTRVRfVEVYVCA9ICd0ZXh0JztcblxuLyoqXG4gKiBBc3NldCB0eXBlIG5hbWUgZm9yIHRleHR1cmUuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBBc3NldFxuICovXG5leHBvcnQgY29uc3QgQVNTRVRfVEVYVFVSRSA9ICd0ZXh0dXJlJztcblxuLyoqXG4gKiBBc3NldCB0eXBlIG5hbWUgZm9yIHRleHR1cmVhdGxhcy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEFzc2V0XG4gKi9cbmV4cG9ydCBjb25zdCBBU1NFVF9URVhUVVJFQVRMQVMgPSAndGV4dHVyZWF0bGFzJztcblxuLyoqXG4gKiBBc3NldCB0eXBlIG5hbWUgZm9yIGN1YmVtYXAuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBBc3NldFxuICovXG5leHBvcnQgY29uc3QgQVNTRVRfQ1VCRU1BUCA9ICdjdWJlbWFwJztcblxuLyoqXG4gKiBBc3NldCB0eXBlIG5hbWUgZm9yIHNoYWRlci5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEFzc2V0XG4gKi9cbmV4cG9ydCBjb25zdCBBU1NFVF9TSEFERVIgPSAnc2hhZGVyJztcblxuLyoqXG4gKiBBc3NldCB0eXBlIG5hbWUgZm9yIENTUy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEFzc2V0XG4gKi9cbmV4cG9ydCBjb25zdCBBU1NFVF9DU1MgPSAnY3NzJztcblxuLyoqXG4gKiBBc3NldCB0eXBlIG5hbWUgZm9yIEhUTUwuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBjYXRlZ29yeSBBc3NldFxuICovXG5leHBvcnQgY29uc3QgQVNTRVRfSFRNTCA9ICdodG1sJztcblxuLyoqXG4gKiBBc3NldCB0eXBlIG5hbWUgZm9yIHNjcmlwdC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQGNhdGVnb3J5IEFzc2V0XG4gKi9cbmV4cG9ydCBjb25zdCBBU1NFVF9TQ1JJUFQgPSAnc2NyaXB0JztcblxuLyoqXG4gKiBBc3NldCB0eXBlIG5hbWUgZm9yIGEgY29udGFpbmVyLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAY2F0ZWdvcnkgQXNzZXRcbiAqL1xuZXhwb3J0IGNvbnN0IEFTU0VUX0NPTlRBSU5FUiA9ICdjb250YWluZXInO1xuIl0sIm5hbWVzIjpbIkFCU09MVVRFX1VSTCIsIlJlZ0V4cCIsIkFTU0VUX0FOSU1BVElPTiIsIkFTU0VUX0FVRElPIiwiQVNTRVRfSU1BR0UiLCJBU1NFVF9KU09OIiwiQVNTRVRfTU9ERUwiLCJBU1NFVF9NQVRFUklBTCIsIkFTU0VUX1RFWFQiLCJBU1NFVF9URVhUVVJFIiwiQVNTRVRfVEVYVFVSRUFUTEFTIiwiQVNTRVRfQ1VCRU1BUCIsIkFTU0VUX1NIQURFUiIsIkFTU0VUX0NTUyIsIkFTU0VUX0hUTUwiLCJBU1NFVF9TQ1JJUFQiLCJBU1NFVF9DT05UQUlORVIiXSwibWFwcGluZ3MiOiJNQUFhQSxZQUFZLEdBQUcsSUFBSUMsTUFBTSxDQUNsQyxHQUFHO0FBQUc7QUFDTixNQUFNO0FBQUk7QUFDVixLQUFLO0FBQUk7QUFDTDtBQUNBLEtBQUs7QUFBSTtBQUNMLDBCQUEwQjtBQUFHO0FBQzdCLEdBQUc7QUFBRztBQUNWLElBQUk7QUFBRztBQUNQLElBQUk7QUFBRzs7QUFFUCxHQUFHO0FBQUc7O0FBRU47QUFDQSxPQUFPO0FBRVA7QUFDQSxRQUFRLEdBQ1osR0FBRyxFQUNILEdBQUc7QUFDUCxFQUFDOztBQUVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGVBQWUsR0FBRyxZQUFXOztBQUUxQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxXQUFXLEdBQUcsUUFBTzs7QUFFbEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsV0FBVyxHQUFHLFFBQU87O0FBRWxDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFVBQVUsR0FBRyxPQUFNOztBQUVoQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxXQUFXLEdBQUcsUUFBTzs7QUFFbEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsY0FBYyxHQUFHLFdBQVU7O0FBRXhDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFVBQVUsR0FBRyxPQUFNOztBQUVoQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxhQUFhLEdBQUcsVUFBUzs7QUFFdEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsa0JBQWtCLEdBQUcsZUFBYzs7QUFFaEQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsYUFBYSxHQUFHLFVBQVM7O0FBRXRDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFlBQVksR0FBRyxTQUFROztBQUVwQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxTQUFTLEdBQUcsTUFBSzs7QUFFOUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsVUFBVSxHQUFHLE9BQU07O0FBRWhDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFlBQVksR0FBRyxTQUFROztBQUVwQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxlQUFlLEdBQUc7Ozs7In0=
