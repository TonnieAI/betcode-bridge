import type { BettingCompany } from '@/lib/bettingCompanyTypes';
import { AlertTriangle } from 'lucide-react';

interface DeleteConfirmationProps {
  open: boolean;
  company: BettingCompany | null;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteConfirmation({
  open,
  company,
  loading,
  onCancel,
  onConfirm,
}: DeleteConfirmationProps) {
  if (!open || !company) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#02050bcc] backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="w-full max-w-md card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/40 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold">Delete betting company?</h3>
        </div>

        <p className="text-sm text-gray-400 mb-2">
          This action will permanently remove <span className="text-gray-200 font-medium">{company.name}</span>.
        </p>
        <p className="text-sm text-gray-400 mb-6">Its logo will also be removed from storage if present.</p>

        <div className="flex items-center justify-end gap-3">
          <button type="button" className="btn-secondary text-sm" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-400 disabled:opacity-60"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
