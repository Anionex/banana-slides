/**
 * Announcements API - public endpoints for fetching announcements
 */
import { apiClient } from './client';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export const getActiveAnnouncements = () =>
  apiClient.get<{ success: boolean; data: Announcement[] }>('/api/announcements');
