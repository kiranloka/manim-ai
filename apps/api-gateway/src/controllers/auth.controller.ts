import { FastifyPluginAsync } from "fastify";
import { AuthService } from "../services/auth.service";

const signupSchema = {
  body: {
    type: "object",
    required: ["username", "password", "name"],
    properties: {
      username: {
        type: "string",
        minLength: 3,
        maxLength: 50,
        pattern: "^[a-zA-Z0-9_]+$",
      },

      password: {
        type: "string",
        minLength: 6,
        maxLength: 100,
      },
      name: {
        type: "string",
        minLength: 1,
        maxLength: 100,
      },
      plan: {
        type: "string",
        enum: ["basic", "intermediate", "advanced"],
        default: "basic",
      },
    },
  },
};

const signinSchema = {
  body: {
    type: "object",
    required: ["username", "password"],
    properties: {
      username: { type: "string" },
      password: { type: "string" },
    },
  },
};

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const authService = new AuthService(fastify);

  fastify.post("/signup", { schema: signupSchema }, async (request, reply) => {
    try {
      const result = await authService.signup(request.body as any);

      reply.setCookie("auth-token", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });

      return {
        success: true,
        user: result.user,
        message: "Account created successfully",
      };
    } catch (error) {
      reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : "Signup failed",
      });
    }
  });

  fastify.post("/signin", { schema: signinSchema }, async (request, reply) => {
    try {
      const result = await authService.signin(request.body as any);

      reply.setCookie("auth-token", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });

      return {
        success: true,
        user: result.user,
        message: "Login successful",
      };
    } catch (error) {
      reply.code(401).send({
        success: false,
        error: error instanceof Error ? error.message : "Login failed",
      });
    }
  });

  fastify.get(
    "/me",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const user = await authService.getUserById(request.user!.userId);

      return {
        success: true,
        user,
      };
    }
  );

  fastify.post(
    "/check-video-permission",
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: "object",
          required: ["complexity"],
          properties: {
            complexity: {
              type: "string",
              enum: ["basic", "intermediate", "advanced"],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { complexity } = request.body as any;

      const permission = await authService.checkVideoPermission(
        request.user!.userId,
        complexity
      );

      return {
        success: true,
        permission,
      };
    }
  );

  fastify.post("/logout", async (request, reply) => {
    reply.clearCookie("auth-token");
    return {
      success: true,
      message: "Logged out successfully",
    };
  });
};
