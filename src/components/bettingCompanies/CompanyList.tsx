import { useMemo, useState } from 'react';
import type { BettingCompany, BettingCompanyFilters } from '@/lib/bettingCompanyTypes';
import { CompanyCard } from '@/components/bettingCompanies/CompanyCard';
import { Search, SlidersHorizontal } from 'lucide-react';

interface CompanyListProps {
  companies: BettingCompany[];
  loading: boolean;
  deletingCompanyId: string | null;
  onEdit: (company: BettingCompany) => void;
  onDelete: (company: BettingCompany) => void;
}

const PAGE_SIZE = 8;

function sortCompanies(companies: BettingCompany[], sort: BettingCompanyFilters['sort']): BettingCompany[] {
  const next = [...companies];

  if (sort === 'az') {
    return next.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (sort === 'za') {
    return next.sort((a, b) => b.name.localeCompare(a.name));
  }

  if (sort === 'oldest') {
    return next.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  return next.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function CompanyList({
  companies,
  loading,
  deletingCompanyId,
  onEdit,
  onDelete,
}: CompanyListProps) {
  const [filters, setFilters] = useState<BettingCompanyFilters>({
    search: '',
    status: 'all',
    sort: 'az',
  });
  const [page, setPage] = useState(1);

  const filteredAndSorted = useMemo(() => {
    const filtered = companies.filter((company) => {
      const searchQuery = filters.search.trim().toLowerCase();
      const matchesSearch =
        !searchQuery ||
        company.name.toLowerCase().includes(searchQuery) ||
        (company.website ?? '').toLowerCase().includes(searchQuery);

      const matchesStatus =
        filters.status === 'all' ||
        (filters.status === 'active' && company.status) ||
        (filters.status === 'inactive' && !company.status);

      return matchesSearch && matchesStatus;
    });

    return sortCompanies(filtered, filters.sort);
  }, [companies, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredAndSorted.slice(pageStart, pageStart + PAGE_SIZE);

  function updateFilters(next: Partial<BettingCompanyFilters>) {
    setFilters((prev) => ({ ...prev, ...next }));
    setPage(1);
  }

  return (
    <section className="card p-5 md:p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold">Betting Companies</h2>
          <p className="text-sm text-gray-400">Search, sort, and manage all registered companies.</p>
        </div>

        <div className="text-sm text-gray-400">Total: {filteredAndSorted.length}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.4fr_0.8fr_0.8fr] gap-3 mb-5">
        <label className="relative block">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            placeholder="Search by company name or website"
            className="input-field pl-9"
          />
        </label>

        <label className="relative block">
          <SlidersHorizontal className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <select
            value={filters.status}
            onChange={(e) => updateFilters({ status: e.target.value as BettingCompanyFilters['status'] })}
            className="input-field pl-9"
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </label>

        <select
          value={filters.sort}
          onChange={(e) => updateFilters({ sort: e.target.value as BettingCompanyFilters['sort'] })}
          className="input-field"
        >
          <option value="az">Sort: A-Z</option>
          <option value="za">Sort: Z-A</option>
          <option value="newest">Sort: Newest</option>
          <option value="oldest">Sort: Oldest</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="card p-5 animate-pulse">
              <div className="h-5 w-40 bg-[#1e293b] rounded mb-3" />
              <div className="h-4 w-56 bg-[#1e293b] rounded mb-2" />
              <div className="h-4 w-32 bg-[#1e293b] rounded" />
            </div>
          ))}
        </div>
      ) : pageItems.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg font-medium">No companies found</p>
          <p className="text-sm mt-1">Try adjusting your search or filter options.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pageItems.map((company) => (
              <CompanyCard
                key={company.id}
                company={company}
                deleting={deletingCompanyId === company.id}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 border-t border-[#1e293b] pt-4">
              <p className="text-sm text-gray-500">
                Showing {pageStart + 1} - {Math.min(pageStart + PAGE_SIZE, filteredAndSorted.length)} of {filteredAndSorted.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-secondary text-xs px-3 py-2"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <span className="text-sm text-gray-400">Page {currentPage} of {totalPages}</span>
                <button
                  type="button"
                  className="btn-secondary text-xs px-3 py-2"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
