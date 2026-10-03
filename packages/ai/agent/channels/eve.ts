import { timingSafeEqual } from "node:crypto"
import { eveChannel } from "eve/channels/eve"
export default eveChannel({
  auth: [
    async (request) => {
      const expected = process.env.NEUVE_HARNESS_TOKEN
      const received = request.headers
        .get("authorization")
        ?.replace(/^Bearer /, "")
      if (!expected || !received) return null
      const actualBytes = Buffer.from(received)
      const expectedBytes = Buffer.from(expected)
      if (
        actualBytes.length !== expectedBytes.length ||
        !timingSafeEqual(actualBytes, expectedBytes)
      )
        return null
      return {
        authenticator: "neuve-local-capability",
        principalId: "neuve-backend",
        principalType: "app",
        attributes: {},
      }
    },
  ],
})
