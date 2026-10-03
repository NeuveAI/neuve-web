import { Data } from "effect"
import type { StorageError } from "@workspace/storage"
export class UnitNotFound extends Data.TaggedError("UnitNotFound")<{
  readonly unitId: string
}> {}
export class StaleRevision extends Data.TaggedError("StaleRevision")<{
  readonly unitId: string
  readonly expected: string
  readonly received: string
}> {}
export class HumanDecisionRequired extends Data.TaggedError(
  "HumanDecisionRequired"
)<{ readonly unitId: string }> {}
export class CommandConflict extends Data.TaggedError("CommandConflict")<{
  readonly commandId: string
}> {}
export class ReplayGap extends Data.TaggedError("ReplayGap")<{
  readonly afterSequence: number
  readonly oldestSequence: number
  readonly currentSequence: number
}> {}
export class InvalidReviewInput extends Data.TaggedError("InvalidReviewInput")<{
  readonly detail: string
}> {}
export class AutomatedReviewPending extends Data.TaggedError(
  "AutomatedReviewPending"
)<{ readonly revisionId: string; readonly reason: string }> {}
export type ReviewError =
  | AutomatedReviewPending
  | StorageError
  | UnitNotFound
  | StaleRevision
  | HumanDecisionRequired
  | CommandConflict
  | InvalidReviewInput
