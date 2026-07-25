import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, UploadCloud, XCircle } from 'lucide-react';
import { uploadBettingLogo, validateLogoFile } from '@/services/storageService';

interface LogoUploaderProps {
  value: string | null;
  onUploaded: (logoUrl: string) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function LogoUploader({ value, onUploaded, onRemove, disabled = false }: LogoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setPreviewUrl(value);
  }, [value]);

  const preview = useMemo(() => previewUrl ?? value ?? null, [previewUrl, value]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setErrorMessage(null);

    if (!file) {
      return;
    }

    const validation = validateLogoFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.message);
      event.target.value = '';
      return;
    }

    const localPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(localPreviewUrl);
    setUploading(true);
    setUploadProgress(5);

    const progressInterval = window.setInterval(() => {
      setUploadProgress((prev) => (prev >= 90 ? prev : prev + 9));
    }, 140);

    try {
      const uploadResult = await uploadBettingLogo(file);
      setUploadProgress(100);
      onUploaded(uploadResult.publicUrl);
    } catch (error) {
      setPreviewUrl(value ?? null);
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed. Please try again.');
    } finally {
      window.clearInterval(progressInterval);
      setUploading(false);
      window.setTimeout(() => {
        setUploadProgress(0);
      }, 400);
      URL.revokeObjectURL(localPreviewUrl);
      event.target.value = '';
    }
  }

  function openFilePicker() {
    if (disabled || uploading) return;
    fileInputRef.current?.click();
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />

      <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
        <div className="w-24 h-24 rounded-xl border border-[#2a3a52] bg-[#0a0e1a] flex items-center justify-center overflow-hidden">
          {preview ? (
            <img src={preview} alt="Logo preview" className="w-full h-full object-contain p-2" />
          ) : (
            <ImagePlus className="w-8 h-8 text-gray-500" />
          )}
        </div>

        <div className="flex-1 space-y-2">
          <button
            type="button"
            onClick={openFilePicker}
            disabled={disabled || uploading}
            className="btn-secondary text-sm inline-flex items-center gap-2"
          >
            <UploadCloud className="w-4 h-4" />
            {uploading ? 'Uploading logo...' : preview ? 'Replace Logo' : 'Upload Logo'}
          </button>

          {preview && !uploading && (
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              className="text-sm text-red-400 hover:text-red-300 inline-flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Remove logo
            </button>
          )}

          <p className="text-xs text-gray-500">Allowed: PNG, JPG, JPEG, SVG, WebP. Maximum size: 5 MB.</p>
        </div>
      </div>

      {uploading && (
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-[#1e293b] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#d4af37] to-[#e8c860] transition-all duration-150"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">Uploading... {uploadProgress}%</p>
        </div>
      )}

      {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}
    </div>
  );
}
