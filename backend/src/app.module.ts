import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

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
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
