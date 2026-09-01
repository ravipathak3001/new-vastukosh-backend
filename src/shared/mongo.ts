import mongoose, { type InferSchemaType, type Model, type Schema } from "mongoose";

/**
 * Register a model once. Under `tsx watch` reloads and vitest's shared module
 * graph a schema file can be evaluated more than once; plain `mongoose.model()`
 * throws `OverwriteModelError` the second time, so reuse an existing registration.
 */
export function defineModel<TSchema extends Schema>(
  name: string,
  schema: TSchema,
): Model<InferSchemaType<TSchema>> {
  const existing = mongoose.models[name] as Model<InferSchemaType<TSchema>> | undefined;
  return existing ?? mongoose.model<InferSchemaType<TSchema>>(name, schema);
}
