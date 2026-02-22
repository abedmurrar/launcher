import type { Socket } from "socket.io";

/**
 * Singleton: shared Socket.IO client set and log subscribers per process.
 */
class WsBroadcastSingleton {
  private static instance: WsBroadcastSingleton | null = null;

  readonly clients = new Set<Socket>();
  readonly logSubscribers = new Map<number, Set<Socket>>();

  private constructor() {}

  static getInstance(): WsBroadcastSingleton {
    if (WsBroadcastSingleton.instance === null) {
      WsBroadcastSingleton.instance = new WsBroadcastSingleton();
    }
    return WsBroadcastSingleton.instance;
  }
}

const state = WsBroadcastSingleton.getInstance();
export const clients = state.clients;
export const logSubscribers = state.logSubscribers;
