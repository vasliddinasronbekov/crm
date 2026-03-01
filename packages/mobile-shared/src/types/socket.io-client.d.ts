declare module 'socket.io-client' {
  export interface Socket {
    connected: boolean;
    on(event: string, callback: (...args: any[]) => void): void;
    off(event: string, callback?: (...args: any[]) => void): void;
    emit(event: string, payload?: any): void;
    disconnect(): void;
  }

  export function io(url: string, options?: Record<string, any>): Socket;
}
