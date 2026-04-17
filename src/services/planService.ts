// MyTaskly API Changes — 2026-04-17
// GET /auth/me · POST /billing/cancel

import axiosInstance from './axiosInstance';

export interface UserSubscription {
  effective_plan: string;
  status: 'free' | 'active' | 'cancelled' | 'expired';
  current_period_end: string | null;
  chat_text_daily_limit: number | null;    // null = unlimited
  chat_text_monthly_limit: number | null;  // null = unlimited
  chat_voice_enabled: boolean;
  chat_voice_daily_limit: number | null;   // null = unlimited (currently always null)
  chat_voice_monthly_limit: number | null; // null = unlimited
  ai_model: string;
  max_categories: number | null;           // null = unlimited
}

interface AuthMeResponse {
  id: string;
  email: string;
  name: string;
  subscription: UserSubscription;
}

// MyTaskly API Changes — 2026-04-16
// POST /billing/cancel

export interface BillingCancelResponse {
  effective_plan: string;
  status: 'cancelled';
  current_period_end: string;
}

// Backward-compat alias — use UserSubscription for new code
export type UserPlan = UserSubscription;

/**
 * Fetches the current user's subscription info from GET /auth/me.
 * Auth token is injected automatically by the axios interceptor.
 */
export async function getUserPlan(): Promise<UserSubscription> {
  const response = await axiosInstance.get<AuthMeResponse>('/auth/me');
  return response.data.subscription;
}

/**
 * Cancels the active subscription. Access remains until current_period_end.
 * Throws with 400 if no active subscription exists.
 */
export async function cancelSubscription(): Promise<BillingCancelResponse> {
  const response = await axiosInstance.post<BillingCancelResponse>('/billing/cancel');
  return response.data;
}

/** Returns true when a limit should be treated as unlimited. */
export function isUnlimitedPlan(limit: number | null | undefined): boolean {
  return limit === null || limit === undefined || limit >= 9999;
}
