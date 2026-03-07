export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

export class Logger {
  private static formatMessage(level: LogLevel, message: string, context?: any): string {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level}] ${message}`;
    
    if (context) {
      if (context instanceof Error) {
        logMessage += `\nStack: ${context.stack}`;
        if ((context as any).response) {
            logMessage += `\nResponse Status: ${(context as any).response.status}`;
            logMessage += `\nResponse Data: ${JSON.stringify((context as any).response.data)}`;
        }
      } else {
        logMessage += ` ${JSON.stringify(context)}`;
      }
    }
    
    return logMessage;
  }

  static info(message: string, context?: any) {
    console.log(this.formatMessage(LogLevel.INFO, message, context));
  }

  static warn(message: string, context?: any) {
    console.warn(this.formatMessage(LogLevel.WARN, message, context));
  }

  static error(message: string, context?: any) {
    console.error(this.formatMessage(LogLevel.ERROR, message, context));
  }

  static debug(message: string, context?: any) {
    if (process.env.DEBUG === 'true') {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, context));
    }
  }
}
