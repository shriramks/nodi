import "server-only";

import { fetchJson } from "@/lib/fetch";

const wikidataSparqlUrl = "https://query.wikidata.org/sparql";
const wikidataApiUrl = "https://www.wikidata.org/w/api.php";
const wikipediaSummaryBaseUrl = "https://en.wikipedia.org/api/rest_v1/page/summary/";
const sourceLabel = "Wikipedia/Wikidata";

const wikimediaHeaders = {
  "api-user-agent": "Nodi/0.1 (local movie tracking PWA)",
  "user-agent": "Nodi/0.1 (local movie tracking PWA)",
};

export type WikipediaTriviaItem = {
  text: string;
  sourceLabel: string;
  sourceUrl: string;
};

export type MovieWikipediaTriviaInput = {
  imdbId?: string | null;
  releaseYear?: number | null;
  title: string;
  tmdbId?: number | null;
};

export type PersonWikipediaTriviaInput = {
  birthday?: string | null;
  imdbId?: string | null;
  name: string;
  tmdbPersonId?: number | null;
};

type SparqlValue = {
  type: string;
  value: string;
};

type SparqlResponse<T extends Record<string, SparqlValue | undefined>> = {
  results: {
    bindings: T[];
  };
};

type SubjectBinding = {
  article?: SparqlValue;
  item: SparqlValue;
  itemLabel?: SparqlValue;
};

type ClaimBinding = {
  kind: SparqlValue;
  valueLabel?: SparqlValue;
};

type WikidataSubject = {
  articleUrl: string | null;
  label: string | null;
  qid: string;
};

type WikipediaSummary = {
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
  extract?: string;
};

type WikidataSearchResponse = {
  search?: Array<{
    id?: string;
  }>;
};

type MovieCandidateBinding = SubjectBinding & {
  publicationDate?: SparqlValue;
};

type PersonCandidateBinding = SubjectBinding & {
  birthDate?: SparqlValue;
};

export async function getMovieWikipediaTrivia({
  imdbId,
  releaseYear,
  title,
  tmdbId,
}: MovieWikipediaTriviaInput): Promise<WikipediaTriviaItem[]> {
  const subject = await resolveMovieSubject({ imdbId, releaseYear, title, tmdbId });

  if (!subject) {
    return [];
  }

  const [summary, claims] = await Promise.all([
    fetchWikipediaSummary(subject.articleUrl),
    fetchClaims(subject.qid, [
      ["wdt:P57", "director"],
      ["wdt:P58", "screenwriter"],
      ["wdt:P86", "composer"],
      ["wdt:P144", "based_on"],
      ["wdt:P915", "filming_location"],
      ["wdt:P166", "award"],
    ]),
  ]);
  const sourceUrl = summary?.sourceUrl ?? subject.articleUrl ?? wikidataItemUrl(subject.qid);
  const items = [
    summary?.extract ? triviaItem(summary.extract, sourceUrl) : null,
    claimTrivia(claims.director, "Wikidata lists {values} as director.", sourceUrl),
    claimTrivia(claims.screenwriter, "Wikidata lists {values} as screenwriter.", sourceUrl),
    claimTrivia(claims.composer, "Wikidata lists {values} for the film score.", sourceUrl),
    claimTrivia(claims.based_on, "Wikidata links the film to {values} as source material.", sourceUrl),
    claimTrivia(claims.filming_location, "Wikidata lists {values} among its filming locations.", sourceUrl),
    claimTrivia(claims.award, "Wikidata lists {values} among its awards and honors.", sourceUrl),
  ];

  return uniqueTrivia(items).slice(0, 4);
}

export async function getPersonWikipediaTrivia({
  birthday,
  imdbId,
  name,
  tmdbPersonId,
}: PersonWikipediaTriviaInput): Promise<WikipediaTriviaItem[]> {
  const subject = await resolvePersonSubject({ birthday, imdbId, name, tmdbPersonId });

  if (!subject) {
    return [];
  }

  const [summary, claims] = await Promise.all([
    fetchWikipediaSummary(subject.articleUrl),
    fetchClaims(subject.qid, [
      ["wdt:P106", "occupation"],
      ["wdt:P166", "award"],
      ["wdt:P800", "notable_work"],
      ["wdt:P69", "educated_at"],
      ["wdt:P27", "citizenship"],
    ]),
  ]);
  const sourceUrl = summary?.sourceUrl ?? subject.articleUrl ?? wikidataItemUrl(subject.qid);
  const items = [
    summary?.extract ? triviaItem(summary.extract, sourceUrl) : null,
    claimTrivia(claims.occupation, "Wikidata lists {values} among their occupations.", sourceUrl),
    claimTrivia(claims.notable_work, "Wikidata lists {values} among their notable works.", sourceUrl),
    claimTrivia(claims.award, "Wikidata links {values} to their awards and honors.", sourceUrl),
    claimTrivia(claims.educated_at, "Wikidata lists {values} in their education history.", sourceUrl),
    claimTrivia(claims.citizenship, "Wikidata lists {values} as country of citizenship.", sourceUrl),
  ];

  return uniqueTrivia(items).slice(0, 4);
}

async function resolveMovieSubject(input: MovieWikipediaTriviaInput) {
  const idQuery = idMatchQuery([
    input.imdbId ? `?item wdt:P345 ${sparqlString(input.imdbId)}.` : null,
    input.tmdbId ? `?item wdt:P4947 ${sparqlString(String(input.tmdbId))}.` : null,
  ]);
  const subjectFromIds = idQuery ? await resolveSubject(idQuery) : null;

  return subjectFromIds ?? resolveMovieFallbackSubject(input);
}

async function resolvePersonSubject(input: PersonWikipediaTriviaInput) {
  const idQuery = idMatchQuery([
    input.imdbId ? `?item wdt:P345 ${sparqlString(input.imdbId)}.` : null,
    input.tmdbPersonId ? `?item wdt:P4985 ${sparqlString(String(input.tmdbPersonId))}.` : null,
  ]);
  const subjectFromIds = idQuery ? await resolveSubject(idQuery) : null;

  return subjectFromIds ?? resolvePersonFallbackSubject(input);
}

async function resolveMovieFallbackSubject(input: MovieWikipediaTriviaInput) {
  const exactSubject = await resolveSubject(movieFallbackQuery(input.title, input.releaseYear), {
    requireUnique: true,
  });

  if (exactSubject) {
    return exactSubject;
  }

  const candidateQids = await searchWikidataEntities(input.title);

  return resolveMovieSearchCandidate(candidateQids, input.releaseYear);
}

async function resolvePersonFallbackSubject(input: PersonWikipediaTriviaInput) {
  const exactSubject = await resolveSubject(personFallbackQuery(input.name, input.birthday), {
    requireUnique: true,
  });

  if (exactSubject) {
    return exactSubject;
  }

  const candidateQids = await searchWikidataEntities(input.name);
  const birthYear = yearFromDate(input.birthday);

  return resolvePersonSearchCandidate(candidateQids, birthYear);
}

async function resolveSubject(
  query: string | null,
  options: { requireUnique?: boolean } = {},
): Promise<WikidataSubject | null> {
  if (!query) {
    return null;
  }

  const response = await fetchSparql<SubjectBinding>(query);
  const byQid = new Map<string, WikidataSubject>();

  for (const binding of response?.results.bindings ?? []) {
    const qid = qidFromWikidataUrl(binding.item.value);

    if (!qid || byQid.has(qid)) {
      continue;
    }

    byQid.set(qid, {
      articleUrl: binding.article?.value ?? null,
      label: binding.itemLabel?.value ?? null,
      qid,
    });
  }

  const subjects = [...byQid.values()];
  if (options.requireUnique && subjects.length !== 1) {
    return null;
  }

  const withArticle = subjects.find((subject) => subject.articleUrl);

  return withArticle ?? subjects[0] ?? null;
}

function idMatchQuery(patterns: Array<string | null>) {
  const usablePatterns = patterns.filter((pattern): pattern is string => pattern !== null);

  if (usablePatterns.length === 0) {
    return null;
  }

  return subjectSelectQuery(usablePatterns.map((pattern) => `{ ${pattern} }`).join(" UNION "));
}

function movieFallbackQuery(title: string, releaseYear?: number | null) {
  const normalizedTitle = title.trim();

  if (!normalizedTitle || !releaseYear) {
    return null;
  }

  return subjectSelectQuery(`
    ?item rdfs:label ${sparqlString(normalizedTitle)}@en;
      wdt:P31/wdt:P279* wd:Q11424;
      wdt:P577 ?publicationDate.
    FILTER(YEAR(?publicationDate) = ${releaseYear})
  `);
}

function personFallbackQuery(name: string, birthday?: string | null) {
  const normalizedName = name.trim();
  const birthYear = birthday?.match(/^(\d{4})-\d{2}-\d{2}$/)?.[1];

  if (!normalizedName || !birthYear) {
    return null;
  }

  return subjectSelectQuery(`
    ?item rdfs:label ${sparqlString(normalizedName)}@en;
      wdt:P31 wd:Q5;
      wdt:P569 ?birthDate.
    FILTER(YEAR(?birthDate) = ${birthYear})
  `);
}

function subjectSelectQuery(wherePattern: string) {
  return `
    SELECT ?item ?itemLabel ?article WHERE {
      ${wherePattern}
      OPTIONAL {
        ?article schema:about ?item;
          schema:isPartOf <https://en.wikipedia.org/>.
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 5
  `;
}

async function fetchClaims(qid: string, claimKinds: Array<[property: string, kind: string]>) {
  if (!/^Q\d+$/.test(qid)) {
    return {};
  }

  const values = claimKinds.map(([property, kind]) => `(${property} ${sparqlString(kind)})`).join("\n");
  const response = await fetchSparql<ClaimBinding>(`
    SELECT ?kind ?valueLabel WHERE {
      VALUES (?property ?kind) {
        ${values}
      }
      wd:${qid} ?property ?value.
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 80
  `);
  const claims: Record<string, string[]> = {};

  for (const binding of response?.results.bindings ?? []) {
    const kind = binding.kind.value;
    const value = binding.valueLabel?.value?.trim();

    if (!value || /^Q\d+$/.test(value)) {
      continue;
    }

    claims[kind] = [...(claims[kind] ?? []), value];
  }

  return Object.fromEntries(
    Object.entries(claims).map(([kind, valuesForKind]) => [
      kind,
      [...new Set(valuesForKind)].slice(0, 3),
    ]),
  );
}

async function resolveMovieSearchCandidate(qids: string[], releaseYear?: number | null) {
  const targetYear = typeof releaseYear === "number" ? releaseYear : null;

  if (qids.length === 0 || !targetYear) {
    return null;
  }

  const response = await fetchSparql<MovieCandidateBinding>(`
    SELECT ?item ?itemLabel ?article ?publicationDate WHERE {
      VALUES ?item { ${qids.map((qid) => `wd:${qid}`).join(" ")} }
      ?item wdt:P31/wdt:P279* wd:Q11424.
      OPTIONAL { ?item wdt:P577 ?publicationDate. }
      OPTIONAL {
        ?article schema:about ?item;
          schema:isPartOf <https://en.wikipedia.org/>.
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 20
  `);

  return selectBestSearchCandidate(
    qids,
    response?.results.bindings ?? [],
    (binding) => isNearbyYear(yearFromDate(binding.publicationDate?.value), targetYear),
  );
}

async function resolvePersonSearchCandidate(qids: string[], birthYear: number | null) {
  if (qids.length === 0 || !birthYear) {
    return null;
  }

  const response = await fetchSparql<PersonCandidateBinding>(`
    SELECT ?item ?itemLabel ?article ?birthDate WHERE {
      VALUES ?item { ${qids.map((qid) => `wd:${qid}`).join(" ")} }
      ?item wdt:P31 wd:Q5.
      OPTIONAL { ?item wdt:P569 ?birthDate. }
      OPTIONAL {
        ?article schema:about ?item;
          schema:isPartOf <https://en.wikipedia.org/>.
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 20
  `);

  return selectBestSearchCandidate(
    qids,
    response?.results.bindings ?? [],
    (binding) => yearFromDate(binding.birthDate?.value) === birthYear,
  );
}

function selectBestSearchCandidate<T extends SubjectBinding>(
  qids: string[],
  bindings: T[],
  isValid: (binding: T) => boolean,
) {
  const subjectsByQid = new Map<string, WikidataSubject>();

  for (const binding of bindings) {
    const qid = qidFromWikidataUrl(binding.item.value);

    if (!qid || subjectsByQid.has(qid) || !isValid(binding)) {
      continue;
    }

    subjectsByQid.set(qid, {
      articleUrl: binding.article?.value ?? null,
      label: binding.itemLabel?.value ?? null,
      qid,
    });
  }

  for (const qid of qids) {
    const subject = subjectsByQid.get(qid);

    if (subject?.articleUrl) {
      return subject;
    }
  }

  for (const qid of qids) {
    const subject = subjectsByQid.get(qid);

    if (subject) {
      return subject;
    }
  }

  return null;
}

async function fetchWikipediaSummary(articleUrl: string | null) {
  const title = wikipediaTitleFromUrl(articleUrl);

  if (!title) {
    return null;
  }

  try {
    const summary = await fetchJson<WikipediaSummary>(
      `${wikipediaSummaryBaseUrl}${encodeURIComponent(title)}`,
      { headers: wikimediaHeaders },
    );
    const extract = firstSentence(summary.extract);

    return {
      extract,
      sourceUrl: summary.content_urls?.desktop?.page ?? articleUrl,
    };
  } catch {
    return null;
  }
}

async function fetchSparql<T extends Record<string, SparqlValue | undefined>>(query: string) {
  const url = new URL(wikidataSparqlUrl);
  url.searchParams.set("format", "json");
  url.searchParams.set("query", query);

  try {
    return await fetchJson<SparqlResponse<T>>(url, { headers: wikimediaHeaders });
  } catch {
    return null;
  }
}

async function searchWikidataEntities(search: string) {
  const normalizedSearch = search.trim();

  if (!normalizedSearch) {
    return [];
  }

  const url = new URL(wikidataApiUrl);
  url.searchParams.set("action", "wbsearchentities");
  url.searchParams.set("format", "json");
  url.searchParams.set("language", "en");
  url.searchParams.set("limit", "8");
  url.searchParams.set("search", normalizedSearch);

  try {
    const response = await fetchJson<WikidataSearchResponse>(url, { headers: wikimediaHeaders });

    return uniqueQids(response.search?.map((candidate) => candidate.id) ?? []);
  } catch {
    return [];
  }
}

function wikipediaTitleFromUrl(articleUrl: string | null) {
  if (!articleUrl) {
    return null;
  }

  try {
    const url = new URL(articleUrl);
    const match = /^\/wiki\/(.+)$/.exec(url.pathname);

    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function firstSentence(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return null;
  }

  for (let index = 80; index < normalized.length; index += 1) {
    if (!".!?".includes(normalized[index])) {
      continue;
    }

    const next = normalized[index + 1];
    if (!next || next === " ") {
      return normalized.slice(0, index + 1);
    }
  }

  return normalized.length > 260 ? `${normalized.slice(0, 257).trimEnd()}...` : normalized;
}

function yearFromDate(value: string | null | undefined) {
  const year = value?.match(/^(\d{4})/)?.[1];

  return year ? Number(year) : null;
}

function isNearbyYear(candidateYear: number | null, targetYear: number) {
  return candidateYear !== null && Math.abs(candidateYear - targetYear) <= 1;
}

function claimTrivia(values: string[] | undefined, template: string, sourceUrl: string) {
  if (!values || values.length === 0) {
    return null;
  }

  return triviaItem(template.replace("{values}", formatList(values)), sourceUrl);
}

function triviaItem(text: string, sourceUrl: string): WikipediaTriviaItem {
  return {
    text,
    sourceLabel,
    sourceUrl,
  };
}

function uniqueTrivia(items: Array<WikipediaTriviaItem | null>) {
  const seen = new Set<string>();
  const uniqueItems: WikipediaTriviaItem[] = [];

  for (const item of items) {
    const key = item?.text.toLowerCase();

    if (!item || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueItems.push(item);
  }

  return uniqueItems;
}

function formatList(values: string[]) {
  if (values.length <= 1) {
    return values[0] ?? "";
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function qidFromWikidataUrl(value: string) {
  const match = /^https?:\/\/www\.wikidata\.org\/entity\/(Q\d+)$/.exec(value);
  return match?.[1] ?? null;
}

function uniqueQids(values: Array<string | undefined>) {
  const qids: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (!value || !/^Q\d+$/.test(value) || seen.has(value)) {
      continue;
    }

    seen.add(value);
    qids.push(value);
  }

  return qids;
}

function wikidataItemUrl(qid: string) {
  return `https://www.wikidata.org/wiki/${qid}`;
}

function sparqlString(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
