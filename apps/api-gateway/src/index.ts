import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import bcrypt from "bcrypt";
import cookie from "@fastify/cookie";
import dotenv from "dotenv";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

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

  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  await fastify.register(cookie);
};

const server = Fastify({
  logger: true,
});

server.get("/", (request, reply) => {
  return { hello: "world" };
});

const start = async () => {
  try {
    await server.listen({ port: 3001 });
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
};

start();
