import { api } from './api';
import { Trajectory, ApiResponse } from '../types';

export async function getVehicleTrajectory(plate: string): Promise<Trajectory> {
  const res = await api.get<ApiResponse<Trajectory>>(`/vehicles/${encodeURIComponent(plate)}/trajectory`);
  return res.data.data;
}

export async function getVehicleDetections(
  plate: string,
  page = 1,
  limit = 50
): Promise<{ detections: any[]; pagination?: ApiResponse<any>['pagination'] }> {
  const res = await api.get<ApiResponse<any[]>>(`/vehicles/${encodeURIComponent(plate)}/detections`, {
    params: { page, limit },
  });
  return {
    detections: res.data.data,
    pagination: res.data.pagination,
  };
}
