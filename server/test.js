const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const folders = await prisma.folder.findMany();
    console.log('Folders OK:', folders.length);
    const agg = await prisma.file.aggregate({ _sum: { size: true } });
    console.log('Agg OK:', agg);
  } catch(e) {
    console.error('Test Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
