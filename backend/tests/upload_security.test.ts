import { fileFilter } from '../src/middleware/uploadMiddleware';

describe('Security: File Upload Filter', () => {
    let cb: jest.Mock;

    beforeEach(() => {
        cb = jest.fn();
    });

    const mockFile = (filename: string) => ({
        originalname: Buffer.from(filename, 'utf8').toString('latin1'),
    } as any);

    it('should allow valid document extensions', () => {
        const validFiles = ['test.docx', 'report.pdf', 'data.xlsx', 'notes.txt'];

        validFiles.forEach(filename => {
            fileFilter({} as any, mockFile(filename), cb);
            expect(cb).toHaveBeenCalledWith(null, true);
            cb.mockClear();
        });
    });

    it('should allow valid image extensions', () => {
        const validImages = ['image.jpg', 'pic.png', 'photo.jpeg'];

        validImages.forEach(filename => {
            fileFilter({} as any, mockFile(filename), cb);
            expect(cb).toHaveBeenCalledWith(null, true);
            cb.mockClear();
        });
    });

    it('should REJECT dangerous executable extensions', () => {
        const dangerousFiles = ['virus.exe', 'script.sh', 'macro.vbs', 'program.bin'];

        dangerousFiles.forEach(filename => {
            fileFilter({} as any, mockFile(filename), cb);
            expect(cb).toHaveBeenCalledWith(expect.any(Error));
            const error = cb.mock.calls[0][0];
            expect(error.message).toMatch(/Invalid file type/);
            cb.mockClear();
        });
    });
});
