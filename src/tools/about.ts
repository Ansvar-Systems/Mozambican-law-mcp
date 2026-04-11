/**
 * about — Server metadata, dataset statistics, and provenance.
 */

import type Database from '@ansvar/mcp-sqlite';
import { generateMeta } from '../utils/metadata.js';

export interface AboutContext {
  version: string;
  fingerprint: string;
  dbBuilt: string;
}

function safeCount(db: InstanceType<typeof Database>, sql: string): number {
  try {
    const row = db.prepare(sql).get() as { count: number } | undefined;
    return row ? Number(row.count) : 0;
  } catch {
    return 0;
  }
}

export function getAbout(db: InstanceType<typeof Database>, context: AboutContext) {

  const euRefs = safeCount(db, 'SELECT COUNT(*) as count FROM eu_references');

  const stats: Record<string, number> = {
    documents: safeCount(db, 'SELECT COUNT(*) as count FROM legal_documents'),
    provisions: safeCount(db, 'SELECT COUNT(*) as count FROM legal_provisions'),
    definitions: safeCount(db, 'SELECT COUNT(*) as count FROM definitions'),
  };

  if (euRefs > 0) {
    stats.eu_documents = safeCount(db, 'SELECT COUNT(*) as count FROM eu_documents');
    stats.eu_references = euRefs;
  }

  const meta = generateMeta(db);

  return {
    result: {
      name: 'Mozambique Law MCP',
      version: context.version,
      jurisdiction: 'MZ',
      description: 'Mozambique Law MCP — legislation via Model Context Protocol',
      stats,
      data_sources: [
        {
          name: 'Tribunal Supremo de Mocambique',
          url: 'https://www.ts.gov.mz/legislacao',
          authority: 'Supreme Court of Mozambique',
        },
      ],
      freshness: {
        database_built: context.dbBuilt,
      },
      network: {
        name: 'Ansvar MCP Network',
        open_law: 'https://ansvar.eu/open-law',
        directory: 'https://ansvar.ai/mcp',
      },
    },
    _meta: {
      disclaimer: meta.disclaimer,
      data_age: meta.data_age,
      copyright: meta.copyright,
    },
  };
}
