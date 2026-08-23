export interface GraphSchemaValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Hand-written structural validator for `graph.json`
 * (spec/05-artifact-contracts.md §3). Deliberately avoids a schema-validator
 * dependency (e.g. ajv) — the shape is small and stable enough that a plain
 * function is simpler and has no supply-chain cost.
 */
export function validateGraphSchema(value: unknown): GraphSchemaValidationResult {
  const errors: string[] = [];

  if (typeof value !== "object" || value === null) {
    return { valid: false, errors: ["root value must be an object"] };
  }

  const root = value as Record<string, unknown>;

  if (!Array.isArray(root.nodes)) {
    errors.push("`nodes` must be an array");
  } else {
    root.nodes.forEach((node, i) => {
      if (typeof node !== "object" || node === null) {
        errors.push(`nodes[${i}] must be an object`);
        return;
      }
      const n = node as Record<string, unknown>;
      if (typeof n.id !== "string") errors.push(`nodes[${i}].id must be a string`);
      if (typeof n.title !== "string") errors.push(`nodes[${i}].title must be a string`);
      if (!Array.isArray(n.tags) || !n.tags.every((t) => typeof t === "string")) {
        errors.push(`nodes[${i}].tags must be a string[]`);
      }
      for (const key of Object.keys(n)) {
        if (key !== "id" && key !== "title" && key !== "tags") {
          errors.push(`nodes[${i}] has unexpected field "${key}"`);
        }
      }
    });
  }

  if (!Array.isArray(root.edges)) {
    errors.push("`edges` must be an array");
  } else {
    root.edges.forEach((edge, i) => {
      if (typeof edge !== "object" || edge === null) {
        errors.push(`edges[${i}] must be an object`);
        return;
      }
      const e = edge as Record<string, unknown>;
      if (typeof e.source !== "string") errors.push(`edges[${i}].source must be a string`);
      if (typeof e.target !== "string") errors.push(`edges[${i}].target must be a string`);
      if (e.kind !== "wikilink" && e.kind !== "embed") {
        errors.push(`edges[${i}].kind must be "wikilink" or "embed"`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}
