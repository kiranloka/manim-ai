import { SubscriptionPlan } from "../models/user.model";
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      userId: string;
      username: string;
      plan: SubscriptionPlan;
    };
    // ✅ Don't declare user at all, let Fastify handle it
  }
}

// ✅ Extend FastifyRequest separately
declare module "fastify" {
  interface FastifyRequest {
    user?: {
      userId: string;
      username: string;
      plan: SubscriptionPlan;
    };
  }
}
