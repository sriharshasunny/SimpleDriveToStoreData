require('dotenv').config();
const { PrismaClient } = require('./node_modules/.prisma/client');

console.log('DATABASE_URL:', process.env.DATABASE_URL);

async function main() {
    try {
        const prisma = new PrismaClient();
        await prisma.$connect();
        console.log('Successfully connected to database');
        await prisma.$disconnect();
    } catch (e) {
        console.error('Connection failed!');
        console.error('Error Name:', e.name);
        console.error('Error Message:', e.message);
        if (e.meta) console.error('Error Meta:', e.meta);
    }
}

main();
