import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";
import { SubscriptionPlan } from "../models/user.model";

import "../types/fastify-jwt";
// Extend Fastify interfaces for your custom decorators
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
    requirePlan: (
      requiredPlan: SubscriptionPlan
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    // This is now typed by your FastifyJWT.user interface
    user: {
      userId: string;
      username: string;
      plan: SubscriptionPlan;
    };
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate("authenticate", async (request: any, reply: any) => {
    try {
      let token = request.cookie["auth-token"];

      if (!token) {
        const authHeader = request.header.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
          token = authHeader.substring(7);
        }
      }

      if (!token) {
        throw new Error("No token provided");
      }

      const decoded = fastify.jwt.verify(token) as any;
      request.user = {
        userId: decoded.userId,
        username: decoded.username,
        plan: decoded.plan,
      };
    } catch (error) {
      reply.code(401).send({
        error: "unauthorized",
        message: "Invalid or missing authentication token",
      });
    }
  });

  fastify.decorate("requirePlan", (requiredPlan: SubscriptionPlan) => {
    return async (request: any, reply: any) => {
      if (!request.user) {
        return reply.code(401).send({
          error: "Unauthorized",
          message: "Authentication required",
        });
      }

      const planHierarchy = {
        [SubscriptionPlan.BASIC]: 1,
        [SubscriptionPlan.INTERMEDIATE]: 2,
        [SubscriptionPlan.ADVANCED]: 3,
      } as any;

      const userPlanLevel = planHierarchy[request.user.plan];
      const requiredPlanLevel = planHierarchy[requiredPlan];

      if (userPlanLevel < requiredPlanLevel) {
        return reply.code(403).send({
          error: "Forbidden",
          message: `${requiredPlan} subscription required. Current plan : ${request.user.plan}`,
        });
      }
    };
  });
};

export default fp(authPlugin);
