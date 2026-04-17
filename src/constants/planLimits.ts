export interface PlanLimits {
  chatTextDaily: number;
  chatTextMonthly: number;
  chatVoiceDaily: number;
  chatVoiceMonthly: number;
  aiModel: 'base' | 'advanced';
  maxCategories: number;
}

export interface Plan {
  id: 'free' | 'pro' | 'premium';
  name: string;
  limits: PlanLimits;
  productId?: string;
}

export const PLAN_PRODUCT_IDS: Record<'free' | 'pro' | 'premium', string | undefined> = {
  free: undefined,
  pro: 'mytaskly_pro_monthly',
  premium: 'mytaskly_premium_monthly',
};

export const PLANS: Record<'free' | 'pro' | 'premium', Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    limits: {
      chatTextDaily: 20,
      chatTextMonthly: 130,
      chatVoiceDaily: Infinity,
      chatVoiceMonthly: 20,
      aiModel: 'base',
      maxCategories: 5,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    productId: PLAN_PRODUCT_IDS.pro,
    limits: {
      chatTextDaily: 50,
      chatTextMonthly: 250,
      chatVoiceDaily: Infinity,
      chatVoiceMonthly: 50,
      aiModel: 'advanced',
      maxCategories: Infinity,
    },
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    productId: PLAN_PRODUCT_IDS.premium,
    limits: {
      chatTextDaily: Infinity,
      chatTextMonthly: 400,
      chatVoiceDaily: Infinity,
      chatVoiceMonthly: 150,
      aiModel: 'advanced',
      maxCategories: Infinity,
    },
  },
};
