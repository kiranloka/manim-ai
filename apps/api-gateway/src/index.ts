import Fastify from "fastify";

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
