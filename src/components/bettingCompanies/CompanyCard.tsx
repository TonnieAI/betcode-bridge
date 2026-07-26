import type { BettingCompany } from '@/lib/bettingCompanyTypes';
import { Pencil, Trash2, Globe, CalendarDays } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface CompanyCardProps {
  company: BettingCompany;
  onEdit: (company: BettingCompany) => void;
  onDelete: (company: BettingCompany) => void;
  deleting: boolean;
}

export function CompanyCard({ company, onEdit, onDelete, deleting }: CompanyCardProps) {
  const { language } = useI18n();

  return (
    <article className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-xl bg-[#0a0e1a] border border-[#2a3a52] flex items-center justify-center overflow-hidden">
          {company.logoUrl ? (
            <img src={company.logoUrl} alt={`${company.name} logo`} className="w-full h-full object-contain p-1.5" />
          ) : (
            <span className="text-sm font-bold text-gray-500">{company.name.slice(0, 2).toUpperCase()}</span>
          )}
        </div>

        <div className="min-w-0">
          <h3 className="font-semibold text-gray-100 truncate">{company.name}</h3>
          <span className={company.status ? 'badge-success mt-1' : 'badge-danger mt-1'}>
            {company.status ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <div className="space-y-2 text-sm text-gray-400">
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="w-4 h-4 text-gray-500 shrink-0" />
          {company.website ? (
            <a
              href={company.website}
              target="_blank"
              rel="noreferrer"
              className="text-[#d4af37] hover:text-[#e8c860] truncate"
            >
              {company.website}
            </a>
          ) : (
            <span>No website</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-gray-500" />
          <span>{new Date(company.createdAt).toLocaleDateString(language, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onEdit(company)}
          className="btn-secondary text-xs px-3 py-2 inline-flex items-center gap-1.5"
          disabled={deleting}
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>

        <button
          type="button"
          onClick={() => onDelete(company)}
          className="px-3 py-2 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs inline-flex items-center gap-1.5"
          disabled={deleting}
        >
          <Trash2 className="w-3.5 h-3.5" />
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </article>
  );
}
