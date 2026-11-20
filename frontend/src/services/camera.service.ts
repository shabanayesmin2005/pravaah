import { api } from './api';
import { Camera, ApiResponse } from '../types';

export async function getCameras(): Promise<Camera[]> {
  const res = await api.get<ApiResponse<Camera[]>>('/cameras');
  return res.data.data;
}

export async function getCameraById(id: string): Promise<Camera> {
  const res = await api.get<ApiResponse<Camera>>(`/cameras/${id}`);
  return res.data.data;
}
