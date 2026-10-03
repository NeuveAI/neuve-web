import { z } from "zod"

/**
 * Inline review comment — the durable record.
 *
 * A reviewer writes it on one line (or a range of lines) of one hunk in one
 * revision of a review unit. It is persisted through a
 * `ReviewCommentRepository` (local today, the BFF later) and mapped into the
 * unit's contextual markers with source kind `review comment`
 * (see ./markers.ts), so the context margin shows it and later cycles can
 * carry it forward.
 *
 * Vocabulary note: "revision" here is the commit the comment was written
 * against (the field the Review desk data already calls `revision`).
 * vocabulary.md defines Revision more broadly — "a change attributed to
 * review work" — so this field may need a narrower name once that is agreed.
 */

export const REVIEW_COMMENT_SCHEMA_VERSION = 2

export const DiffSideSchema = z.enum(["additions", "deletions"])

/**
 * The commented lines — Pierre's selected-line range, stored top-to-bottom
 * in display order. It may start on the deletion side and end on the
 * addition side (stacked view); `endSide` is present only then.
 */
export const LineRangeSchema = z.object({
  start: z.number().int().positive(),
  side: DiffSideSchema,
  end: z.number().int().positive(),
  endSide: DiffSideSchema.optional(),
})

export const AnchoredLineSchema = z.object({
  side: DiffSideSchema,
  lineNumber: z.number().int().positive(),
  text: z.string(),
})

export const ReviewCommentAnchorSchema = z.object({
  /** Path of the file in the reviewed revision. */
  filePath: z.string().min(1),
  range: LineRangeSchema,
  /** The hunk the range starts in, in that revision, e.g. `@@ -18,6 +18,8 @@`. */
  hunk: z.object({
    index: z.number().int().nonnegative(),
    header: z.string(),
  }),
  /**
   * Every row the range covers, in display order, with its text at write
   * time. Later revisions re-anchor by finding the same run of lines.
   */
  lines: z.array(AnchoredLineSchema).min(1),
})

export const ReviewCommentStatusSchema = z.enum(["open", "resolved"])

export const ReviewCommentAuthorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  initials: z.string().min(1).max(3),
})

export const ReviewCommentRecordSchema = z.object({
  schemaVersion: z.literal(REVIEW_COMMENT_SCHEMA_VERSION),
  id: z.string().min(1),
  unitId: z.string().min(1),
  /** Commit the comment was written against. */
  revision: z.string().min(1),
  anchor: ReviewCommentAnchorSchema,
  author: ReviewCommentAuthorSchema,
  body: z.string().min(1),
  /** ISO-8601. */
  createdAt: z.string().min(1),
  status: ReviewCommentStatusSchema,
})

export type ReviewCommentAnchor = z.infer<typeof ReviewCommentAnchorSchema>
export type AnchoredLine = z.infer<typeof AnchoredLineSchema>
export type ReviewCommentStatus = z.infer<typeof ReviewCommentStatusSchema>
export type ReviewCommentAuthor = z.infer<typeof ReviewCommentAuthorSchema>
export type ReviewCommentRecord = z.infer<typeof ReviewCommentRecordSchema>

export const ReviewCommentRecordListSchema = z.array(ReviewCommentRecordSchema)

/** Collision-resistant local id; the BFF may assign its own later. */
export function createReviewCommentId(now: Date = new Date()): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `rc_${now.getTime().toString(36)}_${random}`
}

export interface NewReviewComment {
  unitId: string
  revision: string
  anchor: ReviewCommentAnchor
  author: ReviewCommentAuthor
  body: string
}

export function createReviewCommentRecord(
  input: NewReviewComment,
  now: Date = new Date()
): ReviewCommentRecord {
  return ReviewCommentRecordSchema.parse({
    schemaVersion: REVIEW_COMMENT_SCHEMA_VERSION,
    id: createReviewCommentId(now),
    unitId: input.unitId,
    revision: input.revision,
    anchor: input.anchor,
    author: input.author,
    body: input.body.trim(),
    createdAt: now.toISOString(),
    status: "open",
  })
}
