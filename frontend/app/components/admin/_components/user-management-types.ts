export interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  status: "active" | "suspended" | "inactive";
  subscription: {
    tier: "free" | "pro" | "enterprise";
    status: "active" | "trialing" | "canceled" | "past_due";
    currentPeriodEnd?: Date;
  };
  createdAt: Date;
  lastActiveAt: Date;
  passageCount: number;
}
