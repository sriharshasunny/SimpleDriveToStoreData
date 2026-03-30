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

const auth = require('./middleware/auth');

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// --- API Auth Routes ---
app.use('/api/auth', require('./routes/auth'));

// --- API Drive Routes ---

// 1. List Files and Folders (Directory Content)
app.get('/api/drive', auth, async (req, res) => {
  try {
    const parentId = req.query.parentId ? req.query.parentId : null;
    const filter = req.query.filter; 
    const search = req.query.search; 

    const userId = req.user.id;

    let folderWhere = { userId, isTrashed: false };
    let fileWhere = { userId, isTrashed: false };

    if (search) {
      folderWhere = { ...folderWhere, name: { contains: search } };
      fileWhere = { ...fileWhere, name: { contains: search } };
    } else if (filter === 'starred') {
      folderWhere = { ...folderWhere, isStarred: true };
      fileWhere = { ...fileWhere, isStarred: true };
    } else if (filter === 'trash') {
      folderWhere = { userId, isTrashed: true };
      fileWhere = { userId, isTrashed: true };
    } else {
      folderWhere = { ...folderWhere, parentId: parentId };
      fileWhere = { ...fileWhere, folderId: parentId };
    }

    const folders = await prisma.folder.findMany({
      where: folderWhere,
      orderBy: { updatedAt: 'desc' }
    });

    const files = await prisma.file.findMany({
      where: fileWhere,
      orderBy: { createdAt: 'desc' }
    });

    let breadcrumbs = [];
    if (parentId && !search && !filter) {
      let currentId = parentId;
      while (currentId) {
        const folder = await prisma.folder.findUnique({ where: { id: currentId, userId } });
        if (folder) {
          breadcrumbs.unshift({ id: folder.id, name: folder.name });
          currentId = folder.parentId;
        } else {
          break;
        }
      }
    }

    const usage = await prisma.file.aggregate({
      _sum: { size: true },
      where: { userId, isTrashed: false }
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
app.put('/api/files/:id/toggle', auth, async (req, res) => {
  try {
    const { isStarred, isTrashed } = req.body;
    const data = {};
    if (isStarred !== undefined) data.isStarred = isStarred;
    if (isTrashed !== undefined) data.isTrashed = isTrashed;

    const file = await prisma.file.update({
      where: { id: req.params.id, userId: req.user.id },
      data
    });
    res.json(file);
  } catch (error) {
    res.status(500).json({ error: "Failed to update file" });
  }
});

app.put('/api/folders/:id/toggle', auth, async (req, res) => {
  try {
    const { isStarred, isTrashed } = req.body;
    const data = {};
    if (isStarred !== undefined) data.isStarred = isStarred;
    if (isTrashed !== undefined) data.isTrashed = isTrashed;

    const folder = await prisma.folder.update({
      where: { id: req.params.id, userId: req.user.id },
      data
    });
    res.json(folder);
  } catch (error) {
    res.status(500).json({ error: "Failed to update folder" });
  }
});

// 2. Create Folder
app.post('/api/folders', auth, async (req, res) => {
  try {
    const { name, parentId } = req.body;
    const folder = await prisma.folder.create({
      data: {
        name,
        parentId: parentId ? parentId : null,
        userId: req.user.id
      }
    });
    res.json(folder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// 3. Upload File
app.post('/api/upload', auth, upload.single('file'), async (req, res) => {
  const logFile = path.join(__dirname, 'debug_upload.txt');
  const log = (msg) => {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
    console.log(msg);
  };

  try {
    log('[Upload] Received request');
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
        folderId: folderId && folderId !== 'null' ? folderId : null,
        userId: req.user.id,
        isStarred: false,
        isTrashed: false
      }
    });

    log(`[Upload] Success: File ID ${file.id} created.`);
    res.json(file);
  } catch (error) {
    log(`[Upload Error] ${error.message}`);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// 4. Download/View File
app.get('/api/files/:id/download', auth, async (req, res) => {
  try {
    const file = await prisma.file.findUnique({ where: { id: req.params.id, userId: req.user.id } });
    if (!file) return res.status(404).json({ error: 'File not found' });

    const filePath = path.resolve(UPLOADS_DIR, file.path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File content missing on server' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.setHeader('Content-Type', file.type || 'application/octet-stream');
    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', () => { if (!res.headersSent) res.status(500).json({ error: 'Stream failed' }); });
    fileStream.pipe(res);
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
  }
});

// 6. Delete File
app.delete('/api/files/:id', auth, async (req, res) => {
  try {
    const file = await prisma.file.findUnique({ where: { id: req.params.id, userId: req.user.id } });
    if (!file) return res.status(404).json({ error: 'File not found' });

    const filePath = path.join(UPLOADS_DIR, file.path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await prisma.file.delete({ where: { id: req.params.id } });
    res.json({ message: 'File deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// 7. Delete Folder
app.delete('/api/folders/:id', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const folderCheck = await prisma.folder.findUnique({ where: { id: req.params.id, userId } });
    if (!folderCheck) return res.status(404).json({ error: 'Folder not found' });

    const deleteFolderRecursive = async (folderId) => {
      const children = await prisma.folder.findMany({ where: { parentId: folderId, userId } });
      for (const child of children) {
        await deleteFolderRecursive(child.id);
      }
      const files = await prisma.file.findMany({ where: { folderId, userId } });
      for (const f of files) {
        const filePath = path.join(UPLOADS_DIR, f.path);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        await prisma.file.delete({ where: { id: f.id } });
      }
      await prisma.folder.delete({ where: { id: folderId } });
    };

    await deleteFolderRecursive(req.params.id);
    res.json({ message: 'Folder deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

// 8. Rename File
app.put('/api/files/:id', auth, async (req, res) => {
  try {
    const { name } = req.body;
    const file = await prisma.file.update({
      where: { id: req.params.id, userId: req.user.id },
      data: { name }
    });
    res.json(file);
  } catch (error) {
    res.status(500).json({ error: 'Failed to rename file' });
  }
});

// 9. Rename Folder
app.put('/api/folders/:id', auth, async (req, res) => {
  try {
    const { name } = req.body;
    const folder = await prisma.folder.update({
      where: { id: req.params.id, userId: req.user.id },
      data: { name }
    });
    res.json(folder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to rename folder' });
  }
});

// 10. Extract Zip
app.post('/api/files/:id/extract', auth, async (req, res) => {
  try {
    const file = await prisma.file.findUnique({ where: { id: req.params.id, userId: req.user.id } });
    if (!file) return res.status(404).json({ error: 'File not found' });

    const filePath = path.resolve(UPLOADS_DIR, file.path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on server' });

    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries(); 

    const rootFolderName = file.name.replace(/\.[^/.]+$/, "") + "_extracted";
    const rootFolder = await prisma.folder.create({
      data: { name: rootFolderName, parentId: file.folderId, userId: req.user.id }
    });

    const pathMap = { "": rootFolder.id };

    for (const entry of zipEntries) {
      if (entry.isDirectory) {
        const parts = entry.entryName.split('/').filter(p => p);
        let currentPath = "";
        let parentId = rootFolder.id;

        for (const part of parts) {
          currentPath += part + "/";
          if (!pathMap[currentPath]) {
            const newFolder = await prisma.folder.create({
              data: { name: part, parentId: parentId, userId: req.user.id }
            });
            pathMap[currentPath] = newFolder.id;
          }
          parentId = pathMap[currentPath];
        }
      }
    }

    for (const entry of zipEntries) {
      if (!entry.isDirectory) {
        const parts = entry.entryName.split('/');
        const fileName = parts.pop();
        const dirPath = parts.join('/') + (parts.length > 0 ? '/' : '');

        const folderId = pathMap[dirPath] || rootFolder.id;

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
            userId: req.user.id,
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
app.post('/api/download-zip', auth, async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ error: 'No items selected' });

    const userId = req.user.id;
    const zip = new AdmZip();

    const addFolderToZip = async (folderId, zipPath) => {
      const files = await prisma.file.findMany({ where: { folderId, userId } });
      for (const f of files) {
        const pPath = path.join(UPLOADS_DIR, f.path);
        if (fs.existsSync(pPath)) {
          zip.addLocalFile(pPath, zipPath, f.name);
        }
      }

      const subfolders = await prisma.folder.findMany({ where: { parentId: folderId, userId } });
      for (const f of subfolders) {
        await addFolderToZip(f.id, zipPath + f.name + "/");
      }
    };

    for (const item of items) {
      if (item.type === 'file') {
        const f = await prisma.file.findUnique({ where: { id: item.id, userId } });
        if (f) {
          const pPath = path.join(UPLOADS_DIR, f.path);
          if (fs.existsSync(pPath)) {
            zip.addLocalFile(pPath, "", f.name);
          }
        }
      } else if (item.type === 'folder') {
        const f = await prisma.folder.findUnique({ where: { id: item.id, userId } });
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

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
