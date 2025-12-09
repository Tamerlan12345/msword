import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      username: process.env.DB_USER || 'admin',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'cic_docflow',
      entities: [], // We will add entities later
      synchronize: false, // We use schema.sql manually
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'frontend', 'build'),
      exclude: ['/api/(.*)'],
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
