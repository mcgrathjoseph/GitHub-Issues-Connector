import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

// Joe: simple dev-only ping to verify function registration
export async function pingJoe(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {

  context.log("Joe ping function invoked");

  return {
    status: 200,
    jsonBody: {
      message: "✅ Joe ping OK",
      environment: process.env.AZURE_FUNCTIONS_ENVIRONMENT,
      timestamp: new Date().toISOString(),
    },
  };
}

// Joe: register ONLY in Development / local mode
if (
  process.env.AZURE_FUNCTIONS_ENVIRONMENT === "Development" ||
  process.env.NO_AUTH_LOCAL === "true"
) {
  app.http("pingJoe", {
    methods: ["GET"],
    authLevel: "anonymous",
    handler: pingJoe,
  });
}