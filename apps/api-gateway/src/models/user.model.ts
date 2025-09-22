import { Collection, ObjectId, WithId } from "mongodb";

import bcrypt from "bcrypt";
import { getDatabases } from "../plugins/database.plugin";

export enum SubscriptionPlan {
  BASIC = "basic",
  INTERMEDIATE = "intermediate",
  ADVANCED = "advanced",
}

export interface ISubscriptionPlan {
  plan: SubscriptionPlan;
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  videosGenerated: number;
  maxVideosPerMonth: number;
}

export interface IUser {
  _id?: ObjectId;
  username: string;
  password: string;
  name: string;
  subscription: ISubscriptionPlan;
  createdAt: Date;
  updatedAt: Date;
  lastLoggedIn?: Date;
}

export interface createUserData {
  username: string;
  password: string;
  name: string;
  plan: ISubscriptionPlan;
}

export interface UserResponse {
  _id?: string;
  username: string;
  name: string;
  subscription: ISubscriptionPlan;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export const PLAN_LIMITS = {
  [SubscriptionPlan.BASIC]: {
    maxVideosPerMonth: 5,
    maxComplexity: "basic" as const,
    maxDuration: 30, // seconds
  },
  [SubscriptionPlan.INTERMEDIATE]: {
    maxVideosPerMonth: 20,
    maxComplexity: "intermediate" as const,
    maxDuration: 60, // seconds
  },
  [SubscriptionPlan.ADVANCED]: {
    maxVideosPerMonth: 100,
    maxComplexity: "advanced" as const,
    maxDuration: 120, // seconds
  },
};

export class UserModel {
  private collection: Collection<IUser>;
  private readonly saltRounds;

  constructor() {
    const db = getDatabases();
    this.collection = db.collection<IUser>("users");
    this.saltRounds = 12;
  }

  async create(userData: createUserData): Promise<UserResponse> {
    const existingUser = await this.collection.findOne({
      username: userData.username,
    });
    if (existingUser) {
      throw new Error("User with this username already exists");
    }
    const hashedPassword = await bcrypt.hash(
      userData.password,
      this.saltRounds
    );

    const plan = userData.plan.plan || SubscriptionPlan.BASIC;
    const now = new Date();

    const newUser: Omit<IUser, "_id"> = {
      username: userData.username,
      password: hashedPassword,
      name: userData.name,
      subscription: {
        plan,
        startDate: now,
        isActive: true,
        videosGenerated: 0,
        maxVideosPerMonth: PLAN_LIMITS[plan].maxVideosPerMonth,
      },
      createdAt: now,
      updatedAt: now,
    };

    try {
      const result = await this.collection.insertOne(newUser as IUser);
      return this.toUserResponse({
        ...newUser,
        _id: result.insertedId,
      } as WithId<IUser>);
    } catch (error: any) {
      if (error.code === 11000) {
        throw new Error("Username already exists");
      }
      throw new Error("Unable to create user : ", error);
    }
  }

  async findByUsername(username: string): Promise<WithId<IUser> | null> {
    return await this.collection.findOne({ username });
  }

  async findById(id: string): Promise<UserResponse | null> {
    try {
      const user = await this.collection.findOne({ _id: new ObjectId(id) });
      return user ? this.toUserResponse(user) : null;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  async verifyPassword(
    user: WithId<IUser>,
    password: string
  ): Promise<boolean> {
    return await bcrypt.compare(password, user.password);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.collection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );
  }

  async canGenerateVideos(
    userId: string,
    complexity: string
  ): Promise<{ canGenerate: boolean; reason?: string; videosLeft?: number }> {
    const user = await this.collection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      throw new Error("User not found!");
    }

    if (!user.subscription.isActive) {
      throw new Error("Your subscription is inactive!");
    }

    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const videosThisMonth = user.subscription.videosGenerated;
    const maxVideos = user.subscription.maxVideosPerMonth;

    if (videosThisMonth > maxVideos) {
      return {
        canGenerate: false,
        reason: "Your montly limit has reached!",
        videosLeft: 0,
      };
    }

    const planLimits = PLAN_LIMITS[user.subscription.plan];
    const complexityOrder = ["basic", "intermediate", "advanced"];
    const userMaxComplexity = complexityOrder.indexOf(planLimits.maxComplexity);
    const requestedComplexity = complexityOrder.indexOf(complexity);

    if (requestedComplexity > userMaxComplexity) {
      return {
        canGenerate: false,
        reason: `Complexity ${complexity} not allowed for ${user.subscription.plan}`,
      };
    }

    return {
      canGenerate: true,
      videosLeft: maxVideos - videosThisMonth,
    };
  }

  async increaseVideoCount(userId: string): Promise<void> {
    await this.collection.updateOne(
      { _id: new Object(userId) },
      {
        $inc: { "subscription.videosGenerated": 1 },
        $set: { updatedAt: new Date() },
      }
    );
  }

  async updateSubscription(
    userId: string,
    newPlan: SubscriptionPlan
  ): Promise<UserResponse | null> {
    const planLimit = PLAN_LIMITS[newPlan];

    const result = this.collection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          "subscription.plan": newPlan,
          "subscription.maxVideosPerMonth": planLimit.maxVideosPerMonth,
          "subscription.isActive": true,
          updatedAt: new Date(),
        },
      }
    );

    if ((await result).matchedCount === 0) {
      return null;
    }

    return await this.findById(userId);
  }

  private toUserResponse(user: WithId<IUser>): UserResponse {
    return {
      _id: user._id.toString(),
      username: user.username,
      name: user.name,
      subscription: user.subscription,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoggedIn,
    };
  }
}
