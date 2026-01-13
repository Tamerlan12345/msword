import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

// If JSON key is in env var, parse it.
// Assuming GOOGLE_SERVICE_KEY contains the JSON string content.
// If it's a file path, we can use keyFile.
const GOOGLE_SERVICE_KEY = process.env.GOOGLE_SERVICE_KEY;
const KEY_FILE_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;

let auth: any;

if (GOOGLE_SERVICE_KEY) {
  try {
      const credentials = JSON.parse(GOOGLE_SERVICE_KEY);
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/documents'],
      });
  } catch (e) {
      console.error("Failed to parse GOOGLE_SERVICE_KEY", e);
  }
} else if (KEY_FILE_PATH) {
    auth = new google.auth.GoogleAuth({
        keyFile: KEY_FILE_PATH,
        scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/documents'],
    });
} else {
    // Fallback or dev mode without credentials
    console.warn("No Google Credentials found. Google Drive features will fail.");
}

const drive = google.drive({ version: 'v3', auth });
const docs = google.docs({ version: 'v1', auth });

export const GoogleDriveService = {
  async uploadFile(filePath: string, fileName: string, mimeType: string = 'application/vnd.google-apps.document') {
    if (!auth) throw new Error("Google Auth not initialized");

    const requestBody = {
      name: fileName,
      mimeType: mimeType, // Convert to Google Doc
    };

    const media = {
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // Source is docx
      body: fs.createReadStream(filePath),
    };

    try {
      const file = await drive.files.create({
        requestBody,
        media: media,
        fields: 'id, webViewLink',
      });
      return file.data;
    } catch (err) {
      console.error("Google Drive Upload Error:", err);
      throw err;
    }
  },

  async grantAccess(fileId: string) {
    if (!auth) throw new Error("Google Auth not initialized");
    try {
      await drive.permissions.create({
        fileId,
        requestBody: {
          role: 'writer',
          type: 'anyone',
        },
      });
    } catch (err) {
       console.error("Google Drive Permission Error:", err);
       throw err;
    }
  },

  async exportFile(fileId: string): Promise<Buffer> {
    if (!auth) throw new Error("Google Auth not initialized");
    try {
      const res = await drive.files.export({
        fileId,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }, { responseType: 'arraybuffer' });

      return Buffer.from(res.data as any);
    } catch (err) {
       console.error("Google Drive Export Error:", err);
       throw err;
    }
  },

  async deleteFile(fileId: string) {
    if (!auth) throw new Error("Google Auth not initialized");
    try {
      await drive.files.delete({ fileId });
    } catch (err) {
       console.error("Google Drive Delete Error:", err);
       throw err; // Or ignore if not found?
    }
  }
};
