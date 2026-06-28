// Minimal ambient shim — `ws` ships no bundled types and we only use it as a
// WebSocket polyfill for the y-websocket client in Node route handlers.
declare module 'ws';
