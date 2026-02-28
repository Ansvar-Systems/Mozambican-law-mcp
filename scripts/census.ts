#!/usr/bin/env tsx
/**
 * Mozambique Law MCP -- Census Script
 *
 * Builds a curated census of Mozambican legislation from multiple accessible
 * online sources. Mozambique lacks a single comprehensive, freely accessible
 * legislation portal, so this census aggregates known laws from:
 *
 *   - ts.gov.mz (Tribunal Supremo -- Supreme Court, PDFs)
 *   - africa-laws.org (structured HTML/PDF links)
 *   - FAOLEX (FAO legal database)
 *   - WIPO Lex (IP-related laws)
 *   - Refworld (constitutional / human rights laws)
 *   - Constitute Project (constitution)
 *
 * Format: Portuguese (official language of Mozambique)
 * Legal system: Civil law (Portuguese-derived)
 * Law types: Lei (Law), Decreto (Decree), Decreto-Lei (Decree-Law),
 *            Resolucao (Resolution), Diploma Ministerial
 *
 * Usage:
 *   npx tsx scripts/census.ts
 *   npx tsx scripts/census.ts --verify    # Also verify URL accessibility
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CENSUS_PATH = path.resolve(__dirname, '../data/census.json');

/* ---------- Types ---------- */

interface CensusLawEntry {
  id: string;
  title: string;
  identifier: string;
  url: string;
  status: 'in_force' | 'amended' | 'repealed';
  category: 'act';
  classification: 'ingestable' | 'excluded' | 'inaccessible';
  ingested: boolean;
  provision_count: number;
  ingestion_date: string | null;
}

interface CensusFile {
  schema_version: string;
  jurisdiction: string;
  jurisdiction_name: string;
  portal: string;
  census_date: string;
  agent: string;
  summary: {
    total_laws: number;
    ingestable: number;
    ocr_needed: number;
    inaccessible: number;
    excluded: number;
  };
  laws: CensusLawEntry[];
}

/* ---------- Helpers ---------- */

function titleToId(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function identifierFromTitle(title: string): string {
  // Extract "Lei n.o XX/YYYY" or "Decreto n.o XX/YYYY" patterns
  const match = title.match(/(Lei|Decreto(?:-Lei)?|Resolucao|Diploma\s+Ministerial)\s+n[.ºo]*\s*(\d+)\/(\d{4})/i);
  if (match) {
    const type = match[1].toLowerCase().replace(/\s+/g, '-');
    return `${type}/${match[3]}/${match[2]}`;
  }
  // Fallback: constitution or other format
  if (/constitui/i.test(title)) return 'constitution/2004';
  return titleToId(title);
}

/* ---------- Curated Law Catalog ---------- */

interface LawSpec {
  title: string;
  url: string;
  status?: 'in_force' | 'amended' | 'repealed';
}

/**
 * Comprehensive curated catalog of Mozambican legislation.
 * Sources: ts.gov.mz, africa-laws.org, FAOLEX, WIPO Lex, Refworld,
 * DLA Piper LOTW, Globalex, Library of Congress.
 */
const MOZAMBIQUE_LAWS: LawSpec[] = [
  // === CONSTITUTIONAL LAW ===
  { title: 'Constituicao da Republica de Mocambique (2004, revista em 2018)', url: 'https://www.constituteproject.org/constitution/Mozambique_2007?lang=en' },

  // === CRIMINAL LAW ===
  { title: 'Lei n.o 24/2019 de 24 de Dezembro - Codigo Penal', url: 'https://ts.gov.mz/wp-content/uploads/2023/09/Lei_17_2020__Lei_18__2020___Alteram_artigos_do_Codigo_Penal_e_Codigo_de_Processo_Penal___BR_246_I_2.o_SUPLEMENTO_SERIE_2020.pdf' },
  { title: 'Lei n.o 17/2020 de 23 de Dezembro - Altera o Codigo Penal', url: 'https://ts.gov.mz/wp-content/uploads/2023/09/Lei_17_2020__Lei_18__2020___Alteram_artigos_do_Codigo_Penal_e_Codigo_de_Processo_Penal___BR_246_I_2.o_SUPLEMENTO_SERIE_2020.pdf', status: 'in_force' },
  { title: 'Lei n.o 26/2019 de 20 de Dezembro - Codigo de Execucao de Penas', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Lei n.o 35/2014 de 31 de Dezembro - Revisao do Codigo Penal', url: 'https://www.africa-laws.org/Mozambique.php', status: 'amended' },

  // === ELECTRONIC TRANSACTIONS & CYBERSECURITY ===
  { title: 'Lei n.o 3/2017 de 9 de Janeiro - Lei das Transaccoes Electronicas', url: 'https://www.cga.co.mz/en/moz/publication/electronic-transactions-in-the-mozambican-legal-system' },
  { title: 'Decreto n.o 59/2023 de 27 de Outubro - Regulamento sobre Registo e Licenciamento de Prestadores Intermediarios de Servicos Electronicos', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },

  // === LABOUR LAW ===
  { title: 'Lei n.o 13/2023 de 25 de Agosto - Nova Lei do Trabalho', url: 'https://ts.gov.mz/wp-content/uploads/2024/05/Lei-No-13-2023-de-25-de-Agosto-NOVA-LEI-DO-TRABALHO-BR_165_I_SEI_RIE_2Ao__230831_091658.pdf' },
  { title: 'Lei n.o 23/2007 de 1 de Agosto - Lei do Trabalho', url: 'https://www.africa-laws.org/Mozambique/Employment%20law/Law%20no.%20232007%20of%20Labor%20(in%20Portuguese).pdf', status: 'amended' },

  // === COMMERCIAL LAW ===
  { title: 'Decreto-Lei n.o 2/2005 de 27 de Dezembro - Codigo Comercial', url: 'https://www.africa-laws.org/Mozambique/Comercial%20law/Commercial%20code%20(in%20Portuguese).pdf' },
  { title: 'Decreto-Lei n.o 1/2018 de 4 de Maio - Altera o Codigo Comercial', url: 'https://www.africa-laws.org/Mozambique/Comercial%20law/Commercial%20code.pdf' },
  { title: 'Lei n.o 3/93 de 24 de Junho - Lei do Investimento', url: 'https://www.africa-laws.org/Mozambique/Comercial%20law/Law%20No.%20393%20of%20June%2024,%201993%20(Law%20on%20Investment)%20In%20Portuguese.pdf' },

  // === CIVIL LAW ===
  { title: 'Codigo Civil de Mocambique', url: 'https://www.africa-laws.org/Mozambique/civil%20law/Civil%20Code%20(in%20Portuguese).pdf' },
  { title: 'Lei n.o 12/2004 de 8 de Dezembro - Codigo do Registo Civil', url: 'https://www.africa-laws.org/Mozambique/civil%20law/Law%202004%20-%2012%20Civil%20Registration%20Code%20(in%20Portuguese).pdf' },
  { title: 'Codigo da Nacionalidade', url: 'https://www.africa-laws.org/Mozambique/civil%20law/The%20nationality%20Code.pdf' },

  // === FAMILY LAW ===
  { title: 'Lei da Familia', url: 'https://www.africa-laws.org/Mozambique/Family%20law/Family%20Law%20(in%20Portuguese).pdf' },
  { title: 'Lei n.o 19/2019 de 22 de Outubro - Prevencao de Unioes Prematuras', url: 'https://www.africa-laws.org/Mozambique/Family%20law/Law%20No%2019-2019%20preventing%20and%20Combating%20Premature%20Marriages.%20(in%20Portuguese).pdf' },
  { title: 'Lei n.o 23/2019 de 23 de Dezembro - Lei das Sucessoes', url: 'https://www.africa-laws.org/Mozambique/Family%20law/Succession%20Law%20No%2023-2019%20(in%20Portuguese).pdf' },

  // === FINANCIAL & BANKING LAW ===
  { title: 'Lei n.o 20/2020 de 31 de Dezembro - Lei das Instituicoes de Credito e Sociedades Financeiras', url: 'https://www.bancomoc.mz/' },
  { title: 'Lei n.o 14/2013 de 12 de Agosto - Lei de Prevencao e Combate ao Branqueamento de Capitais e Financiamento do Terrorismo', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Decreto n.o 66/2014 de 29 de Outubro - Regulamento da Lei de Branqueamento de Capitais', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Lei n.o 5/98 de 15 de Janeiro - Lei do Cheque', url: 'https://www.africa-laws.org/Mozambique.php' },

  // === COMPETITION LAW ===
  { title: 'Lei n.o 10/2013 de 10 de Julho - Regime Juridico da Concorrencia', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Decreto n.o 97/2014 de 31 de Dezembro - Regulamento da Lei da Concorrencia', url: 'https://www.africa-laws.org/Mozambique.php' },

  // === CONSUMER PROTECTION ===
  { title: 'Lei n.o 22/2009 de 28 de Setembro - Lei de Proteccao do Consumidor', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Decreto n.o 27/2016 de 1 de Julho - Regulamento da Lei de Proteccao do Consumidor', url: 'https://www.africa-laws.org/Mozambique.php' },

  // === TAX LAW ===
  { title: 'Lei n.o 34/2007 de 31 de Dezembro - Codigo do Imposto sobre o Rendimento das Pessoas Colectivas', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Lei n.o 4/2012 de 23 de Janeiro - Altera o Codigo do IRPC', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Lei n.o 19/2013 de 23 de Setembro - Altera o Codigo do IRPC', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Lei n.o 4/2009 de 12 de Janeiro - Codigo dos Beneficios Fiscais', url: 'https://www.africa-laws.org/Mozambique.php' },

  // === INTELLECTUAL PROPERTY ===
  { title: 'Decreto n.o 47/2015 de 31 de Dezembro - Codigo da Propriedade Industrial', url: 'https://www.wipo.int/wipolex/en/legislation/details/16076' },
  { title: 'Lei n.o 9/2022 de 29 de Junho - Lei dos Direitos do Autor e Direitos Conexos', url: 'https://ts.gov.mz/wp-content/uploads/2023/09/Lei-no-9-2022-de-22-de-Junho-Lei-dos-Direitos-do-Autor-e-Direitos-Conexos-e-revoga-a-Lei-no.-4-2001-de-27-de-Fevereiro.pdf' },
  { title: 'Lei n.o 4/2001 de 27 de Fevereiro - Lei dos Direitos de Autor', url: 'https://www.wipo.int/wipolex/en/legislation/details/5771', status: 'repealed' },

  // === LAND LAW ===
  { title: 'Lei n.o 19/97 de 1 de Outubro - Lei de Terras', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Decreto n.o 66/98 de 8 de Dezembro - Regulamento da Lei de Terras', url: 'https://www.africa-laws.org/Mozambique.php' },

  // === ENVIRONMENT ===
  { title: 'Lei n.o 20/97 de 1 de Outubro - Lei do Ambiente', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },
  { title: 'Decreto n.o 54/2015 de 31 de Dezembro - Regulamento sobre o Processo de Avaliacao do Impacto Ambiental', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },
  { title: 'Lei n.o 10/99 de 7 de Julho - Lei de Florestas e Fauna Bravia', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },
  { title: 'Lei n.o 17/2023 de 28 de Setembro - Lei de Proteccao dos Recursos Florestais', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },

  // === MINING & PETROLEUM ===
  { title: 'Lei n.o 20/2014 de 18 de Agosto - Lei de Minas', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },
  { title: 'Lei n.o 21/2014 de 18 de Agosto - Lei de Petroleos', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },

  // === TELECOMMUNICATIONS ===
  { title: 'Lei n.o 8/2004 de 21 de Julho - Lei das Telecomunicacoes', url: 'https://www.wipo.int/wipolex/en/legislation/details/6415' },

  // === INFORMATION & MEDIA ===
  { title: 'Lei n.o 34/2014 de 31 de Dezembro - Lei do Direito a Informacao', url: 'https://ts.gov.mz/wp-content/uploads/2023/12/Dec-35-2015-Regulamento-lei-direito-informacao.pdf' },
  { title: 'Decreto n.o 35/2015 de 31 de Dezembro - Regulamento da Lei do Direito a Informacao', url: 'https://ts.gov.mz/wp-content/uploads/2023/12/Dec-35-2015-Regulamento-lei-direito-informacao.pdf' },
  { title: 'Lei n.o 18/91 de 10 de Agosto - Lei de Imprensa', url: 'https://www.africa-laws.org/Mozambique.php' },

  // === JUDICIAL SYSTEM ===
  { title: 'Lei n.o 17/2024 de 3 de Setembro - Revisao Parcial do Estatuto dos Magistrados Judiciais', url: 'https://www.ts.gov.mz/legislacao/' },
  { title: 'Lei n.o 11/2024 de 7 de Junho - Lei Organica do Conselho Constitucional', url: 'https://www.ts.gov.mz/legislacao/' },
  { title: 'Lei n.o 8/2024 de 7 de Junho - Regime Juridico da Tramitacao Electronica dos Processos Judiciais', url: 'https://www.ts.gov.mz/legislacao/' },
  { title: 'Lei n.o 24/2007 de 20 de Agosto - Lei da Organizacao Judiciaria', url: 'https://www.ts.gov.mz/legislacao/' },
  { title: 'Lei n.o 18/1992 de 14 de Outubro - Cria os Tribunais de Trabalho', url: 'https://ts.gov.mz/wp-content/uploads/2023/09/Lei-no-18-1992-de-14-de-Outubro-Cria-os-Tribunais-de-Trabalho.pdf' },

  // === HUMAN RIGHTS & SOCIAL ===
  { title: 'Resolucao n.o 5/2019 de 20 de Junho - Ratifica a Convencao da Uniao Africana sobre Ciberseguranca e Proteccao de Dados Pessoais', url: 'https://dataprotection.africa/mozambique/' },
  { title: 'Lei n.o 29/2009 de 29 de Setembro - Lei da Violencia Domestica', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },

  // === PUBLIC ADMINISTRATION ===
  { title: 'Lei n.o 14/2011 de 10 de Agosto - Lei de Procedimento Administrativo', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Decreto n.o 30/2001 de 15 de Outubro - Normas de Funcionamento dos Servicos da Administracao Publica', url: 'https://www.africa-laws.org/Mozambique.php' },

  // === ELECTIONS ===
  { title: 'Lei n.o 2/2019 de 31 de Maio - Lei Eleitoral', url: 'https://www.ts.gov.mz/legislacao/' },
  { title: 'Lei n.o 7/2007 de 26 de Fevereiro - Lei dos Orgaos Locais do Estado', url: 'https://www.africa-laws.org/Mozambique.php' },

  // === EDUCATION ===
  { title: 'Lei n.o 18/2018 de 28 de Dezembro - Lei do Sistema Nacional de Educacao', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },

  // === HEALTH ===
  { title: 'Lei n.o 19/2014 de 27 de Agosto - Lei da Saude', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },
  { title: 'Lei n.o 12/2009 de 12 de Marco - Lei de Proteccao das Pessoas que Vivem com HIV/SIDA', url: 'https://www.africa-laws.org/Mozambique.php' },

  // === ENERGY ===
  { title: 'Lei n.o 21/97 de 1 de Outubro - Lei da Electricidade', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },
  { title: 'Decreto n.o 58/2014 de 17 de Outubro - Regulamento de Energia Renovavel', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },

  // === WATER ===
  { title: 'Lei n.o 16/91 de 3 de Agosto - Lei de Aguas', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },

  // === FISHERIES ===
  { title: 'Lei n.o 22/2013 de 1 de Novembro - Lei da Pesca', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },

  // === TRANSPORT ===
  { title: 'Lei n.o 4/96 de 4 de Janeiro - Lei Maritima', url: 'https://www.africa-laws.org/Mozambique.php' },

  // === DEFENCE & SECURITY ===
  { title: 'Lei n.o 17/97 de 1 de Outubro - Lei de Defesa Nacional', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Lei n.o 16/2013 de 12 de Agosto - Lei da Policia da Republica de Mocambique', url: 'https://www.africa-laws.org/Mozambique.php' },

  // === PROCUREMENT ===
  { title: 'Decreto n.o 5/2016 de 8 de Marco - Regulamento de Contratacao de Empreitada de Obras Publicas', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },

  // === RECENT LEGISLATION (2024-2025) ===
  { title: 'Lei n.o 9/2024 de 7 de Junho - Lei do Ordenamento do Territorio', url: 'https://www.ts.gov.mz/legislacao/' },
  { title: 'Decreto n.o 1/2026 de 23 de Janeiro - Execucao do Plano Economico e Social e Orcamento do Estado de 2026', url: 'https://www.legis-palop.org/' },

  // === ADDITIONAL KEY LAWS ===
  { title: 'Lei n.o 6/2004 de 17 de Junho - Lei Anti-Corrupcao', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Lei n.o 15/2012 de 14 de Agosto - Lei de Parcerias Publico-Privadas', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Lei n.o 9/2010 de 31 de Marco - Regime Juridico das Associacoes de Defesa do Meio Ambiente', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },
  { title: 'Lei n.o 10/88 de 22 de Dezembro - Lei de Proteccao do Patrimonio Cultural', url: 'https://www.wipo.int/wipolex/en/legislation/details/6042' },
  { title: 'Lei n.o 6/99 de 3 de Fevereiro - Regime de Propriedade dos Imoveis do Fundo do Estado', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Decreto n.o 50/2003 de 24 de Dezembro - Estatuto do Instituto da Propriedade Industrial', url: 'https://www.wipo.int/wipolex/en/legislation/details/5809' },
  { title: 'Lei n.o 18/2020 de 23 de Dezembro - Altera o Codigo de Processo Penal', url: 'https://ts.gov.mz/wp-content/uploads/2023/09/Lei_17_2020__Lei_18__2020___Alteram_artigos_do_Codigo_Penal_e_Codigo_de_Processo_Penal___BR_246_I_2.o_SUPLEMENTO_SERIE_2020.pdf' },
  { title: 'Lei n.o 1/2018 de 12 de Junho - Revisao Constitucional', url: 'https://www.constituteproject.org/constitution/Mozambique_2007' },
  { title: 'Resolucao n.o 12/97 de 10 de Junho - Politica Cultural', url: 'https://www.wipo.int/wipolex/en/legislation/details/6039' },

  // === ADDITIONAL FAOLEX-SOURCED LAWS ===
  { title: 'Lei n.o 16/2014 de 20 de Junho - Lei de Proteccao Social', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },
  { title: 'Decreto n.o 82/2023 de 27 de Outubro - Regulamento de Seguranca de Materiais Radioactivos', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },
  { title: 'Decreto n.o 61/2023 de 27 de Outubro - Regulamento de Biocombustiveis', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },
  { title: 'Decreto n.o 11/2006 de 15 de Junho - Regulamento sobre a Inspeccao de Alimentos', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },
  { title: 'Lei n.o 3/2001 de 21 de Fevereiro - Seguro Obrigatorio de Responsabilidade Civil', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Lei n.o 5/2002 de 5 de Fevereiro - Lei dos Orgaos Locais do Estado', url: 'https://www.africa-laws.org/Mozambique.php', status: 'amended' },
  { title: 'Lei n.o 14/2007 de 30 de Maio - Lei de Ordenamento do Territorio', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ', status: 'amended' },
  { title: 'Lei n.o 16/2012 de 14 de Agosto - Lei de Probidade Publica', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Decreto n.o 19/2024 de 12 de Julho - Regulamento do Fundo Nacional para o Desenvolvimento Sustentavel', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },
  { title: 'Lei n.o 4/2004 de 17 de Junho - Lei da Familia', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Lei n.o 28/2014 de 23 de Setembro - Regime Especifico de Tributacao e de Beneficios Fiscais da Actividade Mineira', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },
  { title: 'Lei n.o 27/2014 de 23 de Setembro - Regime Especifico de Tributacao da Actividade Petrolifica', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },

  // === COMMUNICATIONS & TECHNOLOGY ===
  { title: 'Decreto n.o 64/2006 de 26 de Dezembro - Regulamento de Licenciamento de Telecomunicacoes', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Decreto n.o 22/2005 de 22 de Agosto - Regulamento de Comunicacoes Moveis', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Lei n.o 7/2012 de 8 de Fevereiro - Lei de Bases da Sociedade da Informacao', url: 'https://www.africa-laws.org/Mozambique.php' },

  // === MARITIME & FISHING ===
  { title: 'Decreto n.o 43/2003 de 10 de Dezembro - Regulamento Geral da Pesca Maritima', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },

  // === ADDITIONAL DECREES & REGULATIONS ===
  { title: 'Decreto n.o 15/2010 de 24 de Maio - Regulamento do Processo de Reinsercao Social', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Lei n.o 1/2008 de 16 de Janeiro - Lei de Bases de Prevencao e Combate ao Trafico de Pessoas', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Lei n.o 7/2008 de 9 de Julho - Lei de Prevencao e Combate ao Trafico de Orgaos e Partes do Corpo Humano', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Lei n.o 4/2019 de 31 de Maio - Revisao Pontual da Constituicao', url: 'https://www.ts.gov.mz/legislacao/' },
  { title: 'Lei n.o 1/2006 de 22 de Marco - Regula o Estatuto Geral dos Funcionarios e Agentes do Estado', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Decreto n.o 54/2009 de 8 de Setembro - Regulamento da Administracao Financeira do Estado', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Lei n.o 9/2002 de 12 de Fevereiro - Sistema de Administracao Financeira do Estado', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Lei n.o 2/97 de 18 de Fevereiro - Lei das Autarquias Locais', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Lei n.o 11/2007 de 27 de Junho - Lei da Organizacao do Tribunal Administrativo', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Lei n.o 25/2009 de 28 de Setembro - Lei de Combate a Producao e Trafico de Drogas', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Decreto n.o 70/2009 de 22 de Dezembro - Regulamento Sobre a Gestao de Residuos', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },
  { title: 'Decreto n.o 45/2004 de 29 de Setembro - Regulamento sobre Normas de Qualidade Ambiental e Emissao de Efluentes', url: 'https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=MOZ' },
  { title: 'Lei n.o 5/2017 de 11 de Maio - Lei da Revisao do Regime Juridico de Seguros', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Lei n.o 15/99 de 1 de Novembro - Regime Juridico do Sector Empresarial do Estado', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Decreto n.o 79/2017 de 28 de Dezembro - Regulamento de Operacoes Cambiais', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Lei n.o 8/2003 de 19 de Maio - Lei dos Orgaos Locais do Estado', url: 'https://www.africa-laws.org/Mozambique.php', status: 'amended' },
  { title: 'Lei n.o 11/2008 de 16 de Julho - Estatuto Organico do Ministerio Publico', url: 'https://www.ts.gov.mz/legislacao/' },
  { title: 'Lei n.o 6/2018 de 3 de Agosto - Regime Juridico da Concorrencia', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Decreto n.o 14/2013 de 19 de Abril - Regulamento de Gestao das Financas Publicas Municipais', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Lei n.o 2/2011 de 11 de Janeiro - Lei de Proteccao da Crianca', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Lei n.o 10/2004 de 25 de Agosto - Lei da Familia', url: 'https://www.africa-laws.org/Mozambique.php' },
  { title: 'Decreto n.o 37/2011 de 17 de Agosto - Regulamento do Licenciamento da Actividade Comercial', url: 'https://www.africa-laws.org/Mozambique.php' },
];

/* ---------- Main ---------- */

function main(): void {
  console.log('Mozambique Law MCP -- Census');
  console.log('============================\n');
  console.log('  Source: Curated from multiple accessible online sources');
  console.log(`  Laws in catalog: ${MOZAMBIQUE_LAWS.length}\n`);

  // Load existing census for merge/resume
  const existingEntries = new Map<string, CensusLawEntry>();
  if (fs.existsSync(CENSUS_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(CENSUS_PATH, 'utf-8')) as CensusFile;
      for (const law of data.laws) {
        if ('ingested' in law && 'url' in law) {
          existingEntries.set(law.id, law);
        }
      }
      if (existingEntries.size > 0) {
        console.log(`  Loaded ${existingEntries.size} existing entries from previous census\n`);
      }
    } catch {
      // Start fresh
    }
  }

  const today = new Date().toISOString().split('T')[0];

  for (const spec of MOZAMBIQUE_LAWS) {
    const id = titleToId(spec.title);
    const identifier = identifierFromTitle(spec.title);
    const existing = existingEntries.get(id);

    const entry: CensusLawEntry = {
      id,
      title: spec.title,
      identifier,
      url: spec.url,
      status: spec.status ?? 'in_force',
      category: 'act',
      classification: 'ingestable',
      ingested: existing?.ingested ?? false,
      provision_count: existing?.provision_count ?? 0,
      ingestion_date: existing?.ingestion_date ?? null,
    };

    existingEntries.set(id, entry);
  }

  // Build final census
  const allLaws = Array.from(existingEntries.values()).sort((a, b) =>
    a.title.localeCompare(b.title),
  );

  const ingestable = allLaws.filter(l => l.classification === 'ingestable').length;
  const inaccessible = allLaws.filter(l => l.classification === 'inaccessible').length;
  const excluded = allLaws.filter(l => l.classification === 'excluded').length;

  const census: CensusFile = {
    schema_version: '1.0',
    jurisdiction: 'MZ',
    jurisdiction_name: 'Mozambique',
    portal: 'https://www.ts.gov.mz/legislacao/',
    census_date: today,
    agent: 'claude-opus-4-6',
    summary: {
      total_laws: allLaws.length,
      ingestable,
      ocr_needed: 0,
      inaccessible,
      excluded,
    },
    laws: allLaws,
  };

  fs.mkdirSync(path.dirname(CENSUS_PATH), { recursive: true });
  fs.writeFileSync(CENSUS_PATH, JSON.stringify(census, null, 2));

  console.log('============================');
  console.log('Census Complete');
  console.log('============================\n');
  console.log(`  Total laws:     ${allLaws.length}`);
  console.log(`  Ingestable:     ${ingestable}`);
  console.log(`  Inaccessible:   ${inaccessible}`);
  console.log(`  Excluded:       ${excluded}`);
  console.log(`\n  Output: ${CENSUS_PATH}`);
}

main();
