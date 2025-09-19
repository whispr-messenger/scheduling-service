// Enums pour remplacer ceux de Prisma (SQLite ne supporte pas les enums)

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ScheduleType {
  CRON = 'CRON',
  INTERVAL = 'INTERVAL',
  ONCE = 'ONCE',
  IMMEDIATE = 'IMMEDIATE',
}

export enum ExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  TIMEOUT = 'TIMEOUT',
}

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

export enum DependencyType {
  SUCCESS = 'SUCCESS',
  COMPLETION = 'COMPLETION',
  FAILURE = 'FAILURE',
}

// Types utilitaires
export type PriorityType = keyof typeof Priority;
export type ScheduleTypeType = keyof typeof ScheduleType;
export type ExecutionStatusType = keyof typeof ExecutionStatus;
export type LogLevelType = keyof typeof LogLevel;
export type DependencyTypeType = keyof typeof DependencyType;