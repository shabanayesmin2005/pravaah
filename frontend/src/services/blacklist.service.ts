import { api } from './api';
import { BlacklistEntry, ApiResponse } from '../types';

export async function getBlacklist(): Promise<BlacklistEntry[]> {
  const res = await api.get<ApiResponse<BlacklistEntry[]>>('/blacklist');
  return res.data.data;
}

export async function addBlacklistEntry(data: {
  plate_text: string;
  reason: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  agency?: string;
}): Promise<BlacklistEntry> {
  const res = await api.post<ApiResponse<BlacklistEntry>>('/blacklist', data);
  return res.data.data;
}

export async function removeBlacklistEntry(plate: string): Promise<void> {
  await api.delete<ApiResponse<any>>(`/blacklist/${encodeURIComponent(plate)}`);
}
