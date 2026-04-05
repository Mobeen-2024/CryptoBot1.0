import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  ERROR: LogLevel.ERROR,
  WARN: LogLevel.WARN,
  INFO: LogLevel.INFO,
  DEBUG: LogLevel.DEBUG,
};

const currentLevel: LogLevel = LOG_LEVEL_MAP[process.env.LOG_LEVEL?.toUpperCase() || 'INFO'] ?? LogLevel.INFO;
const JSON_MODE = process.env.LOG_FORMAT === 'json';

// Ensure log directory exists
const LOG_DIR = path.join(process.cwd(), 'logs');
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}
const LOG_FILE = path.join(LOG_DIR, 'cryptobot.log');
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

const activeTimers = new Map<string, number>();

function levelName(level: LogLevel): string {
  return ['ERROR', 'WARN', 'INFO', 'DEBUG'][level] || 'INFO';
}

function formatContext(context?: any): string {
  if (!context) return '';
  if (context instanceof Error) {
    let msg = `\nStack: ${context.stack}`;
    if ((context as any).response) {
      msg += `\nResponse Status: ${(context as any).response.status}`;
      msg += `\nResponse Data: ${JSON.stringify((context as any).response.data)}`;
    }
    return msg;
  }
  return ` ${JSON.stringify(context)}`;
}

function emit(level: LogLevel, message: string, context?: any) {
  if (level > currentLevel) return;

  const timestamp = new Date().toISOString();
  const name = levelName(level);

  if (JSON_MODE) {
    const entry = {
      ts: timestamp,
      level: name,
      msg: message,
      ...(context instanceof Error
        ? { error: context.message, stack: context.stack }
        : context ? { data: context } : {}),
    };
    const json = JSON.stringify(entry);
    logStream.write(json + '\n');
    if (level <= LogLevel.WARN) process.stderr.write(json + '\n');
    else process.stdout.write(json + '\n');
    return;
  }

  const text = `[${timestamp}] [${name}] ${message}${formatContext(context)}`;
  logStream.write(text + '\n');

  switch (level) {
    case LogLevel.ERROR: console.error(text); break;
    case LogLevel.WARN:  console.warn(text);  break;
    case LogLevel.DEBUG: console.debug(text);  break;
    default:             console.log(text);    break;
  }
}

export class Logger {
  static info(message: string, context?: any)  { emit(LogLevel.INFO,  message, context); }
  static warn(message: string, context?: any)  { emit(LogLevel.WARN,  message, context); }
  static error(message: string, context?: any) { emit(LogLevel.ERROR, message, context); }
  static debug(message: string, context?: any) { emit(LogLevel.DEBUG, message, context); }

  /** Start a named performance timer */
  static time(label: string) {
    activeTimers.set(label, performance.now());
  }

  /** End a named performance timer and log the duration */
  static timeEnd(label: string) {
    const start = activeTimers.get(label);
    if (start === undefined) {
      emit(LogLevel.WARN, `Logger.timeEnd('${label}') called without matching Logger.time()`);
      return;
    }
    const duration = (performance.now() - start).toFixed(2);
    activeTimers.delete(label);
    emit(LogLevel.INFO, `⏱ ${label}: ${duration}ms`);
  }

  /** Flush and close the log stream (for graceful shutdown) */
  static close() {
    logStream.end();
  }
}
