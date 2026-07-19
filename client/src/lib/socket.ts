"use client";

import { io, type Socket } from "socket.io-client";
import { env } from "./env";
import { getStoredToken } from "./axios";

/**
 * Socket.io client factory for real-time features
 * (live captions, speech streaming, group discussion, chat).
 *
 * Replace `NEXT_PUBLIC_SOCKET_URL` in `.env.local` with your socket server.
 */

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(env.socketUrl, {
      autoConnect: false,
      transports: ["websocket"],
      auth: () => {
        const token = getStoredToken();
        return token ? { token } : {};
      },
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  if (socket && socket.connected) socket.disconnect();
}
