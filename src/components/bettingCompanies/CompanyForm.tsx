import { useEffect, useState } from 'react';
import type {
  BettingCompany,
  CreateBettingCompanyInput,
  UpdateBettingCompanyInput,
} from '@/lib/bettingCompanyTypes';
import { LogoUploader } from '@/components/bettingCompanies/LogoUploader';

interface CompanyFormProps {
  company?: BettingCompany | null;
  submitting: boolean;
  onSubmit: (payload: CreateBettingCompanyInput | UpdateBettingCompanyInput) => Promise<void>;
  onCancelEdit?: () => void;
}

interface FormState {
  name: string;
  website: string;
  logoUrl: string | null;
  status: boolean;
}

const initialState: FormState = {
  name: '',
  website: '',
  logoUrl: null,
  status: true,
};

export function CompanyForm({ company, submitting, onSubmit, onCancelEdit }: CompanyFormProps) {
  const isEditMode = Boolean(company);
  const [formState, setFormState] = useState<FormState>(initialState);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!company) {
      setFormState(initialState);
      setValidationError(null);
      return;
    }

    setFormState({
      name: company.name,
      website: company.website ?? '',
      logoUrl: company.logoUrl,
      status: company.status,
    });
    setValidationError(null);
  }, [company]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setFormState((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);

    if (!formState.name.trim()) {
      setValidationError('Company name is required.');
      return;
    }

    await onSubmit({
      name: formState.name.trim(),
      website: formState.website.trim() || null,
      logoUrl: formState.logoUrl,
      status: formState.status,
    });

    if (!isEditMode) {
      setFormState(initialState);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 md:p-7 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{isEditMode ? 'Edit Betting Company' : 'Add Betting Company'}</h2>
        <p className="text-sm text-gray-400 mt-1">
          {isEditMode
            ? 'Update company details and replace logo when necessary.'
            : 'Create a new betting company entry with logo and status.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="company-name" className="block text-sm text-gray-300 mb-2">
            Company Name <span className="text-red-400">*</span>
          </label>
          <input
            id="company-name"
            className="input-field"
            value={formState.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="e.g. BetKing"
            disabled={submitting}
            required
          />
        </div>

        <div>
          <label htmlFor="company-website" className="block text-sm text-gray-300 mb-2">
            Website
          </label>
          <input
            id="company-website"
            className="input-field"
            value={formState.website}
            onChange={(e) => updateField('website', e.target.value)}
            placeholder="https://example.com"
            disabled={submitting}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-2">Company Logo</label>
        <LogoUploader
          value={formState.logoUrl}
          onUploaded={(url) => updateField('logoUrl', url)}
          onRemove={() => updateField('logoUrl', null)}
          disabled={submitting}
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          id="company-status"
          type="checkbox"
          checked={formState.status}
          onChange={(e) => updateField('status', e.target.checked)}
          disabled={submitting}
          className="w-4 h-4 rounded border-[#2a3a52] bg-[#0a0e1a] text-[#d4af37] focus:ring-[#d4af37]"
        />
        <label htmlFor="company-status" className="text-sm text-gray-300">
          Active company
        </label>
      </div>

      {validationError && <p className="text-sm text-red-400">{validationError}</p>}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primary text-sm" disabled={submitting}>
          {submitting ? 'Saving...' : isEditMode ? 'Update Company' : 'Add Company'}
        </button>

        {isEditMode && onCancelEdit && (
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={onCancelEdit}
            disabled={submitting}
          >
            Cancel Edit
          </button>
        )}
      </div>
    </form>
  );
}
