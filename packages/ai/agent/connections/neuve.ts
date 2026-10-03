import { defineMcpClientConnection } from "eve/connections"
import { HarnessConfigurationError } from "../../src/errors"

export default defineMcpClientConnection({
  url: process.env.NEUVE_MCP_URL ?? "http://127.0.0.1:4318/sse",
  description:
    "Neuve committed repository context pinned by the application. Retrieve ranked source evidence and structural relationships with explicit coverage and limitations.",
  protocolVersionDiscovery: false,
  tools: { allow: ["neuve_query"] },
  auth: {
    credentialOwner: "app",
    async getToken() {
      const token = process.env.NEUVE_MCP_TOKEN
      if (!token)
        throw new HarnessConfigurationError({
          setting: "NEUVE_MCP_TOKEN",
          message: "The local Neuve MCP capability is required.",
        })
      return { token }
    },
  },
})
