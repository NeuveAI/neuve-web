import { Schema } from "effect"

export class HarnessConfigurationError extends Schema.TaggedError<HarnessConfigurationError>()(
  "HarnessConfigurationError",
  {
    setting: Schema.String,
    message: Schema.String,
  }
) {}
export class ModelUnavailableError extends Schema.TaggedError<ModelUnavailableError>()(
  "ModelUnavailableError",
  {
    message: Schema.String,
  }
) {}
export class CircuitOpenError extends Schema.TaggedError<CircuitOpenError>()(
  "CircuitOpenError",
  {
    retryAfterMs: Schema.Number,
  }
) {}
export class ReviewBackendRejected extends Schema.TaggedError<ReviewBackendRejected>()(
  "ReviewBackendRejected",
  {
    code: Schema.String,
    message: Schema.String,
    status: Schema.Number,
    operation: Schema.String,
  }
) {}
export class ReviewBackendUnavailable extends Schema.TaggedError<ReviewBackendUnavailable>()(
  "ReviewBackendUnavailable",
  {
    operation: Schema.String,
    status: Schema.optional(Schema.Number),
  }
) {}
