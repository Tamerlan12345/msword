
import { canUserWrite } from '../src/controllers/wopiController';

describe('Strict Permissions Logic', () => {
    // Mock Users
    const author = { id: 'author-id', role: 'USER' };
    const admin = { id: 'admin-id', role: 'ADMIN' };
    const approverCurrent = { id: 'approver-1', role: 'USER' };
    const approverPast = { id: 'approver-2', role: 'USER' };
    const stranger = { id: 'stranger-id', role: 'USER' };

    // Mock Documents
    const docDraft = {
        id: 'doc-draft',
        status: 'DRAFT',
        authorId: author.id,
        approvers: []
    };

    const docOnApproval = {
        id: 'doc-approval',
        status: 'ON_APPROVAL',
        authorId: author.id,
        approvers: [
            { userId: approverCurrent.id, isCurrent: true },
            { userId: approverPast.id, isCurrent: false }
        ]
    };

    const docApproved = {
        id: 'doc-approved',
        status: 'APPROVED',
        authorId: author.id,
        approvers: [
            { userId: approverCurrent.id, isCurrent: false },
            { userId: approverPast.id, isCurrent: false }
        ]
    };

    const docReview = {
        id: 'doc-review',
        status: 'REVIEW_REQUIRED',
        authorId: author.id,
        approvers: []
    };

    const docRejected = {
        id: 'doc-rejected',
        status: 'REJECTED',
        authorId: author.id,
        approvers: []
    };

    // --- TEST CASES ---

    // 1. DRAFT State
    test('DRAFT: Author can write', () => {
        expect(canUserWrite(docDraft, author)).toBe(true);
    });

    test('DRAFT: Admin CANNOT write (Strict)', () => {
        // Current logic allows Admin -> This test will FAIL initially if run against current code
        // After fix, it should pass (return false)
        expect(canUserWrite(docDraft, admin)).toBe(false);
    });

    test('DRAFT: Stranger cannot write', () => {
        expect(canUserWrite(docDraft, stranger)).toBe(false);
    });


    // 2. ON_APPROVAL State
    test('ON_APPROVAL: Current Approver can write', () => {
        expect(canUserWrite(docOnApproval, approverCurrent)).toBe(true);
    });

    test('ON_APPROVAL: Author CANNOT write', () => {
        expect(canUserWrite(docOnApproval, author)).toBe(false);
    });

    test('ON_APPROVAL: Past Approver CANNOT write', () => {
        expect(canUserWrite(docOnApproval, approverPast)).toBe(false);
    });

    test('ON_APPROVAL: Admin CANNOT write (Strict)', () => {
        // Current logic allows Admin -> This test will FAIL initially
        expect(canUserWrite(docOnApproval, admin)).toBe(false);
    });


    // 3. APPROVED / REJECTED State
    test('APPROVED: No one can write (including Admin)', () => {
        expect(canUserWrite(docApproved, admin)).toBe(false);
        expect(canUserWrite(docApproved, author)).toBe(false);
        expect(canUserWrite(docApproved, approverCurrent)).toBe(false);
    });

    test('REJECTED: No one can write', () => {
        expect(canUserWrite(docRejected, admin)).toBe(false);
    });


    // 4. REVIEW_REQUIRED State
    test('REVIEW_REQUIRED: Author can write', () => {
        expect(canUserWrite(docReview, author)).toBe(true);
    });

    test('REVIEW_REQUIRED: Admin CANNOT write', () => {
        expect(canUserWrite(docReview, admin)).toBe(false);
    });
});
