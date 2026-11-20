import { api } from './api';
import { Alert, AlertStatus, ApiResponse } from '../types';

export interface AlertFilterParams {
  type?: string;
  severity?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export async function getAlerts(
  params: AlertFilterParams = {}
): Promise<{ alerts: Alert[]; pagination?: ApiResponse<any>['pagination'] }> {
  const res = await api.get<ApiResponse<Alert[]>>('/alerts', { params });
  return {
    alerts: res.data.data,
    pagination: res.data.pagination,
  };
}

export async function getAlertById(id: string): Promise<Alert> {
  const res = await api.get<ApiResponse<Alert>>(`/alerts/${id}`);
  return res.data.data;
}

export async function patchAlert(
  id: string,
  status: AlertStatus,
  comment?: string
): Promise<Alert> {
  const res = await api.patch<ApiResponse<Alert>>(`/alerts/${id}`, {
    status,
    comment,
  });
  return res.data.data;
}
