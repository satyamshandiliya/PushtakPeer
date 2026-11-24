import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessConversation,
  canCreateInterestRequest,
  filterListings,
  validateListingInput,
  validateRegistrationInput,
  validateUploadedImageMeta,
} from './validation';

test('validateRegistrationInput accepts valid buyer/seller/both inputs', () => {
  const res = validateRegistrationInput({
    name: 'Ananya Verma',
    email: 'ANANYA@CAMPUS.EDU',
    password: 'Password123',
    confirmPassword: 'Password123',
    collegeName: 'IIT Bombay',
    role: 'both',
  });
  assert.equal(res.valid, true);
  assert.equal(res.data?.email, 'ananya@campus.edu');
  assert.equal(res.data?.isBuyer, true);
  assert.equal(res.data?.isSeller, true);
});

test('validateRegistrationInput rejects mismatched passwords and missing college', () => {
  const res = validateRegistrationInput({
    name: 'A',
    email: 'bad-email',
    password: 'short',
    confirmPassword: 'other',
    collegeName: '',
    role: 'buyer',
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.name);
  assert.ok(res.errors.email);
  assert.ok(res.errors.password);
  assert.ok(res.errors.confirmPassword);
  assert.ok(res.errors.collegeName);
});

test('validateListingInput enforces condition for Books and Hardcopy Notes, and strips condition for Digital Notes', () => {
  const missingBookCond = validateListingInput({
    title: 'Linear Algebra',
    description: 'Clean textbook used for 1 semester.',
    category: 'Book',
    price: 350,
    imageUrls: ['/uploads/a.jpg'],
  });
  assert.equal(missingBookCond.valid, false);
  assert.ok(missingBookCond.errors.condition);

  const missingHardcopyCond = validateListingInput({
    title: 'Physics Spiral Notes',
    description: 'Complete semester 1 handwritten notes.',
    category: 'Notes',
    notesFormat: 'Hardcopy',
    price: 150,
    imageUrls: ['/uploads/b.jpg'],
  });
  assert.equal(missingHardcopyCond.valid, false);
  assert.ok(missingHardcopyCond.errors.condition);

  const digitalNotes = validateListingInput({
    title: 'DBMS Cheat Sheet PDF',
    description: 'Concise digital summary of normalization and transactions.',
    category: 'Notes',
    notesFormat: 'Digital',
    condition: 'Good', // should be ignored/cleared
    price: 99,
    imageUrls: ['/uploads/c.jpg'],
  });
  assert.equal(digitalNotes.valid, true);
  assert.equal(digitalNotes.data?.notesFormat, 'Digital');
  assert.equal(digitalNotes.data?.condition, null);
});

test('validateUploadedImageMeta validates MIME types and 5MB cap', () => {
  assert.equal(validateUploadedImageMeta('image/jpeg', 1024).valid, true);
  assert.equal(validateUploadedImageMeta('image/png', 2048).valid, true);
  assert.equal(validateUploadedImageMeta('image/webp', 5000).valid, true);
  assert.equal(validateUploadedImageMeta('application/pdf', 1024).valid, false);
  assert.equal(validateUploadedImageMeta('image/jpeg', 6 * 1024 * 1024).valid, false);
});

test('canCreateInterestRequest blocks self-interest, sold listings, and duplicate requests', () => {
  assert.equal(
    canCreateInterestRequest({
      listingStatus: 'Active',
      listingSellerId: 5,
      buyerId: 5,
    }).allowed,
    false
  );
  assert.equal(
    canCreateInterestRequest({
      listingStatus: 'Sold',
      listingSellerId: 5,
      buyerId: 9,
    }).allowed,
    false
  );
  assert.equal(
    canCreateInterestRequest({
      listingStatus: 'Active',
      listingSellerId: 5,
      buyerId: 9,
      existingRequestStatus: 'Pending',
    }).allowed,
    false
  );
  assert.equal(
    canCreateInterestRequest({
      listingStatus: 'Active',
      listingSellerId: 5,
      buyerId: 9,
      existingRequestStatus: null,
    }).allowed,
    true
  );
});

test('canAccessConversation enforces strict buyer/seller authorization', () => {
  const convo = { buyerId: 10, sellerId: 20 };
  assert.equal(canAccessConversation(10, convo), true);
  assert.equal(canAccessConversation(20, convo), true);
  assert.equal(canAccessConversation(99, convo), false);
});

test('filterListings filters active items by search query, category, and condition', () => {
  const sample = [
    {
      title: 'CLRS Algorithms',
      description: '3rd edition',
      category: 'Book',
      notesFormat: null,
      condition: 'Good',
      status: 'Active',
      collegeName: 'IIT Delhi',
    },
    {
      title: 'OS Digital Notes',
      description: 'Scheduling PDF',
      category: 'Notes',
      notesFormat: 'Digital',
      condition: null,
      status: 'Active',
      collegeName: 'DU',
    },
    {
      title: 'Sold Physics Book',
      description: 'Old',
      category: 'Book',
      notesFormat: null,
      condition: 'Good',
      status: 'Sold',
      collegeName: 'IIT Delhi',
    },
  ];
  assert.equal(filterListings(sample, {}).length, 2);
  assert.equal(filterListings(sample, { category: 'Book' }).length, 1);
  assert.equal(filterListings(sample, { category: 'Notes' }).length, 1);
  assert.equal(filterListings(sample, { condition: 'Good' }).length, 1);
  assert.equal(filterListings(sample, { q: 'scheduling' }).length, 1);
});
