import { atom } from "jotai"
import type { Atom, WritableAtom } from "jotai"
import { atomWithStorage, createJSONStorage } from "jotai/utils"

import { ReviewCommentRecordListSchema } from "@workspace/ui/neuve/review-comments/record"
import type {
  ReviewCommentRecord,
  ReviewCommentStatus,
} from "@workspace/ui/neuve/review-comments/record"

/**
 * Where inline review comments live.
 *
 * The interface is a set of jotai atoms so components read and write records
 * the same way regardless of the backing store. Today's implementations are
 * local (browser storage, or memory for stories and tests). A BFF-backed
 * implementation can provide the same atoms on top of server state (for
 * example jotai-tanstack-query) without touching the Review desk.
 */
export interface ReviewCommentRepository {
  /** Every record this store knows about, oldest first. */
  readonly recordsAtom: Atom<ReadonlyArray<ReviewCommentRecord>>
  readonly saveAtom: WritableAtom<null, [record: ReviewCommentRecord], void>
  readonly setStatusAtom: WritableAtom<
    null,
    [id: string, status: ReviewCommentStatus],
    void
  >
  readonly removeAtom: WritableAtom<null, [id: string], void>
}

// v2: ranges are first-class (schema v2). v1 records are not migrated
// (local development data only).
export const REVIEW_COMMENTS_STORAGE_KEY = "neuve.review-comments.v2"

type Records = ReadonlyArray<ReviewCommentRecord>

function repositoryOver(
  storeAtom: WritableAtom<Records, [Records], void>
): ReviewCommentRepository {
  return {
    recordsAtom: atom((get) => get(storeAtom)),
    saveAtom: atom(null, (get, set, record: ReviewCommentRecord) => {
      const rest = get(storeAtom).filter((r) => r.id !== record.id)
      set(storeAtom, [...rest, record])
    }),
    setStatusAtom: atom(
      null,
      (get, set, id: string, status: ReviewCommentStatus) => {
        set(
          storeAtom,
          get(storeAtom).map((r) => (r.id === id ? { ...r, status } : r))
        )
      }
    ),
    removeAtom: atom(null, (get, set, id: string) => {
      set(
        storeAtom,
        get(storeAtom).filter((r) => r.id !== id)
      )
    }),
  }
}

/**
 * Browser-local repository backed by `atomWithStorage` (localStorage).
 * Stored data is validated on read; anything that does not match the record
 * schema is ignored rather than trusted.
 */
export function createLocalReviewCommentRepository(
  key: string = REVIEW_COMMENTS_STORAGE_KEY
): ReviewCommentRepository {
  // Default JSON storage: localStorage when it exists (never on the server).
  const json = createJSONStorage<Records>()
  const storage = {
    ...json,
    getItem(storageKey: string, initialValue: Records): Records {
      const parsed = ReviewCommentRecordListSchema.safeParse(
        json.getItem(storageKey, initialValue)
      )
      return parsed.success ? parsed.data : initialValue
    },
  }
  // getOnInit stays false: server render and first client render agree (no
  // records), then the stored records arrive when the atom mounts.
  const storeAtom = atomWithStorage<Records>(key, [], storage)
  return repositoryOver(
    atom(
      (get) => get(storeAtom),
      (_get, set, next: Records) => set(storeAtom, next)
    )
  )
}

/** In-memory repository (stories, tests): seeded, never persisted. */
export function createMemoryReviewCommentRepository(
  seed: Records = []
): ReviewCommentRepository {
  return repositoryOver(atom<Records>(seed))
}

/**
 * The repository the Review desk uses. Screens get the local one by default;
 * stories hydrate a memory repository (or a story-scoped storage key).
 */
export const defaultReviewCommentRepository: ReviewCommentRepository =
  createLocalReviewCommentRepository()

export const reviewCommentRepositoryAtom = atom<ReviewCommentRepository>(
  defaultReviewCommentRepository
)
