import type { Server } from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { ApolloServerPluginLandingPageDisabled } from "@apollo/server/plugin/disabled";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { env, isDev, isProd } from "./config/env.js";
import { logger } from "./config/logger.js";
import { buildSchema } from "./graphql/schema.js";
import { buildContext, type Context } from "./graphql/context.js";
import { formatError } from "./graphql/errors.js";
import { healthRouter } from "./shared/http/health.js";
import { paymentRouter } from "./modules/payment/payment.routes.js";
import { shippingRouter } from "./modules/shipping/shipping.routes.js";

export type CreatedApp = {
  app: express.Express;
  apollo: ApolloServer<Context>;
};

/**
 * Assemble the Express app + Apollo Server. `httpServer` (when given) lets the
 * drain plugin finish in-flight requests on shutdown.
 */
export async function createApp(httpServer?: Server): Promise<CreatedApp> {
  const app = express();
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: isProd ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
    }),
  );
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/healthz" } }));
  app.use(cookieParser());

  // Payment webhooks need the raw body — mount before the JSON parser.
  app.use(paymentRouter);
  app.use(shippingRouter);
  app.use(healthRouter);

  const apollo = new ApolloServer<Context>({
    schema: buildSchema(),
    introspection: !isProd,
    includeStacktraceInErrorResponses: isDev,
    formatError,
    plugins: [
      ...(httpServer ? [ApolloServerPluginDrainHttpServer({ httpServer })] : []),
      isProd
        ? ApolloServerPluginLandingPageDisabled()
        : ApolloServerPluginLandingPageLocalDefault({ embed: true }),
    ],
  });
  await apollo.start();

  const graphqlLimiter = rateLimit({
    windowMs: 60_000,
    limit: isProd ? 120 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(
    "/graphql",
    graphqlLimiter,
    express.json({ limit: "1mb" }),
    expressMiddleware(apollo, {
      context: async ({ req, res }) => buildContext({ req, res }),
    }),
  );

  app.get("/", (_req, res) => {
    res.json({ name: "vastukosh-api", graphql: "/graphql", health: "/healthz" });
  });

  return { app, apollo };
}
