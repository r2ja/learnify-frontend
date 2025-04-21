import { PrismaClient } from '@prisma/client';

// Prevent multiple instances of Prisma Client in development
declare global {
  var prisma: PrismaClient | undefined;
}

// Create Prisma client with better logging
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: [
      { level: 'query' },
      { level: 'error' },
      { level: 'info' },
      { level: 'warn' },
    ],
    errorFormat: 'pretty',
  });
};

// Use global variable to avoid multiple connections in development
export const db = globalThis.prisma || prismaClientSingleton();

// Only assign to the global object in development
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = db;
}

// Initialize database connection with retry logic
const initializeDatabase = async (retries = 5) => {
  let currentTry = 0;
  
  while (currentTry < retries) {
    try {
      await db.$connect();
      console.log('✅ Database connection established successfully');
      return;
    } catch (error) {
      currentTry++;
      console.error(`❌ Database connection attempt ${currentTry}/${retries} failed:`, error);
      
      if (currentTry >= retries) {
        console.error('❌ All database connection attempts failed');
        break;
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, currentTry), 10000);
      console.log(`Retrying connection in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Initialize the database
initializeDatabase()
  .catch(error => {
    console.error('Failed to initialize database:', error);
  }); 