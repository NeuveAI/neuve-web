import { Schema } from "effect"
export class StorageError extends Schema.TaggedError<StorageError>()(
  "StorageError",
  { operation: Schema.String, message: Schema.String }
) {}
export class StorageValidationError extends Schema.TaggedError<StorageValidationError>()(
  "StorageValidationError",
  { message: Schema.String }
) {}
export class StorageConflict extends Schema.TaggedError<StorageConflict>()(
  "StorageConflict",
  { id: Schema.String }
) {}
export class StoredRecordNotFound extends Schema.TaggedError<StoredRecordNotFound>()(
  "StoredRecordNotFound",
  { id: Schema.String }
) {}
export type StorageFailure =
  StorageError | StorageValidationError | StorageConflict | StoredRecordNotFound
