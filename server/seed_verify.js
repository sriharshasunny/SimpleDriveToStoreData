const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Checking database...');
    const files = await prisma.file.findMany();
    const folders = await prisma.folder.findMany();

    console.log(`Found ${files.length} files and ${folders.length} folders.`);

    if (files.length > 0) {
        console.log('Sample File:', files[0]);
    }
    if (folders.length > 0) {
        console.log('Sample Folder:', folders[0]);
    }

    // Check for null isTrashed/isStarred
    const potentiallyBroken = files.filter(f => f.isTrashed === null || f.isStarred === null);
    if (potentiallyBroken.length > 0) {
        console.log('WARNING: Found files with NULL flags:', potentiallyBroken.length);
        // Fix them
        console.log('Fixing NULL flags...');
        await prisma.file.updateMany({
            where: { isTrashed: null },
            data: { isTrashed: false }
        });
        await prisma.file.updateMany({
            where: { isStarred: null },
            data: { isStarred: false }
        });
    }

    // Seed if empty
    if (files.length === 0 && folders.length === 0) {
        console.log('Database empty. Seeding sample data...');

        const folder = await prisma.folder.create({
            data: {
                name: 'Documents',
                isStarred: true
            }
        });
        console.log('Created folder:', folder);

        await prisma.file.create({
            data: {
                name: 'Project Plan.txt',
                size: 1024,
                type: 'text/plain',
                path: 'dummy_path.txt', // Won't be viewable but will show in list
                folderId: folder.id,
                isStarred: false
            }
        });

        await prisma.file.create({
            data: {
                name: 'Welcome.txt',
                size: 2048,
                type: 'text/plain',
                path: 'dummy_path_2.txt',
                isStarred: true
            }
        });

        console.log('Seeded data.');
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
