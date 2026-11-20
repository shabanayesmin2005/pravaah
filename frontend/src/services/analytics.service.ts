import { api } from './api';
import { TrafficSummary, CongestionItem, TrafficAggregate, ApiResponse } from '../types';

export async function getTrafficSummary(): Promise<TrafficSummary> {
  const res = await api.get<ApiResponse<TrafficSummary>>('/analytics/summary');
  return res.data.data;
}

export async function getCongestion(): Promise<CongestionItem[]> {
  const res = await api.get<ApiResponse<CongestionItem[]>>('/analytics/congestion');
  return res.data.data;
}

export async function getTrafficAggregates(params: {
  camera_id?: string;
  from?: string;
  to?: string;
  window_minutes?: number;
  page?: number;
  limit?: number;
} = {}): Promise<{ aggregates: TrafficAggregate[]; pagination?: ApiResponse<any>['pagination'] }> {
  const res = await api.get<ApiResponse<TrafficAggregate[]>>('/analytics/traffic', { params });
  return {
    aggregates: res.data.data,
    pagination: res.data.pagination,
  };
}
