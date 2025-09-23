import { MongoClient, Db } from "mongodb";
import "dotenv/config";

let client: MongoClient;
let db: Db;

export const connectDatabase = async (): Promise<Db> => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("Mongo Url is required!");
    }

    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();

    db = client.db("graphica");

    await createIndexes();
    console.log("Successfully connected to the db");

    return db;
  } catch (err) {
    console.error("Unable to connect to the database:", err);
    process.exit(1);
  }
};

const createIndexes = async () => {
  const userCollection = db.collection("users");

  await userCollection.createIndex({ username: 1 }, { unique: true });

  await userCollection.createIndex({ "subscription.plan": 1 });

  console.log("Database Indexes created");
};

export const getDatabases = (): Db => {
  if (!db) {
    console.error("Database not initialized,Call connectDatabase() first ");
  }

  return db;
};

export const closeDatabase = async (): Promise<void> => {
  if (client) {
    await client.close();
    console.log("Database exited successfully!");
  }
};
