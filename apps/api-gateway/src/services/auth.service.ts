import { FastifyInstance } from "fastify";
import {
  UserModel,
  createUserData,
  UserResponse,
  SubscriptionPlan,
} from "../models/user.model";

export interface SignupData extends createUserData {}

export interface SigninData {
  username: string;
  password: string;
}

export class AuthService {
  private userModel: UserModel;

  constructor(private fastify: FastifyInstance) {
    this.userModel = new UserModel();
  }

  async signup(
    userData: SignupData
  ): Promise<{ user: UserResponse; token: string }> {
    try {
      const user = await this.userModel.create({
        ...userData,
        plan: userData.plan || SubscriptionPlan.BASIC,
      });

      const token = this.fastify.jwt.sign(
        {
          userId: user._id as string,
          username: user.username,
          plan: user.subscription.plan,
        },
        { expiresIn: "7d" }
      );

      return { user, token };
    } catch (error) {
      throw error;
    }
  }

  async signin(
    credentials: SigninData
  ): Promise<{ user: UserResponse; token: string }> {
    const { username, password } = credentials;

    const user = await this.userModel.findByUsername(username);

    if (!user) {
      throw new Error("Invalid credentials");
    }

    const isPasswordValid = this.userModel.verifyPassword(user, password);

    if (!isPasswordValid) {
      throw new Error("Password is not valid!");
    }

    await this.userModel.updateLastLogin(user._id.toString());

    const token = this.fastify.jwt.sign(
      {
        userId: user._id.toString(),
        username: user.username,
        plan: user.subscription.plan,
      },

      { expiresIn: "7d" }
    );

    const UserResponse = await this.userModel.findById(user._id.toString());

    return { user: UserResponse!, token };
  }

  async verifyToken(
    token: string
  ): Promise<{ userId: string; username: string; plan: SubscriptionPlan }> {
    try {
      const decoded = this.fastify.jwt.verify(token) as any;

      return {
        userId: decoded.userId,
        username: decoded.username,
        plan: decoded.plan,
      };
    } catch (error) {
      console.error(error);
      throw new Error("Invalid token");
    }
  }

  async getUserById(userId: string): Promise<UserResponse | null> {
    return await this.userModel.findById(userId);
  }

  async checkVideoPermission(userId: string, complexity: string) {
    return await this.userModel.canGenerateVideos(userId, complexity);
  }

  async incrementUserVideoCount(userId: string): Promise<void> {
    await this.userModel.increaseVideoCount(userId);
  }
}
