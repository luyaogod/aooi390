import pino from 'pino';
import pretty from 'pino-pretty';
import * as fs from 'fs';
import * as path from 'path';
import { pathManager } from './paths';

const logsDir = pathManager.getLogsPath();

// 确保日志目录存在
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFilePath = path.join(logsDir, 'app.log');
const isDev = process.env.NODE_ENV === 'development';

const fileDest = pino.destination({ dest: logFilePath, mkdir: true });

let logger: pino.Logger;

if (isDev) {
  logger = pino(
    {
      level: 'debug',
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.multistream([
      {
        stream: pretty({
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        }),
        level: 'debug',
      },
      { stream: fileDest, level: 'debug' },
    ])
  );
} else {
  logger = pino(
    {
      level: 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    fileDest
  );
}

export default logger;
