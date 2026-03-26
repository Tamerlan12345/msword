import express from 'express';
import { getIframeUrl, checkFileInfo, getFile, putFile, handleLock } from '../controllers/wopiController';

const router = express.Router();

// Generate Iframe URL
router.get('/iframe/:id', getIframeUrl);

// CheckFileInfo
router.get('/files/:id', checkFileInfo);

// GetFile
router.get('/files/:id/contents', getFile);

// PutFile
router.post('/files/:id/contents', express.raw({ type: '*/*', limit: '50mb' }), putFile);

// Handle Lock (and other operations)
router.post('/files/:id', handleLock);

export default router;
