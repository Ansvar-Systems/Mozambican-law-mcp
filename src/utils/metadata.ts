/**
 * Response metadata utilities for Mozambique Law MCP.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface ResponseMetadata {
  data_source: string;
  jurisdiction: string;
  disclaimer: string;
  freshness?: string;
  note?: string;
  query_strategy?: string;
}

export interface ToolResponse<T> {
  results: T;
  _metadata: ResponseMetadata;
}

export function generateResponseMetadata(
  db: InstanceType<typeof Database>,
): ResponseMetadata {
  let freshness: string | undefined;
  try {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'built_at'"
    ).get() as { value: string } | undefined;
    if (row) freshness = row.value;
  } catch {
    // Ignore
  }

  return {
    data_source: 'Portal do Governo de Moçambique / CFJJ (cfjj.gov.mz) — Centro de Formação Jurídica e Judiciária',
    jurisdiction: 'MZ',
    disclaimer:
      'This data is sourced from Mozambique official legal sources under Government Open Data principles. ' +
      'The authoritative versions are in Portuguese. ' +
      'Always verify with the official Portal do Governo (portaldogoverno.gov.mz) or CFJJ (cfjj.gov.mz).',
    freshness,
  };
}
