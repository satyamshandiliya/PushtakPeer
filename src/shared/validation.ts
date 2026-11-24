export type RoleSelection = 'buyer' | 'seller' | 'both';
export type ListingCategory = 'Book' | 'Notes';
export type NotesFormat = 'Hardcopy' | 'Digital';
export type ListingCondition = 'Excellent' | 'Good' | 'Moderate' | 'Poor';
export type ListingStatus = 'Active' | 'Sold';
export type InterestStatus = 'Pending' | 'Accepted' | 'Declined';

export const VALID_CATEGORIES: readonly ListingCategory[] = ['Book', 'Notes'];
export const VALID_NOTES_FORMATS: readonly NotesFormat[] = ['Hardcopy', 'Digital'];
export const VALID_CONDITIONS: readonly ListingCondition[] = [
  'Excellent',
  'Good',
  'Moderate',
  'Poor',
];
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_IMAGES_PER_LISTING = 6;

export interface ValidationResult<T> {
  valid: boolean;
  errors: Record<string, string>;
  data?: T;
}

export interface RegistrationPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  collegeName: string;
  role: RoleSelection;
}

export interface NormalizedRegistration {
  name: string;
  email: string;
  password: string;
  collegeName: string;
  isBuyer: boolean;
  isSeller: boolean;
}

export function roleSelectionToFlags(role: RoleSelection): {
  isBuyer: boolean;
  isSeller: boolean;
} {
  if (role === 'buyer') return { isBuyer: true, isSeller: false };
  if (role === 'seller') return { isBuyer: false, isSeller: true };
  return { isBuyer: true, isSeller: true };
}

export function flagsToRoleSelection(isBuyer: boolean, isSeller: boolean): RoleSelection {
  if (isBuyer && isSeller) return 'both';
  if (isSeller) return 'seller';
  return 'buyer';
}

export function validateRegistrationInput(
  input: Partial<RegistrationPayload>
): ValidationResult<NormalizedRegistration> {
  const errors: Record<string, string> = {};
  const name = (input.name ?? '').trim();
  const email = (input.email ?? '').trim().toLowerCase();
  const password = input.password ?? '';
  const confirmPassword = input.confirmPassword ?? '';
  const collegeName = (input.collegeName ?? '').trim();
  const role = input.role;

  if (name.length < 2 || name.length > 80) {
    errors.name = 'Full name must be between 2 and 80 characters.';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.email = 'Please enter a valid college or personal email address.';
  }

  if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters long.';
  }

  if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  if (collegeName.length < 2 || collegeName.length > 120) {
    errors.collegeName = 'Please enter your college or university name.';
  }

  if (role !== 'buyer' && role !== 'seller' && role !== 'both') {
    errors.role = 'Please select Buyer, Seller, or Both.';
  }

  if (Object.keys(errors).length > 0 || !role) {
    return { valid: false, errors };
  }

  const { isBuyer, isSeller } = roleSelectionToFlags(role);
  return {
    valid: true,
    errors: {},
    data: {
      name,
      email,
      password,
      collegeName,
      isBuyer,
      isSeller,
    },
  };
}

export interface ProfileUpdatePayload {
  name: string;
  collegeName: string;
  role: RoleSelection;
}

export function validateProfileUpdateInput(
  input: Partial<ProfileUpdatePayload>
): ValidationResult<{ name: string; collegeName: string; isBuyer: boolean; isSeller: boolean }> {
  const errors: Record<string, string> = {};
  const name = (input.name ?? '').trim();
  const collegeName = (input.collegeName ?? '').trim();
  const role = input.role;

  if (name.length < 2 || name.length > 80) {
    errors.name = 'Full name must be between 2 and 80 characters.';
  }

  if (collegeName.length < 2 || collegeName.length > 120) {
    errors.collegeName = 'College name must be between 2 and 120 characters.';
  }

  if (role !== 'buyer' && role !== 'seller' && role !== 'both') {
    errors.role = 'Please choose at least one role (Buyer, Seller, or Both).';
  }

  if (Object.keys(errors).length > 0 || !role) {
    return { valid: false, errors };
  }

  const { isBuyer, isSeller } = roleSelectionToFlags(role);
  return {
    valid: true,
    errors: {},
    data: { name, collegeName, isBuyer, isSeller },
  };
}

export interface ListingInputPayload {
  title: string;
  description: string;
  category: string;
  notesFormat?: string | null;
  condition?: string | null;
  price: number | string;
  imageUrls: string[];
}

export interface NormalizedListingInput {
  title: string;
  description: string;
  category: ListingCategory;
  notesFormat: NotesFormat | null;
  condition: ListingCondition | null;
  price: number;
  imageUrls: string[];
}

export function validateListingInput(
  input: Partial<ListingInputPayload>
): ValidationResult<NormalizedListingInput> {
  const errors: Record<string, string> = {};
  const title = (input.title ?? '').trim();
  const description = (input.description ?? '').trim();
  const category = input.category as ListingCategory;
  const rawFormat = input.notesFormat ?? null;
  const rawCondition = input.condition ?? null;
  const numericPrice = typeof input.price === 'string' ? Number(input.price) : Number(input.price);
  const imageUrls = Array.isArray(input.imageUrls)
    ? input.imageUrls.map((u) => String(u).trim()).filter(Boolean)
    : [];

  if (title.length < 3 || title.length > 120) {
    errors.title = 'Title must be between 3 and 120 characters.';
  }

  if (description.length < 10 || description.length > 2000) {
    errors.description = 'Description must be between 10 and 2000 characters.';
  }

  if (!VALID_CATEGORIES.includes(category)) {
    errors.category = 'Category must be either Book or Notes.';
  }

  let normalizedFormat: NotesFormat | null = null;
  let normalizedCondition: ListingCondition | null = null;

  if (category === 'Book') {
    normalizedFormat = null;
    if (!rawCondition || !VALID_CONDITIONS.includes(rawCondition as ListingCondition)) {
      errors.condition = 'Book listings require a condition (Excellent, Good, Moderate, or Poor).';
    } else {
      normalizedCondition = rawCondition as ListingCondition;
    }
  } else if (category === 'Notes') {
    if (!rawFormat || !VALID_NOTES_FORMATS.includes(rawFormat as NotesFormat)) {
      errors.notesFormat = 'Notes listings require a format (Hardcopy or Digital).';
    } else {
      normalizedFormat = rawFormat as NotesFormat;
      if (normalizedFormat === 'Hardcopy') {
        if (!rawCondition || !VALID_CONDITIONS.includes(rawCondition as ListingCondition)) {
          errors.condition =
            'Hardcopy notes require a condition (Excellent, Good, Moderate, or Poor).';
        } else {
          normalizedCondition = rawCondition as ListingCondition;
        }
      } else {
        // Digital notes MUST NOT have a condition field
        normalizedCondition = null;
      }
    }
  }

  if (!Number.isFinite(numericPrice) || numericPrice <= 0 || numericPrice > 100000) {
    errors.price = 'Asking price must be a positive number up to 100,000.';
  }

  if (imageUrls.length === 0) {
    errors.images =
      category === 'Notes' && normalizedFormat === 'Digital'
        ? 'Please upload at least one preview image for your digital notes.'
        : 'Please upload at least one photo of the item.';
  } else if (imageUrls.length > MAX_IMAGES_PER_LISTING) {
    errors.images = `You can attach up to ${MAX_IMAGES_PER_LISTING} images per listing.`;
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    data: {
      title,
      description,
      category,
      notesFormat: normalizedFormat,
      condition: normalizedCondition,
      price: Math.round(numericPrice * 100) / 100,
      imageUrls,
    },
  };
}

export function validateUploadedImageMeta(
  mimeType: string,
  sizeBytes: number
): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
    return {
      valid: false,
      error: 'Unsupported image format. Please upload JPG, PNG, or WebP files only.',
    };
  }
  if (sizeBytes <= 0 || sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'Image size must be greater than 0 bytes and at most 5 MB.',
    };
  }
  return { valid: true };
}

export function canCreateInterestRequest(params: {
  listingStatus: ListingStatus;
  listingSellerId: number;
  buyerId: number;
  existingRequestStatus?: InterestStatus | null;
}): { allowed: boolean; reason?: string } {
  if (params.listingSellerId === params.buyerId) {
    return { allowed: false, reason: 'You cannot send an interest request on your own listing.' };
  }
  if (params.listingStatus !== 'Active') {
    return {
      allowed: false,
      reason: 'This listing has already been marked as sold and is no longer accepting requests.',
    };
  }
  if (params.existingRequestStatus === 'Pending') {
    return {
      allowed: false,
      reason: 'You already have an active interest request for this listing.',
    };
  }
  if (params.existingRequestStatus === 'Accepted') {
    return {
      allowed: false,
      reason: 'Your interest request was already accepted. Check your conversations to chat.',
    };
  }
  if (params.existingRequestStatus === 'Declined') {
    return {
      allowed: false,
      reason: 'Your previous interest request for this listing was declined by the seller.',
    };
  }
  return { allowed: true };
}

export function canAccessConversation(
  userId: number,
  conversation: { buyerId: number; sellerId: number }
): boolean {
  return conversation.buyerId === userId || conversation.sellerId === userId;
}

export interface FilterableListing {
  title: string;
  description: string;
  category: string;
  notesFormat: string | null;
  condition: string | null;
  status: string;
  sellerName?: string;
  collegeName?: string;
}

export function filterListings<T extends FilterableListing>(
  items: T[],
  filters: { q?: string; category?: string; condition?: string }
): T[] {
  const query = (filters.q ?? '').trim().toLowerCase();
  const category = (filters.category ?? '').trim();
  const condition = (filters.condition ?? '').trim();

  return items.filter((item) => {
    if (item.status !== 'Active') return false;
    if (category && category !== 'All' && item.category !== category) return false;
    if (condition && condition !== 'All' && item.condition !== condition) return false;
    if (query) {
      const haystack = `${item.title} ${item.description} ${item.sellerName ?? ''} ${item.collegeName ?? ''}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}
