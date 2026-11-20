import { api } from './api';
import { AuditLogEntry, ApiResponse } from '../types';

export interface AuditLogQueryParams {
  action?: string;
  email?: string;
  target?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export async function getAuditLogs(
  params: AuditLogQueryParams = {}
): Promise<{ logs: AuditLogEntry[]; pagination?: ApiResponse<any>['pagination'] }> {
  const res = await api.get<ApiResponse<AuditLogEntry[]>>('/audit-logs', { params });
  return {
    logs: res.data.data,
    pagination: res.data.pagination,
  };
}
