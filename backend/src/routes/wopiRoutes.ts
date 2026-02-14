import express from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import axios from 'axios';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-it';
const COLLABORA_URL = process.env.COLLABORA_URL || 'http://localhost:9980';
const WOPI_HOST_URL = process.env.WOPI_HOST_URL || 'http://localhost:3000';

// Simple in-memory cache for Discovery XML URL templates
let discoveryCache: { [ext: string]: string } = {};

// Helper to fetch Discovery XML and find action URL
const getActionUrl = async (ext: string = 'docx', action: string = 'edit'): Promise<string | null> => {
  const cacheKey = `${ext}-${action}`;
  if (discoveryCache[cacheKey]) return discoveryCache[cacheKey];

  try {
    const discoveryUrl = `${COLLABORA_URL}/hosting/discovery`;
    console.log(`Fetching discovery from: ${discoveryUrl}`);
    const { data } = await axios.get(discoveryUrl);

    // Regex to find the action URL for the extension
    // Format: <action name="edit" ext="docx" urlsrc="..." />
    // We look for ext="docx" ... urlsrc="..."
    const regex = new RegExp(`<action\\s+name="${action}"\\s+ext="${ext}"[^>]*urlsrc="([^"]+)"`, 'i');
    const match = data.match(regex);

    if (match && match[1]) {
      let url = match[1];
      // urlsrc might end with ? which is fine, or include placeholders
      discoveryCache[cacheKey] = url;
      return url;
    }
  } catch (error) {
    console.error('Failed to fetch/parse discovery XML:', error);
  }
  return null;
};

// Middleware to authenticate WOPI requests
const wopiAuth = (req: any, res: any, next: any) => {
  const accessToken = req.query.access_token || req.headers['authorization']?.split(' ')[1];

  if (!accessToken) {
    return res.status(401).json({ error: 'No access token provided' });
  }

  try {
    const user = jwt.verify(accessToken as string, JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    console.error('WOPI Auth Error:', err);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// 1. GET IFRAME URL (Frontend Helper)
router.get('/iframe/:id', wopiAuth, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    // We assume the user has a valid token since they passed wopiAuth
    // However, wopiAuth extracts it from query/header. The frontend calls this endpoint with Authorization header.
    // We need to generate a token or reuse one for the iframe URL.
    // The iframe URL needs a token in query param. We can use the one from the request header.
    const token = req.headers['authorization']?.split(' ')[1] || req.query.access_token;

    const actionUrl = await getActionUrl('docx', 'edit');
    if (!actionUrl) {
       // Fallback if discovery fails (e.g. for development with known path)
       const fallback = `${COLLABORA_URL}/browser/dist/cool.html?`;
       console.warn(`Discovery failed, using fallback: ${fallback}`);

       const wopiSrc = `${WOPI_HOST_URL}/api/wopi/files/${id}`;
       return res.json({ url: `${fallback}WOPISrc=${encodeURIComponent(wopiSrc)}&access_token=${token}` });
    }

    const wopiSrc = `${WOPI_HOST_URL}/api/wopi/files/${id}`;
    const fullUrl = `${actionUrl}WOPISrc=${encodeURIComponent(wopiSrc)}&access_token=${token}`;

    res.json({ url: fullUrl });
  } catch (error) {
    console.error('GetIframeUrl Error:', error);
    res.status(500).json({ error: 'Failed to generate iframe URL' });
  }
});

// WOPI CheckFileInfo
router.get('/files/:id', wopiAuth, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const doc = await prisma.document.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 }, author: true }
    });

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const latestVersion = doc.versions[0];
    if (!latestVersion) {
      return res.status(404).json({ error: 'File content not found' });
    }

    const filePath = path.resolve(latestVersion.filePath);
    let stats;
    try {
      stats = fs.statSync(filePath);
    } catch (e) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // WOPI properties
    const fileInfo = {
      BaseFileName: path.basename(filePath),
      OwnerId: doc.authorId,
      Size: stats.size,
      UserId: user.id,
      UserFriendlyName: user.name || user.email,
      // Permissions
      ReadOnly: false, // You can add logic here based on roles
      UserCanWrite: true, // You can add logic here
      UserCanNotWriteRelative: true, // Disable relative paths if needed

      // Time
      LastModifiedTime: doc.updatedAt.toISOString(),

      // UX
      PostMessageOrigin: "*", // Allow iframe communication
    };

    res.json(fileInfo);
  } catch (error) {
    console.error('CheckFileInfo Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// WOPI GetFile
router.get('/files/:id/contents', wopiAuth, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const doc = await prisma.document.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
    });

    if (!doc || !doc.versions[0]) {
      return res.status(404).send('File not found');
    }

    const filePath = path.resolve(doc.versions[0].filePath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found on disk');
    }

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (error) {
    console.error('GetFile Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// WOPI PutFile
router.post('/files/:id/contents', wopiAuth, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const doc = await prisma.document.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
    });

    if (!doc || !doc.versions[0]) {
      return res.status(404).json({ error: 'File not found' });
    }

    const latestVersion = doc.versions[0];
    const filePath = path.resolve(latestVersion.filePath);
    const tempPath = `${filePath}.tmp`;

    // Atomic write: Write to temp file, then rename
    const writeStream = fs.createWriteStream(tempPath);

    req.pipe(writeStream);

    writeStream.on('finish', async () => {
      try {
        // Rename temp to actual file
        fs.renameSync(tempPath, filePath);

        // Update DB timestamp
        await prisma.document.update({
          where: { id },
          data: { updatedAt: new Date() }
        });
        res.status(200).json({ ItemVersion: new Date().toISOString() });
      } catch (renameErr) {
        console.error('Rename Error:', renameErr);
        res.status(500).json({ error: 'File save failed during rename' });
      }
    });

    writeStream.on('error', (err: any) => {
      console.error('Write Error:', err);
      res.status(500).json({ error: 'Write failed' });
    });

  } catch (error) {
    console.error('PutFile Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
