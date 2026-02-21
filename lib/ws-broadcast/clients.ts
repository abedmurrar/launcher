import type { WebSocket } from "ws";

/**
 * Singleton: single shared WebSocket client set and log subscribers per process.
 */
class WsBroadcastSingleton {
  private static instance: WsBroadcastSingleton | null = null;

  readonly clients = new Set<WebSocket>();
  readonly logSubscribers = new Map<number, Set<WebSocket>>();

  private constructor() {}

  static getInstance(): WsBroadcastSingleton {
    if (WsBroadcastSingleton.instance === null) {
      WsBroadcastSingleton.instance = new WsBroadcastSingleton();
    }
    return WsBroadcastSingleton.instance;
  }
}

function getWsBroadcastState(): WsBroadcastSingleton {
  return WsBroadcastSingleton.getInstance();
}

export function getWsBroadcastStateInstance(): WsBroadcastSingleton {
  return getWsBroadcastState();
}

export const clients = getWsBroadcastState().clients;
export const logSubscribers = getWsBroadcastState().logSubscribers;
