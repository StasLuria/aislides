#!/usr/bin/env node
/**
 * generate-postman.mjs — Export OpenAPI spec to Postman Collection v2.1
 *
 * Usage:
 *   node scripts/generate-postman.mjs              # Generate postman/collection.json + environment.json
 *   node scripts/generate-postman.mjs --dry-run    # Preview without writing files
 *   node scripts/generate-postman.mjs --base-url http://localhost:3000  # Custom base URL
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const baseUrlIdx = args.indexOf("--base-url");
const baseUrl = baseUrlIdx !== -1 ? args[baseUrlIdx + 1] : "{{base_url}}";

// ─── Load OpenAPI spec ─────────────────────────────────────────
async function loadSpec() {
  // Primary: fetch from running server (most reliable)
  const serverUrl = process.env.SERVER_URL || "http://localhost:3000";
  try {
    const res = await fetch(`${serverUrl}/api/docs/spec.json`);
    if (res.ok) {
      return await res.json();
    }
  } catch (_) {
    // Server not running, fall back to file parsing
  }

  // Fallback: parse swagger.ts file directly
  console.warn("⚠️  Server not reachable, parsing swagger.ts directly...");
  const swaggerPath = path.join(ROOT, "server", "swagger.ts");
  const content = fs.readFileSync(swaggerPath, "utf-8");

  const startMarker = "const swaggerSpec = ";
  const startIdx = content.indexOf(startMarker);
  if (startIdx === -1) throw new Error("Cannot find swaggerSpec in swagger.ts");

  const objStart = content.indexOf("{", startIdx);
  let depth = 0;
  let objEnd = -1;
  for (let i = objStart; i < content.length; i++) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") {
      depth--;
      if (depth === 0) { objEnd = i + 1; break; }
    }
  }
  if (objEnd === -1) throw new Error("Cannot parse swaggerSpec object");

  let objStr = content.slice(objStart, objEnd)
    .replace(/\/\/[^\n]*/g, "")
    .replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"')
    .replace(/(\{|,)\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1 "$2":')
    .replace(/,\s*([\}\]])/g, "$1");

  return JSON.parse(objStr);
}

// ─── Convert OpenAPI to Postman Collection v2.1 ────────────────
function openApiToPostman(spec) {
  const collection = {
    info: {
      name: spec.info.title,
      description: spec.info.description,
      version: spec.info.version,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: [
      {
        key: "base_url",
        value: "http://localhost:3000",
        type: "string",
      },
    ],
    item: [],
  };

  // Group endpoints by tag
  const tagGroups = new Map();
  for (const tag of spec.tags || []) {
    tagGroups.set(tag.name, {
      name: tag.name,
      description: tag.description || "",
      item: [],
    });
  }

  // Process each path
  for (const [pathStr, methods] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(methods)) {
      if (typeof operation !== "object" || !operation.summary) continue;

      const tag = operation.tags?.[0] || "Other";
      const folder = tagGroups.get(tag) || { name: tag, item: [] };
      if (!tagGroups.has(tag)) tagGroups.set(tag, folder);

      // Convert path params from {param} to :param for Postman
      const postmanPath = pathStr.replace(/\{([^}]+)\}/g, ":$1");
      const pathSegments = postmanPath.split("/").filter(Boolean);

      // Build request body
      let body = undefined;
      if (operation.requestBody?.content) {
        const jsonContent = operation.requestBody.content["application/json"];
        const multipartContent = operation.requestBody.content["multipart/form-data"];

        if (jsonContent?.schema) {
          body = {
            mode: "raw",
            raw: generateExampleJson(jsonContent.schema, spec.components?.schemas),
            options: { raw: { language: "json" } },
          };
        } else if (multipartContent?.schema) {
          body = {
            mode: "formdata",
            formdata: generateFormData(multipartContent.schema),
          };
        }
      }

      // Build query params
      const queryParams = (operation.parameters || [])
        .filter((p) => p.in === "query")
        .map((p) => ({
          key: p.name,
          value: p.schema?.example?.toString() || "",
          description: p.description || "",
          disabled: !p.required,
        }));

      // Build path variables
      const pathVars = (operation.parameters || [])
        .filter((p) => p.in === "path")
        .map((p) => ({
          key: p.name,
          value: p.schema?.example?.toString() || `{{${p.name}}}`,
          description: p.description || "",
        }));

      const request = {
        method: method.toUpperCase(),
        header: [],
        url: {
          raw: `{{base_url}}${postmanPath}${queryParams.length ? "?" + queryParams.map((q) => `${q.key}=${q.value}`).join("&") : ""}`,
          host: ["{{base_url}}"],
          path: pathSegments,
          ...(queryParams.length ? { query: queryParams } : {}),
          ...(pathVars.length ? { variable: pathVars } : {}),
        },
        ...(body ? { body } : {}),
      };

      if (body?.mode === "raw") {
        request.header.push({
          key: "Content-Type",
          value: "application/json",
        });
      }

      folder.item.push({
        name: operation.summary,
        request,
        response: [],
      });
    }
  }

  // Add folders to collection
  for (const folder of tagGroups.values()) {
    if (folder.item.length > 0) {
      collection.item.push(folder);
    }
  }

  return collection;
}

// ─── Generate example JSON from schema ─────────────────────────
function generateExampleJson(schema, schemas, depth = 0) {
  if (depth > 5) return "{}";

  // Resolve $ref
  if (schema.$ref) {
    const refName = schema.$ref.split("/").pop();
    schema = schemas?.[refName] || {};
  }

  if (schema.example !== undefined) {
    return JSON.stringify(schema.example, null, 2);
  }

  if (schema.type === "object" || schema.properties) {
    const obj = {};
    for (const [key, prop] of Object.entries(schema.properties || {})) {
      obj[key] = getExampleValue(prop, schemas, depth + 1);
    }
    return JSON.stringify(obj, null, 2);
  }

  if (schema.type === "array") {
    const item = getExampleValue(schema.items || {}, schemas, depth + 1);
    return JSON.stringify([item], null, 2);
  }

  return "{}";
}

function getExampleValue(prop, schemas, depth = 0) {
  if (depth > 5) return null;

  if (prop.$ref) {
    const refName = prop.$ref.split("/").pop();
    const resolved = schemas?.[refName] || {};
    return getExampleValue(resolved, schemas, depth + 1);
  }

  if (prop.example !== undefined) return prop.example;

  switch (prop.type) {
    case "string":
      if (prop.enum) return prop.enum[0];
      if (prop.format === "date-time") return "2026-01-15T10:00:00Z";
      return prop.description?.includes("ID") ? "abc123" : "string";
    case "integer":
    case "number":
      return prop.minimum || 0;
    case "boolean":
      return prop.default ?? true;
    case "array":
      return [getExampleValue(prop.items || {}, schemas, depth + 1)];
    case "object":
      if (prop.properties) {
        const obj = {};
        for (const [k, v] of Object.entries(prop.properties)) {
          obj[k] = getExampleValue(v, schemas, depth + 1);
        }
        return obj;
      }
      return {};
    default:
      return null;
  }
}

function generateFormData(schema) {
  const fields = [];
  for (const [key, prop] of Object.entries(schema.properties || {})) {
    if (prop.format === "binary") {
      fields.push({ key, type: "file", src: "", description: prop.description || "" });
    } else {
      fields.push({
        key,
        value: prop.example?.toString() || "",
        type: "text",
        description: prop.description || "",
      });
    }
  }
  return fields;
}

// ─── Generate Postman Environment ──────────────────────────────
function generateEnvironment() {
  return {
    id: "presentation-generator-env",
    name: "Presentation Generator — Local",
    values: [
      { key: "base_url", value: "http://localhost:3000", enabled: true, type: "default" },
      { key: "id", value: "", enabled: true, type: "default" },
      { key: "token", value: "", enabled: true, type: "default" },
      { key: "sessionId", value: "", enabled: true, type: "default" },
      { key: "templateId", value: "", enabled: true, type: "default" },
      { key: "index", value: "0", enabled: true, type: "default" },
      { key: "versionId", value: "1", enabled: true, type: "default" },
    ],
    _postman_variable_scope: "environment",
  };
}

// ─── Main ──────────────────────────────────────────────────────
try {
  console.log("📦 Generating Postman collection from OpenAPI spec...");

  const spec = await loadSpec();
  const collection = openApiToPostman(spec);
  const environment = generateEnvironment();

  const endpointCount = collection.item.reduce((sum, folder) => sum + (folder.item?.length || 0), 0);
  const folderCount = collection.item.length;

  console.log(`   Folders: ${folderCount}`);
  console.log(`   Endpoints: ${endpointCount}`);

  if (dryRun) {
    console.log("\n🔍 Dry run — collection preview:\n");
    for (const folder of collection.item) {
      console.log(`  📁 ${folder.name} (${folder.item.length} requests)`);
      for (const item of folder.item) {
        console.log(`     ${item.request.method.padEnd(7)} ${item.request.url.raw}`);
      }
    }
    console.log("\n✅ Dry run complete. No files written.");
  } else {
    const outDir = path.join(ROOT, "postman");
    fs.mkdirSync(outDir, { recursive: true });

    const collectionPath = path.join(outDir, "collection.json");
    fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2), "utf-8");

    const envPath = path.join(outDir, "environment.json");
    fs.writeFileSync(envPath, JSON.stringify(environment, null, 2), "utf-8");

    console.log(`\n✅ Postman collection generated:`);
    console.log(`   📄 ${path.relative(ROOT, collectionPath)}`);
    console.log(`   🌍 ${path.relative(ROOT, envPath)}`);
    console.log(`\nImport both files into Postman to start testing.`);
  }
} catch (e) {
  console.error("❌ Error:", e.message);
  process.exit(1);
}
