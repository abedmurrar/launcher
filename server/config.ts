export const dev = process.env.NODE_ENV !== "production";
export const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
/** Socket.IO path (same URL as before for compatibility). */
export const SOCKET_IO_PATH = "/ws";
