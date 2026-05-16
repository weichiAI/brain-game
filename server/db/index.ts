import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import { DataSource, type DataSourceOptions } from "typeorm";
import { MessageEntity } from "../models/entities/message.entity";

declare global {
  var __appDataSource: Promise<DataSource> | undefined;
  var __appDataSourceKey: string | undefined;
}

const DEFAULT_DATABASE_FILE = "./.data/app.db";

type DatabaseConfig =
  | {
      type: "sqlite";
      databaseFilePath: string;
    }
  | {
      type: "postgres";
      databaseUrl: string;
    };

export class DatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

function resolveDatabaseConfig(): DatabaseConfig {
  const databaseType = process.env.DB_TYPE?.trim().toLowerCase() || "sqlite";

  if (databaseType === "sqlite") {
    const configuredPath = process.env.DATABASE_FILE?.trim();
    const databaseFilePath = path.resolve(
      process.cwd(),
      configuredPath && configuredPath.length > 0 ? configuredPath : DEFAULT_DATABASE_FILE,
    );

    fs.mkdirSync(path.dirname(databaseFilePath), { recursive: true });

    return {
      type: "sqlite",
      databaseFilePath,
    };
  }

  if (databaseType === "postgres") {
    const databaseUrl = process.env.DATABASE_URL?.trim();

    if (!databaseUrl) {
      throw new DatabaseConfigurationError(
        "DATABASE_URL 未设置：当 DB_TYPE=postgres 时，请在 .env.local 中配置 Postgres 连接串。",
      );
    }

    return {
      type: "postgres",
      databaseUrl,
    };
  }

  throw new DatabaseConfigurationError(
    `无效 DB_TYPE=${JSON.stringify(process.env.DB_TYPE)}，仅支持 sqlite 或 postgres。`,
  );
}

const databaseConfig = resolveDatabaseConfig();
const dataSourceKey =
  databaseConfig.type === "sqlite"
    ? `sqlite:${databaseConfig.databaseFilePath}`
    : `postgres:${databaseConfig.databaseUrl}`;

function createDataSourceOptions(): DataSourceOptions {
  const entities = [MessageEntity];
  const baseOptions = {
    entities,
    synchronize: true,
    logging: false,
  };

  if (databaseConfig.type === "sqlite") {
    return {
      ...baseOptions,
      type: "better-sqlite3",
      database: databaseConfig.databaseFilePath,
    };
  }

  return {
    ...baseOptions,
    type: "postgres",
    url: databaseConfig.databaseUrl,
  };
}

async function initializeDataSource() {
  const dataSource = new DataSource(createDataSourceOptions());
  return dataSource.initialize();
}

export function getDataSource() {
  if (globalThis.__appDataSourceKey !== dataSourceKey) {
    globalThis.__appDataSource = undefined;
    globalThis.__appDataSourceKey = dataSourceKey;
  }

  if (!globalThis.__appDataSource) {
    globalThis.__appDataSource = initializeDataSource().catch((error) => {
      globalThis.__appDataSource = undefined;
      throw error;
    });
  }

  return globalThis.__appDataSource;
}

export function getDatabaseReadHelpMessage() {
  if (databaseConfig.type === "sqlite") {
    const relativePath =
      path.relative(process.cwd(), databaseConfig.databaseFilePath) ||
      path.basename(databaseConfig.databaseFilePath);

    return `请确认 SQLite 数据库路径可写（${relativePath}）。`;
  }

  return "请确认已设置 DATABASE_URL，并且 Postgres 服务可连接。";
}
