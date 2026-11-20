import { api } from './api';
import { PlateSearchResult, ApiResponse } from '../types';

export async function searchPlates(
  q: string,
  page = 1,
  limit = 20
): Promise<{ plates: PlateSearchResult[]; pagination?: ApiResponse<any>['pagination'] }> {
  const res = await api.get<ApiResponse<PlateSearchResult[]>>('/plates/search', {
    params: { q, page, limit },
  });
  return {
    plates: res.data.data,
    pagination: res.data.pagination,
  };
}
