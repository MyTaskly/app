import axiosInstance from './axiosInstance';

export interface UserPlan {
  plan: string;
  text_messages_limit: number;
  text_messages_used: number;
  voice_requests_limit: number;
  voice_requests_used: number;
  reset_date: string; // ISO 8601 date, e.g. "2026-05-01"
}

/**
 * Fetches the current user's plan and monthly usage from GET /auth/me/plan.
 * Auth token is injected automatically by the axios interceptor.
 */
export async function getUserPlan(): Promise<UserPlan> {
  const response = await axiosInstance.get<UserPlan>('/auth/me/plan');
  return response.data;
}

/** Returns true when the plan should be treated as unlimited (ENTERPRISE). */
export function isUnlimitedPlan(limit: number): boolean {
  return limit >= 9999;
}
