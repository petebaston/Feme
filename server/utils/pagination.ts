// Best Practice: Reusable pagination utilities

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

// Best Practice: Type-safe pagination helper
export function paginate<T>(
  data: T[],
  options: PaginationOptions = {}
): PaginatedResponse<T> {
  const page = Math.max(1, options.page || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, options.limit || DEFAULT_LIMIT));
  const total = data.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const end = start + limit;

  return {
    data: data.slice(start, end),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

// Best Practice: SQL pagination helpers
export function getPaginationSQL(options: PaginationOptions = {}) {
  const page = Math.max(1, options.page || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, options.limit || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;

  return {
    limit,
    offset,
  };
}

// Best Practice: Sort helper with validation
const ALLOWED_SORT_FIELDS = ['createdAt', 'updatedAt', 'name', 'email', 'total', 'status'];

export function getSortSQL(
  sortBy: string = 'createdAt',
  sortOrder: 'asc' | 'desc' = 'desc'
): { field: string; order: 'asc' | 'desc' } {
  const field = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'createdAt';
  const order = sortOrder === 'asc' ? 'asc' : 'desc';

  return { field, order };
}

// Best Practice: Build pagination response
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  options: PaginationOptions
): PaginatedResponse<T> {
  const page = options.page || DEFAULT_PAGE;
  const limit = options.limit || DEFAULT_LIMIT;
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
