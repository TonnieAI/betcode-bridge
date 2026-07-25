import { supabase } from '@/lib/supabase';

export const BETTING_LOGOS_BUCKET = 'betting-logos';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
  'image/webp',
]);

const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'svg', 'webp']);

export interface UploadLogoResult {
  publicUrl: string;
  path: string;
}

function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return (parts[parts.length - 1] ?? '').toLowerCase();
}

export function generateUniqueFileName(fileName: string): string {
  const ext = getFileExtension(fileName);
  const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : 'png';
  const unique = `${Date.now()}-${crypto.randomUUID()}`;
  return `${unique}.${safeExt}`;
}

export function validateLogoFile(file: File): { valid: true } | { valid: false; message: string } {
  const ext = getFileExtension(file.name);

  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type) || !ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      message: 'Invalid image format. Please upload PNG, JPG, JPEG, SVG, or WebP.',
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      message: 'Image size must be 5 MB or less.',
    };
  }

  return { valid: true };
}

export async function uploadBettingLogo(file: File): Promise<UploadLogoResult> {
  const fileValidation = validateLogoFile(file);
  if (!fileValidation.valid) {
    throw new Error(fileValidation.message);
  }

  const filePath = generateUniqueFileName(file.name);

  const { error: uploadError } = await supabase.storage
    .from(BETTING_LOGOS_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    throw new Error(`Logo upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(BETTING_LOGOS_BUCKET).getPublicUrl(filePath);

  if (!data.publicUrl) {
    throw new Error('Upload succeeded, but failed to generate public URL for logo.');
  }

  return {
    publicUrl: data.publicUrl,
    path: filePath,
  };
}

function extractStoragePathFromPublicUrl(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl);
    const marker = `/${BETTING_LOGOS_BUCKET}/`;
    const decodedPath = decodeURIComponent(url.pathname);
    const bucketIndex = decodedPath.indexOf(marker);

    if (bucketIndex === -1) {
      return null;
    }

    return decodedPath.substring(bucketIndex + marker.length);
  } catch {
    return null;
  }
}

export async function deleteBettingLogoByPublicUrl(publicUrl: string): Promise<void> {
  const storagePath = extractStoragePathFromPublicUrl(publicUrl);
  if (!storagePath) {
    return;
  }

  const { error } = await supabase.storage.from(BETTING_LOGOS_BUCKET).remove([storagePath]);

  if (error) {
    throw new Error(`Failed to delete logo from storage: ${error.message}`);
  }
}
