export interface BettingCompany {
  id: string;
  name: string;
  website: string | null;
  logoUrl: string | null;
  status: boolean;
  createdAt: string;
}

export interface CreateBettingCompanyInput {
  name: string;
  website?: string | null;
  logoUrl?: string | null;
  status?: boolean;
}

export interface UpdateBettingCompanyInput {
  name?: string;
  website?: string | null;
  logoUrl?: string | null;
  status?: boolean;
}

export interface BettingCompanyFilters {
  search: string;
  status: 'all' | 'active' | 'inactive';
  sort: 'az' | 'za' | 'newest' | 'oldest';
}
