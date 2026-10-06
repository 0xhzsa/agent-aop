/**
 * JSON Schema compatibility checker
 *
 * Validates whether one JSON Schema is compatible with another.
 * Used to check if an agent's output state can be consumed by another agent.
 */

import type { JSONSchema } from "./types.js";

/** Result of a schema compatibility check */
export interface SchemaCompatibilityResult {
  compatible: boolean;
  issues: string[];
  warnings: string[];
}

/**
 * Check if a source schema is compatible with a target schema.
 * The source schema represents what the producer outputs.
 * The target schema represents what the consumer expects.
 *
 * Returns true if the source can satisfy the target's requirements.
 */
export function checkSchemaCompatibility(
  source: JSONSchema,
  target: JSONSchema,
  path: string = "root"
): SchemaCompatibilityResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Handle $ref
  if (target.$ref) {
    // In a real implementation, we'd resolve the reference
    // For now, we assume refs are compatible
    return { compatible: true, issues, warnings };
  }

  // Handle anyOf, oneOf, allOf
  if (target.anyOf) {
    const anyCompatible = target.anyOf.some(
      (variant: JSONSchema) => checkSchemaCompatibility(source, variant, path).compatible
    );
    if (!anyCompatible) {
      issues.push(`${path}: source doesn't match any of the target's anyOf variants`);
    }
    return { compatible: issues.length === 0, issues, warnings };
  }

  if (target.oneOf) {
    const matchCount = target.oneOf.filter(
      (variant: JSONSchema) => checkSchemaCompatibility(source, variant, path).compatible
    ).length;
    if (matchCount === 0) {
      issues.push(`${path}: source doesn't match any of the target's oneOf variants`);
    } else if (matchCount > 1) {
      warnings.push(`${path}: source matches multiple oneOf variants`);
    }
    return { compatible: issues.length === 0, issues, warnings };
  }

  if (target.allOf) {
    for (let i = 0; i < target.allOf.length; i++) {
      const result = checkSchemaCompatibility(source, target.allOf[i]!, `${path}.allOf[${i}]`);
      issues.push(...result.issues);
      warnings.push(...result.warnings);
    }
    return { compatible: issues.length === 0, issues, warnings };
  }

  // Type compatibility check
  if (target.type && source.type) {
    if (!isTypeCompatible(source.type, target.type)) {
      issues.push(
        `${path}: type mismatch — source is "${source.type}", target expects "${target.type}"`
      );
      return { compatible: false, issues, warnings };
    }
  }

  // If target has no type but source does, that's fine (target accepts anything)
  // If source has no type but target does, warn
  if (!source.type && target.type) {
    warnings.push(`${path}: source has no type declaration, target expects "${target.type}"`);
  }

  // Enum compatibility
  if (target.enum && source.enum) {
    const sourceEnum = new Set(source.enum.map(String));
    const targetEnum = new Set(target.enum.map(String));
    const hasOverlap = [...targetEnum].some((v) => sourceEnum.has(v));
    if (!hasOverlap) {
      issues.push(`${path}: enum values don't overlap`);
    }
  }

  // Object property compatibility
  if (target.type === "object" && target.properties) {
    const sourceProps = source.properties || {};

    // Check required properties
    if (target.required) {
      for (const reqProp of target.required) {
        if (!(reqProp in sourceProps)) {
          // Check if source has additionalProperties
          if (source.additionalProperties === true || typeof source.additionalProperties === "object") {
            warnings.push(
              `${path}: required property "${reqProp}" not in source schema, but source allows additional properties`
            );
          } else {
            issues.push(
              `${path}: required property "${reqProp}" missing from source schema`
            );
          }
        }
      }
    }

    // Check property type compatibility
    for (const [propName, targetPropSchema] of Object.entries(target.properties)) {
      const sourcePropSchema = sourceProps[propName];
      if (sourcePropSchema) {
        const propResult = checkSchemaCompatibility(
          sourcePropSchema,
          targetPropSchema,
          `${path}.${propName}`
        );
        issues.push(...propResult.issues);
        warnings.push(...propResult.warnings);
      }
    }
  }

  // Array item compatibility
  if (target.type === "array" && target.items) {
    if (source.items) {
      const itemResult = checkSchemaCompatibility(
        source.items,
        target.items,
        `${path}[]`
      );
      issues.push(...itemResult.issues);
      warnings.push(...itemResult.warnings);
    } else if (source.type === "array") {
      warnings.push(`${path}: source array has no item schema declaration`);
    }
  }

  // String constraints
  if (target.type === "string" && source.type === "string") {
    if (target.minLength !== undefined && source.minLength !== undefined) {
      if (source.minLength < target.minLength) {
        warnings.push(
          `${path}: source minLength (${source.minLength}) < target minLength (${target.minLength})`
        );
      }
    }
    if (target.maxLength !== undefined && source.maxLength !== undefined) {
      if (source.maxLength > target.maxLength) {
        warnings.push(
          `${path}: source maxLength (${source.maxLength}) > target maxLength (${target.maxLength})`
        );
      }
    }
  }

  // Number constraints
  if ((target.type === "number" || target.type === "integer") &&
      (source.type === "number" || source.type === "integer")) {
    if (target.type === "integer" && source.type === "number") {
      warnings.push(`${path}: source is number, target expects integer`);
    }
    if (target.minimum !== undefined && source.minimum !== undefined) {
      if (source.minimum < target.minimum) {
        warnings.push(
          `${path}: source minimum (${source.minimum}) < target minimum (${target.minimum})`
        );
      }
    }
    if (target.maximum !== undefined && source.maximum !== undefined) {
      if (source.maximum > target.maximum) {
        warnings.push(
          `${path}: source maximum (${source.maximum}) > target maximum (${target.maximum})`
        );
      }
    }
  }

  return { compatible: issues.length === 0, issues, warnings };
}

/**
 * Check if a source type is compatible with a target type.
 * Handles type widening/narrowing rules.
 */
function isTypeCompatible(sourceType: string, targetType: string): boolean {
  if (sourceType === targetType) return true;

  // number can satisfy integer (but not vice versa)
  if (sourceType === "number" && targetType === "integer") return true;

  // string can satisfy enum (if enum values are strings)
  if (sourceType === "string" && targetType === "string") return true;

  // object can satisfy any object-like type
  if (sourceType === "object" && targetType === "object") return true;

  // array can satisfy any array-like type
  if (sourceType === "array" && targetType === "array") return true;

  // null/undefined handling
  if (sourceType === "null" || sourceType === "undefined") return false;

  // Unknown types are compatible (permissive)
  if (sourceType === "unknown" || targetType === "unknown") return true;

  return false;
}

/**
 * Check if a schema is a "wildcard" (accepts anything)
 */
export function isWildcardSchema(schema: JSONSchema): boolean {
  return !schema.type && !schema.properties && !schema.$ref && !schema.anyOf && !schema.oneOf && !schema.allOf;
}

/**
 * Get a human-readable description of a schema
 */
export function describeSchema(schema: JSONSchema): string {
  if (schema.$ref) return `ref: ${schema.$ref}`;
  if (schema.anyOf) return `anyOf: [${schema.anyOf.map(describeSchema).join(", ")}]`;
  if (schema.oneOf) return `oneOf: [${schema.oneOf.map(describeSchema).join(", ")}]`;
  if (schema.allOf) return `allOf: [${schema.allOf.map(describeSchema).join(", ")}]`;

  const parts: string[] = [];
  if (schema.type) parts.push(schema.type);
  if (schema.enum) parts.push(`enum: [${schema.enum.join(", ")}]`);
  if (schema.required) parts.push(`required: [${schema.required.join(", ")}]`);
  if (schema.properties) parts.push(`properties: {${Object.keys(schema.properties).join(", ")}}`);
  if (schema.items) parts.push(`items: ${describeSchema(schema.items)}`);

  return parts.join(", ") || "unknown";
}
