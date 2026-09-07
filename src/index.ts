import { createServer } from "node:http";
import { env, isTest } from "./config/env.js";
import { logger } from "./config/logger.js";
import { connectDb, disconnectDb } from "./db/connection.js";
import { createApp } from "./app.js";
import { getPaymentProvider } from "./modules/payment/payment.provider.js";
import { getShippingProvider } from "./modules/shipping/shipping.provider.js";
import { startShippingAutomation, stopShippingAutomation } from "./modules/shipping/shipping-automation.job.js";
import { ensureSuperAdminRole } from "./modules/roles/role.service.js";

async function main() {
  await connectDb();
  await ensureSuperAdminRole();
  getPaymentProvider(); // log which provider is active at boot
  getShippingProvider();
  if (!isTest) startShippingAutomation();

  // Create the bare server first so Apollo's drain plugin can hook it.
  const server = createServer();
  const { app, apollo } = await createApp(server);
  server.on("request", app);

  server.listen(env.PORT, () => {
    logger.info(
      { url: `http://localhost:${env.PORT}/graphql`, env: env.NODE_ENV },
      "Vastukosh API listening",
    );
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down");
    stopShippingAutomation();
    await apollo.stop(); // runs the drain plugin
    await disconnectDb();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.fatal({ err }, "Fatal boot error");
  process.exit(1);
});
