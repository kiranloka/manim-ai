import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

import { authRoutes } from "../controllers/auth.controller";

const routesPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health", async () => {
    return {
      status: "Ok",
      timeStamp: new Date().toISOString(),
      service: "manim-project",
    };
  });

  await fastify.register(authRoutes, { prefix: "/api/auth" });
};

export default fp(routesPlugin);
