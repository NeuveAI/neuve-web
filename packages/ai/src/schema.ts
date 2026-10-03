import { Schema } from "effect"
import { z } from "zod"
export function toolJsonSchema(schema: Schema.Constraint) {
  const document = Schema.toJsonSchemaDocument(schema)
  return z
    .record(z.string(), z.json())
    .parse({ ...document.schema, $defs: document.definitions })
}
