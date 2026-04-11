/**
 * Response metadata utilities for Mozambique Law MCP.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface CitationRef {
  canonical_ref: string;
  display_text: string;
  lookup: {
    tool: string;
    args: Record<string, string>;
  };
}

export interface ResponseMeta {
  disclaimer: string;
  data_age?: string;
  copyright: string;
  source_url?: string;
  note?: string;
  query_strategy?: string;
  _error_type?: string;
}

export interface ToolResponse<T> {
  results: T;
  _meta: ResponseMeta;
}

export function generateMeta(
  db: InstanceType<typeof Database>,
  overrides?: Partial<ResponseMeta>,
): ResponseMeta {
  let data_age: string | undefined;
  try {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'built_at'"
    ).get() as { value: string } | undefined;
    if (row) data_age = row.value.slice(0, 10);
  } catch {
    // Ignore
  }

  return {
    disclaimer:
      'This data is sourced from Mozambique official legal sources under Government Open Data principles. ' +
      'The authoritative versions are in Portuguese. ' +
      'Always verify with the official Portal do Governo (portaldogoverno.gov.mz) or CFJJ (cfjj.gov.mz).',
    data_age,
    copyright: '© Portal do Governo de Moçambique / CFJJ — Government Open Data',
    ...overrides,
  };
}
