import type { ProjectConfig } from "@/features/configurator/types";
import type { PluginFile } from "@/features/plugins/generator";

export const getTypeOrmDriver = (engine: string | null) =>
  engine === "MySQL" ? "mysql" : "postgres";

export const generateDatabaseFiles = (config: ProjectConfig): PluginFile[] => {
  if (!config.database) return [];

  const files: PluginFile[] = [];
  const databaseFolder = config.framework === "NestJS" ? "src/database" : "src/config";

  if (config.database === "TypeORM") {
    const type = getTypeOrmDriver(config.databaseEngine);
    files.push({
      path: `${databaseFolder}/data-source.ts`,
      content: `import 'reflect-metadata';
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: '${type}',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/**/*.{entity,model}{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: process.env.NODE_ENV === 'development' && process.env.DB_SYNCHRONIZE === 'true',
});`,
    });
  }

  if (config.database === "TypeORM" && config.migrationsEnabled) {
    files.push({
      path: `${databaseFolder}/migrations/0001-create-users.ts`,
      content: `import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateUsers0001 implements MigrationInterface {
  async up(queryRunner: QueryRunner) {
    await queryRunner.createTable(new Table({
      name: 'users',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', isGenerated: true },
        { name: 'email', type: 'varchar', isUnique: true },
        { name: 'name', type: 'varchar' },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
    }));
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.dropTable('users');
  }
}`,
    });
  }

  if (config.seedEnabled) {
    files.push({
      path: `${databaseFolder}/seed.ts`,
      content: config.database === "Mongoose"
        ? `import mongoose from 'mongoose';

async function seed() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/synthetix');
  await mongoose.connection.collection('users').updateOne(
    { email: 'admin@example.com' },
    { $set: { name: 'Admin', role: 'admin' } },
    { upsert: true }
  );
  await mongoose.disconnect();
}

seed().catch((error) => { console.error(error); process.exit(1); });`
        : `import { AppDataSource } from './data-source';

async function seed() {
  await AppDataSource.initialize();
  await AppDataSource.query(
    ${config.databaseEngine === "MySQL"
      ? "'INSERT IGNORE INTO users (email, name) VALUES (?, ?)'"
      : "'INSERT INTO users (email, name) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING'"},
    ['admin@example.com', 'Admin']
  );
  await AppDataSource.destroy();
}

seed().catch((error) => { console.error(error); process.exit(1); });`,
    });
  }

  return files;
};
