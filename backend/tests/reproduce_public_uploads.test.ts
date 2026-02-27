import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../src/index';

// We need to bypass the prisma mock for the actual app instantiation in the reproduction test
// because the reproduction test relies on the REAL app structure (imports index.ts).
// However, index.ts imports prisma. If we mock it globally in jest, index.ts will use the mock.
// The secure_download.test.ts MOCKS prisma to control the DB responses.
// The reproduction test relied on the file system and express static middleware, which doesn't need DB.

const UPLOAD_DIR = path.join(__dirname, '../uploads');
const TEST_FILE = 'repro_test.txt';
const TEST_FILE_PATH = path.join(UPLOAD_DIR, TEST_FILE);

describe('Public Uploads Vulnerability', () => {
    beforeAll(() => {
        if (!fs.existsSync(UPLOAD_DIR)) {
            fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        }
        fs.writeFileSync(TEST_FILE_PATH, 'This is a secret document content.');
    });

    afterAll(() => {
        if (fs.existsSync(TEST_FILE_PATH)) {
            fs.unlinkSync(TEST_FILE_PATH);
        }
    });

    it('should FAIL: Publicly access file via /uploads without authentication', async () => {
        const res = await request(app).get(`/uploads/${TEST_FILE}`);

        // NOW WE EXPECT 404 because we fixed it.
        // The original reproduction test expected 200.
        // I will update this test to assert the fix (404).

        expect(res.status).toBe(404);
    });
});
