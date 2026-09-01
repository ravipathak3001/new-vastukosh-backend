import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { ApolloServer } from "@apollo/server";
import { buildSchema } from "../src/graphql/schema.js";
import { buildContext, type Context } from "../src/graphql/context.js";
import { formatError } from "../src/graphql/errors.js";

let mongod: MongoMemoryServer | null = null;

export async function startTestDb(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("vastukosh_test"));
}

export async function stopTestDb(): Promise<void> {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongod?.stop();
  mongod = null;
}

export async function resetDb(): Promise<void> {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

type GqlResponse = { data?: any; errors?: { message: string; extensions?: any }[] };

/** Execute operations against a real ApolloServer in-process (no HTTP listener). */
export function makeExecutor() {
  const server = new ApolloServer<Context>({
    schema: buildSchema(),
    formatError,
    includeStacktraceInErrorResponses: false,
  });

  return async function gql(
    query: string,
    variables?: Record<string, unknown>,
    headers: Record<string, string> = {},
  ): Promise<GqlResponse> {
    const fakeReq = {
      headers: {
        authorization: headers.authorization,
        "x-locale": headers["x-locale"],
        "user-agent": "vitest",
      },
      ip: "127.0.0.1",
      cookies: {},
    };
    const fakeRes = { cookie() {}, clearCookie() {} };

    const res = await server.executeOperation(
      { query, variables },
      { contextValue: buildContext({ req: fakeReq as never, res: fakeRes as never }) },
    );

    if (res.body.kind !== "single") {
      throw new Error("expected a single result");
    }
    return res.body.singleResult as GqlResponse;
  };
}
