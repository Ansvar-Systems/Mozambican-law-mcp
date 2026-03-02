# Mozambican Law MCP Server

**The Imprensa Nacional de Moçambique alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fmozambican-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/mozambican-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/Mozambican-law-mcp?style=social)](https://github.com/Ansvar-Systems/Mozambican-law-mcp)
[![CI](https://github.com/Ansvar-Systems/Mozambican-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/Mozambican-law-mcp/actions/workflows/ci.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](https://github.com/Ansvar-Systems/Mozambican-law-mcp)
[![Provisions](https://img.shields.io/badge/provisions-2%2C726-blue)](https://github.com/Ansvar-Systems/Mozambican-law-mcp)

Query **111 Mozambican statutes** -- from the Lei de Protecção de Dados Pessoais and Código Penal to the Código do Trabalho, Lei das Sociedades Comerciais, and more -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Mozambican legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Mozambican legal research means navigating portaldogoverno.gov.mz, the Boletim da República (official gazette published by Imprensa Nacional de Moçambique), and ts.gov.mz (Tribunal Supremo). Whether you're:
- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking obligations under Lei n.º 3/2022 on Personal Data Protection
- A **legal tech developer** building tools on Mozambican law
- A **researcher** tracing provisions across 111 statutes in Portuguese

...you shouldn't need dozens of browser tabs and manual PDF cross-referencing. Ask Claude. Get the exact provision. With context.

This MCP server makes Mozambican law **searchable, cross-referenceable, and AI-readable**.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://mozambican-law-mcp.vercel.app/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add mozambican-law --transport http https://mozambican-law-mcp.vercel.app/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mozambican-law": {
      "type": "url",
      "url": "https://mozambican-law-mcp.vercel.app/mcp"
    }
  }
}
```

**GitHub Copilot** -- add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "mozambican-law": {
      "type": "http",
      "url": "https://mozambican-law-mcp.vercel.app/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/mozambican-law-mcp
```

**Claude Desktop** -- add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mozambican-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/mozambican-law-mcp"]
    }
  }
}
```

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "mozambican-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/mozambican-law-mcp"]
    }
  }
}
```

---

## Example Queries

Once connected, just ask naturally:

- *"Pesquisar as disposições sobre protecção de dados pessoais na Lei n.º 3/2022"*
- *"O que diz o Código Penal moçambicano sobre burla informática?"*
- *"Encontrar os direitos dos trabalhadores no Código do Trabalho de Moçambique"*
- *"Quais são as obrigações do empregador segundo a Lei do Trabalho moçambicana?"*
- *"Pesquisar as disposições sobre investimento estrangeiro em Moçambique"*
- *"A Lei n.º 3/2022 sobre protecção de dados pessoais está ainda em vigor?"*
- *"Validar a citação 'Artigo 12.º, Lei n.º 3/2022 de 25 de Agosto'"*
- *"Construir uma posição jurídica sobre as obrigações de conformidade em matéria de protecção de dados em Moçambique"*
- *"What does the Companies Act say about director liability in Mozambique?"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Statutes** | 111 statutes | Key Mozambican legislation |
| **Provisions** | 2,726 sections | Full-text searchable with FTS5 |
| **Database Size** | ~3.1 MB | Optimized SQLite, portable |
| **Data Sources** | ts.gov.mz / Boletim da República | Tribunal Supremo and official gazette |
| **Language** | Portuguese | Official statute language of Mozambique |
| **Freshness Checks** | Automated | Drift detection against official sources |

**Verified data only** -- every citation is validated against official sources (Boletim da República, Tribunal Supremo). Zero LLM-generated content.

---

## See It In Action

### Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from ts.gov.mz, portaldogoverno.gov.mz, and WIPO Lex official publications
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains statute text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by statute name and article number
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
ts.gov.mz / Boletim da República --> Parse --> SQLite --> FTS5 snippet() --> MCP response
                                       ^                        ^
                                Provision parser         Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Pesquisar no Boletim da República por data de publicação | Pesquisar em linguagem simples: *"protecção de dados"* |
| Navegar manualmente por estatutos com múltiplos artigos | Obter a disposição exacta com contexto |
| Referência cruzada manual entre leis | `build_legal_stance` agrega entre fontes |
| "Esta lei ainda está em vigor?" -- verificar manualmente | ferramenta `check_currency` -- resposta em segundos |
| Encontrar alinhamento internacional -- procurar manualmente | `get_eu_basis` -- frameworks ligados instantaneamente |
| Sem API, sem integração | Protocolo MCP -- nativo para IA |

**Traditional:** Navegar no Boletim da República --> Localizar publicação --> Ctrl+F --> Referência cruzada SADC --> Repetir

**This MCP:** *"Quais são os requisitos de protecção de dados pessoais em Moçambique ao abrigo da Lei n.º 3/2022?"* --> Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 full-text search across 2,726 provisions with BM25 ranking. Full Portuguese-language support |
| `get_provision` | Retrieve specific provision by statute name and article number |
| `validate_citation` | Validate citation against database -- zero-hallucination check |
| `build_legal_stance` | Aggregate citations from multiple statutes for a legal topic |
| `format_citation` | Format citations per Mozambican legal conventions (full/short/pinpoint) |
| `check_currency` | Check if a statute is in force, amended, or repealed |
| `list_sources` | List all available statutes with metadata and data provenance |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### International Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get international frameworks that a Mozambican statute aligns with |
| `get_mozambican_implementations` | Find Mozambican laws aligning with a specific international framework |
| `search_eu_implementations` | Search international documents with Mozambican alignment counts |
| `get_provision_eu_basis` | Get international law references for a specific provision |
| `validate_eu_compliance` | Check alignment status of Mozambican statutes against international standards |

---

## International Law Alignment

Mozambique is not an EU member state, but Mozambican legislation aligns with key international frameworks:

- **Lei n.º 3/2022 de Protecção de Dados Pessoais** aligns with the SADC Model Law on Data Protection and shares core GDPR principles -- consent, purpose limitation, data subject rights, breach notification
- **SADC membership** means Mozambican trade and commercial law aligns with the SADC Treaty framework and Protocol on Trade
- **African Union membership** connects Mozambican law to the AU Convention on Cyber Security and Personal Data Protection (Malabo Convention)
- **CPLP membership** (Comunidade dos Países de Língua Portuguesa) creates shared legal principles with Portugal (an EU member state), Brazil, Angola, Cape Verde, and other Portuguese-speaking nations -- Mozambican commercial law drew directly on Portuguese and Brazilian civil law traditions at independence and in subsequent reforms
- **ILO conventions** ratified by Mozambique underpin the Labour Code provisions on fundamental worker rights

Mozambique's legal system follows a **civil law tradition** inherited from Portuguese law, with statutes published in Portuguese in the Boletim da República.

The international alignment tools allow you to explore these relationships -- checking which Mozambican provisions correspond to international standards, and vice versa.

> **Note:** Mozambique is not an EU member state. International cross-references reflect alignment and shared principles, not direct transposition. Verify compliance obligations against the specific applicable framework for your jurisdiction.

---

## Data Sources & Freshness

All content is sourced from authoritative Mozambican legal databases:

- **[Tribunal Supremo de Moçambique (ts.gov.mz)](https://www.ts.gov.mz/legislacao)** -- Supreme Court legislative database
- **[Portal do Governo de Moçambique](https://portaldogoverno.gov.mz/)** -- Official government portal and Boletim da República
- **[WIPO Lex](https://wipolex.wipo.int/)** -- World Intellectual Property Organization legal database (supplementary)

### Data Provenance

| Field | Value |
|-------|-------|
| **Authority** | Imprensa Nacional de Moçambique (Boletim da República) |
| **Retrieval method** | Official statute downloads from ts.gov.mz and Boletim da República |
| **Language** | Portuguese |
| **Coverage** | 111 statutes, 2,726 provisions |
| **Database size** | ~3.1 MB |

### Automated Freshness Checks

A GitHub Actions workflow monitors all data sources:

| Check | Method |
|-------|--------|
| **Statute amendments** | Drift detection against known provision anchors |
| **New statutes** | Comparison against ts.gov.mz index |
| **Repealed statutes** | Status change detection |

**Verified data only** -- every citation is validated against official sources. Zero LLM-generated content.

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from official Mozambican legal publications (Boletim da República, Tribunal Supremo). However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Court case coverage is not included** -- do not rely solely on this for case law research
> - **Verify critical citations** against primary sources for court filings
> - **International cross-references** reflect alignment relationships, not direct transposition
> - **Coverage is selective** -- priority statutes only; verify completeness for your specific legal question

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [SECURITY.md](SECURITY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment. Consult the **Ordem dos Advogados de Moçambique (OAM)** guidance on client confidentiality obligations.

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/Mozambican-law-mcp
cd Mozambican-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest           # Ingest statutes from ts.gov.mz and Boletim da República
npm run build:db         # Rebuild SQLite database
npm run drift:detect     # Run drift detection against anchors
npm run check-updates    # Check for amendments and new statutes
npm run census           # Generate coverage census
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Database Size:** ~3.1 MB (efficient, portable)
- **Reliability:** 100% ingestion success rate

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** -- ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

### [@ansvar/us-regulations-mcp](https://github.com/Ansvar-Systems/US_Compliance_MCP)
**Query US federal and state compliance laws** -- HIPAA, CCPA, SOX, GLBA, FERPA, and more. `npx @ansvar/us-regulations-mcp`

### [@ansvar/sanctions-mcp](https://github.com/Ansvar-Systems/Sanctions-MCP)
**Offline-capable sanctions screening** -- OFAC, EU, UN sanctions lists. `pip install ansvar-sanctions-mcp`

**108 national law MCPs** covering Mozambique, South Africa, Kenya, Angola, Brazil, Portugal, Tanzania, Zimbabwe, Zambia, and more.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Court case law expansion (Tribunal Supremo decisions)
- Additional statute coverage from Boletim da República archives
- Historical statute versions and amendment tracking
- Portuguese-language full-text search improvements

---

## Roadmap

- [x] Core statute database with FTS5 search
- [x] Full corpus ingestion (111 statutes, 2,726 provisions)
- [x] International law alignment tools (SADC, AU, CPLP)
- [x] Vercel Streamable HTTP deployment
- [x] npm package publication
- [ ] Tribunal Supremo case law expansion
- [ ] Additional statute coverage from Boletim da República
- [ ] Historical statute versions (amendment tracking)
- [ ] Regulations and subsidiary legislation

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{mozambican_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Mozambican Law MCP Server: AI-Powered Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/Mozambican-law-mcp},
  note = {111 Mozambican statutes with 2,726 provisions}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Statutes & Legislation:** Government of Mozambique / Imprensa Nacional de Moçambique (public domain)
- **International Metadata:** Public domain

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the global market. This MCP server started as our internal reference tool for Southern African and Lusophone legal research -- turns out everyone building compliance tools for Portuguese-speaking African markets has the same research frustrations.

So we're open-sourcing it. Navigating 111 Mozambican statutes across Boletim da República archives shouldn't require a law degree.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
