import { app, HttpRequest, HttpResponseInit, InvocationContext, Timer } from "@azure/functions";
import {
  clearConnectionItems,
  deleteConnection,
  ensureConnection,
  isConnectionReady,
  setSearchSettings,
} from "../connection";
import { ensureSchema } from "../schema";
import { ingestContent } from "../ingest";
import { initConfig } from "../config";
import { getLastCrawl, saveLastCrawl } from "../services/crawlService";

let fullCrawlInProgress = false;
let retractInProgress = false;


/////////////////////////////////////////////////////////////////////////
//joenote: joeDedug2 Play icon click.. then this open in browser: http://localhost:7071/api/pingJoe
//joenote: azure app.timers skip re ai ..see below app.timer(  ...
//joenote: hmm I could install but not run via calling azurite.  Install was:     npm install -g azurite
//joenote: signed certificate ps1 issue or somin again... tho it did use installed one under
//           C:\Dev3\My Agent__________node-v18.20.8-win-x64\node-v18.20.8-win-x64
const isDevelopment_Joe =
  process.env.AZURE_FUNCTIONS_ENVIRONMENT === "Development" ||
  process.env.NO_AUTH_LOCAL === "true";
/////////////////////////////////////////////////////////////////////////



/**
 * The deployConnection function is responsible for ensuring the connection, schema, and search settings are in place.
 * It also starts the ingestion of the content.
 * @param {Timer} timer - The timer object
 * @param {InvocationContext} context - The context object of the current invocation
 * @returns {Promise<void>}
 */
export async function deployConnection(timer: Timer, context: InvocationContext): Promise<void> {
  // Initializes the configuration for the current invocation
  const config = initConfig(context);
  const initialTimestamp = Date.now();

  // Creates the connection
  const connectionResult = await ensureConnection(config, initialTimestamp);
  if (connectionResult) {
    // Creates the schema
    await ensureSchema(config);

    // Updates the search settings with the result template
    await setSearchSettings(config);

    // Starts a full crawl
    await fullCrawl(timer, context);
  }
}

/**
 * The fullCrawl function is responsible for ingesting all the content from the source system
 * @param {Timer} timer - The timer object
 * @param {InvocationContext} context - The context object of the current invocation
 * @returns {Promise<void>}
 */
export async function fullCrawl(timer: Timer, context: InvocationContext): Promise<void> {
  // Initializes the configuration for the current invocation
  const config = initConfig(context);

  const connectionReady = await isConnectionReady(config);
  if (!connectionReady) {
    context.warn("Connection not ready yet...");
    return;
  }

  fullCrawlInProgress = true;
  const lastCrawl = await getLastCrawl();
  const nextCrawl = new Date();

  context.log("Starting full crawl...");
  // Starts the full ingestion of the contents
  // If the function is running locally, it will use the last crawl date from the file system as the starting point
  // Delete the last crawl file to force a full crawl
  await ingestContent(
    config,
    process.env.AZURE_FUNCTIONS_ENVIRONMENT === "Development" ? lastCrawl : undefined
  );
  await saveLastCrawl(nextCrawl);
  fullCrawlInProgress = false;
  context.log("Finished full crawl...");
}

/**
 * The incrementalCrawl function is responsible for ingesting the content that has changed since the last sync
 * @param {Timer} timer - The timer object
 * @param {InvocationContext} context - The context object of the current invocation
 * @returns {Promise<void>}
 */
export async function incrementalCrawl(timer: Timer, context: InvocationContext): Promise<void> {
  // Initializes the configuration for the current invocation
  const config = initConfig(context);

  const connectionReady = await isConnectionReady(config);
  if (!connectionReady) {
    context.warn("Connection not ready yet...");
    return;
  }

  if (fullCrawlInProgress) {
    context.warn("Full crawl in progress, skipping incremental...");
    return;
  }

  if (retractInProgress) {
    context.warn("Retract in progress, skipping incremental...");
    return;
  }

  context.log("Starting incremental crawl...");
  const nextCrawl = new Date();
  const lastCrawl = await getLastCrawl();
  // Starts the delta ingestion of the contents

  await ingestContent(config, lastCrawl);
  await saveLastCrawl(nextCrawl);
  context.log("Finished incremental crawl...");
}

/**
 * The deleteConnection function is responsible for ensuring the connection, schema, and search settings are in place.
 * It also starts the ingestion of the content.
 * @param {HttpRequest} request - The request object
 * @param {InvocationContext} context - The context object of the current invocation
 * @returns {Promise<void>}
 */
export async function retractConnection(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Initializes the configuration for the current invocation
  const config = initConfig(context);

  const connectionReady = await isConnectionReady(config);
  if (!connectionReady) {
    context.warn("Connection not ready yet...");
    return;
  }

  fullCrawlInProgress = false;
  retractInProgress = false;

  // Deletes the connection
  const initialTimestamp = Date.now();
  await deleteConnection(config, initialTimestamp);
  await saveLastCrawl(new Date(0));

  retractInProgress = false;

  return null;
}

/**
 * The clearConnection function is responsible for clearing the connection items
 * @param {HttpRequest} request - The request object
 * @param {InvocationContext} context - The context object of the current invocation
 * @returns {Promise<void>}
 */
export async function clearConnection(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Initializes the configuration for the current invocation
  const config = initConfig(context);

  const connectionReady = await isConnectionReady(config);
  if (!connectionReady) {
    context.warn("Connection not ready yet...");
    return;
  }

  if (fullCrawlInProgress) {
    context.warn("Full crawl in progress...");
    return;
  }

  await clearConnectionItems(config);
  await saveLastCrawl(new Date(0));

  return null;
}

const currentDate = new Date();
const cronExpression = `0 0 0 ${currentDate.getUTCDate()} ${currentDate.getUTCMonth() + 1} *`;


/////////////////////   I just put three app.timer guys in an If block
/////////////////////   I just put three app.timer guys in an If block
/////////////////////   I just put three app.timer guys in an If block
if (!isDevelopment_Joe) {

          app.timer("deployConnection", {
            // Runs every year
            schedule: cronExpression,
            runOnStartup: process.env.AZURE_FUNCTIONS_ENVIRONMENT === "Development",
            handler: deployConnection,
          });

          app.timer("fullCrawl", {
            // Runs every day at midnight
            schedule: "0 0 * * *",
            runOnStartup: false,
            handler: fullCrawl,
          });

          app.timer("incrementalCrawl", {
            // Runs every minute
            schedule: "* * * * *",
            runOnStartup: false,
            handler: incrementalCrawl,
          });

} // !isDevelopment_Joe   .. app.timer stuff
/////////////////////   I just put three app.timer guys in an If block
/////////////////////   I just put three app.timer guys in an If block
/////////////////////   I just put three app.timer guys in an If block


if (process.env.AZURE_FUNCTIONS_ENVIRONMENT === "Development") {
  app.http("retract", {
    methods: ["POST"],
    authLevel: "anonymous",
    handler: retractConnection,
  });
}

if (process.env.AZURE_FUNCTIONS_ENVIRONMENT === "Development") {
  app.http("clear", {
    methods: ["POST"],
    authLevel: "anonymous",
    handler: clearConnection,
  });
}
