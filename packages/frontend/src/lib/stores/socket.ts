import { writable } from 'svelte/store';
import { io, type Socket } from 'socket.io-client';
import { apiBase } from '$lib/api';

export const socketStore = writable<Socket | null>(null);

export function initSocket(token: string): Socket {
  const socket = io(apiBase.replace('/api', ''), {
    auth: { token },
    transports: ['websocket', 'polling']
  });
  socketStore.set(socket);
  return socket;
}

export function disconnectSocket(): void {
  socketStore.update(socket => {
    if (socket) {
      socket.disconnect();
    }
    return null;
  });
}

