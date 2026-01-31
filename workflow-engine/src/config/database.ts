import { DataSource } from 'typeorm';
import * as path from 'path';

const databaseType = process.env.DATABASE_TYPE || 'sqlite';

export const AppDataSource = new DataSource(
  databaseType === 'sqlite'
    ? {
        type: 'sqlite',
        database: process.env.DATABASE_PATH || './workflow.db',
        synchronize: true,
        logging: process.env.NODE_ENV === 'development',
        entities: [path.join(__dirname, '../entities/**/*.{ts,js}')],
        migrations: [path.join(__dirname, '../migrations/**/*.{ts,js}')],
        subscribers: [],
      }
    : {
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USER || 'user',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'farm_equipment_loan_intake',
        synchronize: process.env.NODE_ENV === 'development',
        logging: process.env.NODE_ENV === 'development',
        entities: [path.join(__dirname, '../entities/**/*.{ts,js}')],
        migrations: [path.join(__dirname, '../migrations/**/*.{ts,js}')],
        subscribers: [],
      }
);

export const initializeDatabase = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log('Database connection established');
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
};

export const closeDatabase = async (): Promise<void> => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    console.log('Database connection closed');
  }
};
