import http from 'http';
import { app } from './app';
import { env } from './config/env';
import { connectDB, disconnectDB } from './lib/db';
import { connectRedis, disconnectRedis } from './lib/redis';

const server = http.createServer(app);

async function startServer() {
  try {
    console.log('🔄 Connecting to MongoDB and Redis...');
    await connectDB();
    await connectRedis();
    console.log('✅ MongoDB & Redis connected successfully.');

    server.listen(env.BACKEND_PORT, env.BACKEND_HOST, () => {
      console.log(
        `🚀 PRAVAAH Backend API is listening at http://${env.BACKEND_HOST}:${env.BACKEND_PORT}/api/v1`
      );
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    console.log('🔌 HTTP server closed.');
    await disconnectDB();
    await disconnectRedis();
    console.log('👋 Database and Redis connections closed. Exiting process.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { server };
