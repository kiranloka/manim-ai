import "dotenv/config";

import buildApp from ".";

const start = async () => {
  try {
    const app = await buildApp();
    const port = parseInt(process.env.PORT || "3001");
    const host =
      process.env.NODE_ENV === "production" ? "0.0.0.0" : "localhost";

    await app.listen({ port, host });
  } catch (error) {
    console.error("Failed to start the server: ", error);
    process.exit(1);
  }
};

start();
