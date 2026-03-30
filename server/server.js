require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Handle form data text fields if not multered? Multer handles multipart.
app.use('/uploads', express.static(UPLOADS_DIR));

app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
});

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Unique filename to prevent overwrites
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// --- API Routes ---

// 1. List Files and Folders (Directory Content)
app.get('/api/drive', async (req, res) => {
  try {
    const parentId = req.query.parentId ? parseInt(req.query.parentId) : null;
    const filter = req.query.filter; // 'starred', 'trash', 'recent'
    const search = req.query.search; // Search query

    let folderWhere = { isTrashed: false };
    let fileWhere = { isTrashed: false };

    // --- Search Logic ---
    if (search) {
      folderWhere = {
        name: { contains: search },
        isTrashed: false
      };
      fileWhere = {
        name: { contains: search },
        isTrashed: false
      };
    }
    // --- Filter Logic ---
    else if (filter === 'starred') {
      folderWhere = { isStarred: true, isTrashed: false };
      fileWhere = { isStarred: true, isTrashed: false };
    } else if (filter === 'trash') {
      folderWhere = { isTrashed: true };
      fileWhere = { isTrashed: true };
    } else if (filter === 'recent') {
      folderWhere = { isTrashed: false };
      fileWhere = { isTrashed: false };
    } else {
      // Default view (Browsing)
      folderWhere = { parentId: parentId, isTrashed: false };
      fileWhere = { folderId: parentId, isTrashed: false };
    }

    // Execution
    const folders = await prisma.folder.findMany({
      where: folderWhere,
      orderBy: { updatedAt: 'desc' }
    });

    const files = await prisma.file.findMany({
      where: fileWhere,
      orderBy: { createdAt: 'desc' }
    });

    // Handle Breadcrumbs (only if not searching/filtering)
    let breadcrumbs = [];
    if (parentId && !search && !filter) {
      let currentId = parentId;
      while (currentId) {
        const folder = await prisma.folder.findUnique({ where: { id: currentId } });
        if (folder) {
          breadcrumbs.unshift({ id: folder.id, name: folder.name });
          currentId = folder.parentId;
        } else {
          break;
        }
      }
    }

    // Calculate Total Storage Usage
    const usage = await prisma.file.aggregate({
      _sum: {
        size: true
      }
    });

    res.json({
      folders,
      files,
      breadcrumbs,
      usage: usage._sum.size || 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Toggle Attributes (Star/Trash)
app.put('/api/files/:id/toggle', async (req, res) => {
  try {
    const { isStarred, isTrashed } = req.body;
    const data = {};
    if (isStarred !== undefined) data.isStarred = isStarred;
    if (isTrashed !== undefined) data.isTrashed = isTrashed;

    // If trashing, also untrash? No, if trashing, star doesn't matter much.
    const file = await prisma.file.update({
      where: { id: parseInt(req.params.id) },
      data
    });
    res.json(file);
  } catch (error) {
    res.status(500).json({ error: "Failed to update file" });
  }
});

app.put('/api/folders/:id/toggle', async (req, res) => {
  try {
    const { isStarred, isTrashed } = req.body;
    const data = {};
    if (isStarred !== undefined) data.isStarred = isStarred;
    if (isTrashed !== undefined) data.isTrashed = isTrashed;

    const folder = await prisma.folder.update({
      where: { id: parseInt(req.params.id) },
      data
    });
    res.json(folder);
  } catch (error) {
    res.status(500).json({ error: "Failed to update folder" });
  }
});


// 2. Create Folder
app.post('/api/folders', async (req, res) => {
  try {
    const { name, parentId } = req.body;
    const folder = await prisma.folder.create({
      data: {
        name,
        parentId: parentId ? parseInt(parentId) : null
      }
    });
    res.json(folder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// 3. Upload File
app.post('/api/upload', upload.single('file'), async (req, res) => {
  const logFile = path.join(__dirname, 'debug_upload.txt');
  const log = (msg) => {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
    console.log(msg);
  };

  try {
    log('[Upload] Received request');
    log(`[Upload] Body: ${JSON.stringify(req.body)}`);
    log(`[Upload] File: ${req.file ? req.file.originalname : 'MISSING'}`);

    const { folderId } = req.body;
    if (!req.file) {
      log('[Upload Error] No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = await prisma.file.create({
      data: {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype,
        path: req.file.filename,
        folderId: folderId && folderId !== 'null' ? parseInt(folderId) : null,
        isStarred: false,
        isTrashed: false
      }
    });

    log(`[Upload] Success: File ID ${file.id} created.`);
    res.json(file);
  } catch (error) {
    log(`[Upload Error] ${error.message}`);
    res.status(500).json({ error: 'Failed to upload file: ' + error.message });
  }
});

// 4. Download/View File
app.get('/api/files/:id/download', async (req, res) => {
  try {
    const file = await prisma.file.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!file) return res.status(404).json({ error: 'File not found' });

    // Verify path
    const filePath = path.resolve(UPLOADS_DIR, file.path);
    console.log(`[Download] Looking for file: ${filePath} (DB Path: ${file.path})`);

    if (!fs.existsSync(filePath)) {
      console.error(`[Download] File missing on disk: ${filePath}`);
      return res.status(404).json({ error: 'File content missing on server' });
    }

    // res.download fails on some windows setups (async error)
    // Switching to manual stream pipe for stability
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.setHeader('Content-Type', file.type || 'application/octet-stream');

    const fileStream = fs.createReadStream(filePath);

    fileStream.on('error', (err) => {
      console.error(`[Stream Error] ${err.message}`);
      if (!res.headersSent) res.status(500).json({ error: 'Stream failed' });
    });

    fileStream.pipe(res);
  } catch (error) {
    console.error(`[Download Error] ${error.message}`);
    // Check if headers sent to avoid double-response
    if (!res.headersSent) {
      res.status(500).json({ error: 'Download failed' });
    }
  }
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;

// 6. Delete File
app.delete('/api/files/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const file = await prisma.file.findUnique({ where: { id } });
    if (!file) return res.status(404).json({ error: 'File not found' });

    // Delete from disk
    const filePath = path.join(UPLOADS_DIR, file.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from DB
    await prisma.file.delete({ where: { id } });
    res.json({ message: 'File deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// 7. Delete Folder
app.delete('/api/folders/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    // Note: This is soft/recursive delete. Prisma handles cascading if configured, 
    // but here we might need to manually handle children if not using ON DELETE CASCADE in DB.
    // For simplicity with SQLite default, we'll try to delete. 
    // If it fails due to foreign key constraints, we'd need to recursive delete.
    // Let's implement recursive delete for safety.

    const deleteFolderRecursive = async (folderId) => {
      // Find subfolders
      const children = await prisma.folder.findMany({ where: { parentId: folderId } });
      for (const child of children) {
        await deleteFolderRecursive(child.id);
      }

      // Delete files in this folder
      const files = await prisma.file.findMany({ where: { folderId } });
      for (const file of files) {
        const filePath = path.join(UPLOADS_DIR, file.path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        await prisma.file.delete({ where: { id: file.id } });
      }

      // Delete folder itself
      await prisma.folder.delete({ where: { id: folderId } });
    };

    await deleteFolderRecursive(id);
    res.json({ message: 'Folder deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

// 8. Rename File
app.put('/api/files/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const file = await prisma.file.update({
      where: { id: parseInt(req.params.id) },
      data: { name }
    });
    res.json(file);
  } catch (error) {
    res.status(500).json({ error: 'Failed to rename file' });
  }
});

// 9. Rename Folder
app.put('/api/folders/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const folder = await prisma.folder.update({
      where: { id: parseInt(req.params.id) },
      data: { name }
    });
    res.json(folder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to rename folder' });
  }
});

// 10. Extract Zip
app.post('/api/files/:id/extract', async (req, res) => {
  try {
    const file = await prisma.file.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!file) return res.status(404).json({ error: 'File not found' });

    const filePath = path.resolve(UPLOADS_DIR, file.path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on server' });

    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries(); // Array of ZipEntry

    // Create a root folder for extraction
    const rootFolderName = file.name.replace(/\.[^/.]+$/, "") + "_extracted";
    const rootFolder = await prisma.folder.create({
      data: {
        name: rootFolderName,
        parentId: file.folderId
      }
    });

    // Map zip path to DB folder ID
    const pathMap = { "": rootFolder.id };

    // Pass 1: Directories
    for (const entry of zipEntries) {
      if (entry.isDirectory) {
        const parts = entry.entryName.split('/').filter(p => p);
        let currentPath = "";
        let parentId = rootFolder.id;

        for (const part of parts) {
          currentPath += part + "/";
          if (!pathMap[currentPath]) {
            // Check if we already created it in this loop?
            // For simplicity, just create. (Prisma might duplicate if name conflict in same folder? SQLite allows same name different ID usually, or we assume Zip integrity).
            const newFolder = await prisma.folder.create({
              data: { name: part, parentId: parentId }
            });
            pathMap[currentPath] = newFolder.id;
          }
          parentId = pathMap[currentPath];
        }
      }
    }

    // Pass 2: Files
    for (const entry of zipEntries) {
      if (!entry.isDirectory) {
        const parts = entry.entryName.split('/');
        const fileName = parts.pop();
        const dirPath = parts.join('/') + (parts.length > 0 ? '/' : '');

        // Fallback to root if folder not found (shouldn't happen if Pass 1 works, or if zip is flat)
        const folderId = pathMap[dirPath] || rootFolder.id;

        // Extract to flat uploads dir
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const physicalName = uniqueSuffix + '-' + fileName;
        const physicalPath = path.join(UPLOADS_DIR, physicalName);

        fs.writeFileSync(physicalPath, entry.getData());

        await prisma.file.create({
          data: {
            name: fileName,
            size: entry.header.size,
            type: 'application/octet-stream',
            path: physicalName,
            folderId: folderId,
            isStarred: false,
            isTrashed: false
          }
        });
      }
    }

    res.json({ message: 'Extraction complete', folderId: rootFolder.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Extraction failed: ' + error.message });
  }
});

// 11. Bulk Download (Zip)
app.post('/api/download-zip', async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ error: 'No items selected' });

    const zip = new AdmZip();

    // Helper to add folder recursively
    const addFolderToZip = async (folderId, zipPath) => {
      const files = await prisma.file.findMany({ where: { folderId } });
      for (const f of files) {
        const pPath = path.join(UPLOADS_DIR, f.path);
        if (fs.existsSync(pPath)) {
          zip.addLocalFile(pPath, zipPath, f.name);
        }
      }

      const subfolders = await prisma.folder.findMany({ where: { parentId: folderId } });
      for (const f of subfolders) {
        await addFolderToZip(f.id, zipPath + f.name + "/");
      }
    };

    for (const item of items) {
      if (item.type === 'file') {
        const f = await prisma.file.findUnique({ where: { id: item.id } });
        if (f) {
          const pPath = path.join(UPLOADS_DIR, f.path);
          if (fs.existsSync(pPath)) {
            zip.addLocalFile(pPath, "", f.name);
          }
        }
      } else if (item.type === 'folder') {
        const f = await prisma.folder.findUnique({ where: { id: item.id } });
        if (f) {
          await addFolderToZip(f.id, f.name + "/");
        }
      }
    }

    const buffer = zip.toBuffer();
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', 'attachment; filename="download.zip"');
    res.send(buffer);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Zip generation failed' });
  }
});
