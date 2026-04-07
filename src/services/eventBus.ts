import { EventEmitter } from 'events';

export enum EventName {
  PRIMARY_REQUEST = 'PRIMARY_REQUEST',
  HEDGE_REQUEST = 'HEDGE_REQUEST',
  EXIT_REQUEST = 'EXIT_REQUEST',
  TP_ADJUST_REQUEST = 'TP_ADJUST_REQUEST',
  EXECUTION_COMPLETED = 'EXECUTION_COMPLETED',
  EXECUTION_FAILED = 'EXECUTION_FAILED'
}

export interface EventPayload {
  symbol: string;
  action: string;
  params: any;
  timestamp: number;
}

class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    this.setMaxListeners(50);
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public emitEvent(name: EventName, payload: any) {
    this.emit(name, {
      ...payload,
      timestamp: Date.now()
    });
  }
}

export const eventBus = EventBus.getInstance();
