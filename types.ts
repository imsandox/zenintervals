
export interface SessionConfig {
  durationMinutes: number;
  reminderCount: number;
  isRandom: boolean;
}

export enum SessionStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  FINISHED = 'FINISHED'
}

export interface ReminderPoint {
  timeMs: number;
  triggered: boolean;
}
