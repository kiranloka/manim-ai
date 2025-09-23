import Fastify from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";

import authPlugin from "./plugins/auth.plugin";
import routesPlugin from "./plugins/routes.plugin";

import { connectDatabase } from "./plugins/database.plugin";
const buildApp = async () => {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      transport:
        process.env.NODE_ENV === "development"
          ? { target: "pino-pretty" }
          : undefined,
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  await fastify.register(cookie);

  await connectDatabase();

  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET!,
    cookie: {
      cookieName: "auth-token",
      signed: false,
    },
  });

  await fastify.register(authPlugin);
  await fastify.register(routesPlugin);

  return fastify;
};

export default buildApp;
