/**
 * Global type definitions for Discord Rich Presence Browser Extension
 */

declare namespace DiscordRPC {
  interface Activity {
    details?: string;
    state?: string;
    startTimestamp?: number;
    endTimestamp?: number;
    largeImageKey?: string;
    largeImageText?: string;
    smallImageKey?: string;
    smallImageText?: string;
    instance?: boolean;
    buttons?: ActivityButton[];
  }

  interface ActivityButton {
    label: string;
    url: string;
  }

  interface User {
    id: string;
    username: string;
    discriminator: string;
    avatar?: string;
  }

  interface Client {
    user?: User;
    destroy(): Promise<void>;
    login(options: { clientId: string }): Promise<void>;
    setActivity(activity: Activity): Promise<void>;
    clearActivity(): Promise<void>;
    on(event: 'ready' | 'disconnected' | 'error', callback: (...args: any[]) => void): void;
  }
}

declare namespace Extension {
  interface AppConfig {
    name: string;
    details?: string;
    state?: string;
    largeImageKey?: string;
    largeImageText?: string;
    smallImageKey?: string;
    smallImageText?: string;
    clientId?: string;
    enabled?: boolean;
  }

  interface StorageData {
    apps?: Record<string, AppConfig>;
  }

  interface NativeMessage {
    type: 'ping' | 'setActivity' | 'clearActivity' | 'getStats';
    activity?: DiscordRPC.Activity;
    clientId?: string;
  }

  interface NativeResponse {
    type: 'pong' | 'connected' | 'error' | 'activitySet' | 'activityCleared' | 'stats';
    error?: string;
    user?: DiscordRPC.User;
    success?: boolean;
    stats?: any;
    timestamp?: number;
  }

  interface RuntimeMessage {
    type: 'getCurrentTab' | 'updateActivity' | 'testConnection' | 'clearActivity' | 'pageVisible' | 'titleChanged';
    url?: string;
    title?: string;
  }

  interface RuntimeResponse {
    success: boolean;
    error?: string;
    tab?: chrome.tabs.Tab;
  }
}

declare namespace Chrome {
  interface Tab extends chrome.tabs.Tab {
    // Ensure proper typing for tabs
  }

  interface Storage {
    sync: {
      get(keys: string[] | string): Promise<any>;
      set(data: Record<string, any>): Promise<void>;
    };
  }
}

// Extend Window interface for popup context
declare interface Window {
  chrome: typeof chrome;
}

// Module declarations for Node.js modules used in native host
declare module 'discord-rpc' {
  export default class Client implements DiscordRPC.Client {
    constructor(options: { transport: 'ipc' | 'websocket' });
    user?: DiscordRPC.User;
    destroy(): Promise<void>;
    login(options: { clientId: string }): Promise<void>;
    setActivity(activity: DiscordRPC.Activity): Promise<void>;
    clearActivity(): Promise<void>;
    on(event: 'ready' | 'disconnected' | 'error', callback: (...args: any[]) => void): void;
  }
}

// Type utilities
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
type Required<T, K extends keyof T> = T & { [P in K]-?: T[P] };

// Error types
interface ExtensionError extends Error {
  code?: string;
  context?: any;
}