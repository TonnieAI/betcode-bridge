import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, CheckCircle, XCircle } from 'lucide-react';
import { CompanyForm } from '@/components/bettingCompanies/CompanyForm';
import { CompanyList } from '@/components/bettingCompanies/CompanyList';
import { DeleteConfirmation } from '@/components/bettingCompanies/DeleteConfirmation';
import type {
  BettingCompany,
  CreateBettingCompanyInput,
  UpdateBettingCompanyInput,
} from '@/lib/bettingCompanyTypes';
import {
  createBettingCompany,
  deleteBettingCompany,
  getBettingCompanies,
  invalidateBettingCompanyLogoMap,
  updateBettingCompany,
} from '@/services/bettingCompanyService';

export function AdminBettingCompanies() {
  const [companies, setCompanies] = useState<BettingCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null);
  const [editingCompany, setEditingCompany] = useState<BettingCompany | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<BettingCompany | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeCount = useMemo(() => companies.filter((company) => company.status).length, [companies]);

  useEffect(() => {
    void refreshCompanies();
  }, []);

  useEffect(() => {
    if (!successMessage && !errorMessage) return;

    const timer = window.setTimeout(() => {
      setSuccessMessage(null);
      setErrorMessage(null);
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [successMessage, errorMessage]);

  async function refreshCompanies() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const data = await getBettingCompanies();
      setCompanies(data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load betting companies.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(payload: CreateBettingCompanyInput | UpdateBettingCompanyInput) {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      if (editingCompany) {
        const updatedCompany = await updateBettingCompany(editingCompany.id, payload as UpdateBettingCompanyInput);
        setCompanies((prev) => prev.map((company) => (company.id === updatedCompany.id ? updatedCompany : company)));
        setEditingCompany(null);
        setSuccessMessage('Betting company updated successfully.');
      } else {
        const createdCompany = await createBettingCompany(payload as CreateBettingCompanyInput);
        setCompanies((prev) => [createdCompany, ...prev]);
        setSuccessMessage('Betting company added successfully.');
      }

      invalidateBettingCompanyLogoMap();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save betting company.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteCandidate) return;

    setDeletingCompanyId(deleteCandidate.id);
    setErrorMessage(null);

    try {
      await deleteBettingCompany(deleteCandidate.id);
      setCompanies((prev) => prev.filter((company) => company.id !== deleteCandidate.id));
      setSuccessMessage('Betting company deleted successfully.');
      setDeleteCandidate(null);
      if (editingCompany?.id === deleteCandidate.id) {
        setEditingCompany(null);
      }
      invalidateBettingCompanyLogoMap();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete betting company.');
    } finally {
      setDeletingCompanyId(null);
    }
  }

  return (
    <div className="pt-16 min-h-screen">
      <div className="section-padding py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Building2 className="w-7 h-7 gold-text" />
              Betting Companies
            </h1>
            <p className="text-gray-400 mt-1">Manage sportsbook records, logos, and active status.</p>
          </div>

          <Link to="/admin" className="btn-secondary text-sm inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Admin Panel
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-4">
            <p className="text-xs text-gray-500">Total companies</p>
            <p className="text-2xl font-bold mt-1">{companies.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500">Active companies</p>
            <p className="text-2xl font-bold mt-1 text-green-400">{activeCount}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500">Inactive companies</p>
            <p className="text-2xl font-bold mt-1 text-red-400">{companies.length - activeCount}</p>
          </div>
        </div>

        {successMessage && (
          <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300 flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            {errorMessage}
          </div>
        )}

        <CompanyForm
          company={editingCompany}
          submitting={submitting}
          onSubmit={handleSubmit}
          onCancelEdit={() => setEditingCompany(null)}
        />

        <CompanyList
          companies={companies}
          loading={loading}
          deletingCompanyId={deletingCompanyId}
          onEdit={(company) => {
            setEditingCompany(company);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onDelete={(company) => setDeleteCandidate(company)}
        />
      </div>

      <DeleteConfirmation
        open={Boolean(deleteCandidate)}
        company={deleteCandidate}
        loading={Boolean(deletingCompanyId)}
        onCancel={() => setDeleteCandidate(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
