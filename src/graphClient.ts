import { ClientSecretCredential } from "@azure/identity";
import { Client, MiddlewareFactory } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";
import { LongRunningOperationMiddleware } from "./longRunningOperationMiddleware";




// Joe: PnP-style local / dev detection    
const isDevelopment_Joe =
  process.env.AZURE_FUNCTIONS_ENVIRONMENT === "Development" ||
  process.env.NO_AUTH_LOCAL === "true";





const delayInterval = 60_000; // 60 seconds


/////////////////////////////////////////////////
/////////////////////////////////////////////////
/////////////////////////////////////////////////
/////////////////////////////////////////////////
/**
 * Returns a new instance of the Microsoft Graph client.
 * @returns A new instance of the Microsoft Graph client.
 */
/////////////////////////////////////////////////
/////////////////////////////////////////////////
/////////////////////////////////////////////////
// Joe: PnP-style local / dev detection    export function getClient(): Client {
// Joe: PnP-style local / dev detection    const credential = new ClientSecretCredential(
// Joe: PnP-style local / dev detection    process.env.AZURE_TENANT_ID!,
// Joe: PnP-style local / dev detection    process.env.AZURE_CLIENT_ID!,
// Joe: PnP-style local / dev detection    process.env.AZURE_CLIENT_SECRET!
// Joe: PnP-style local / dev detection    );
/////////////////////////////////////////////////
/////////////////////////////////////////////////
/////////////////////////////////////////////////
/////////////export function getClient(): Client {
/////////////  // Joe: PnP-style dev guard
/////////////  if (isDevelopment_Joe) {
/////////////    throw new Error(
/////////////      "Joe dev mode: Microsoft Graph client is disabled (no Azure auth)."
/////////////    );
/////////////  }
/////////////////////////////////////////////////
/////////////////////////////////////////////////  hmm:    Client | null  
/////////////////////////////////////////////////  hmm:    return null;
export function getClient(): Client | null {

  // Joe: PnP-style dev guard
  if (isDevelopment_Joe) {
    return null; // Joe: allow host startup, block Graph usage
  }

  const credential = new ClientSecretCredential(
    process.env.AZURE_TENANT_ID!,
    process.env.AZURE_CLIENT_ID!,
    process.env.AZURE_CLIENT_SECRET!
  );

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });

  const middleware = MiddlewareFactory.getDefaultMiddlewareChain(authProvider);
  // add as a second middleware to get access to the access token
  middleware.splice(1, 0, new LongRunningOperationMiddleware(delayInterval));

  return Client.initWithMiddleware({ middleware });
}
