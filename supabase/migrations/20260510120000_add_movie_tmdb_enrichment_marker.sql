-- Track when a local movie row has been hydrated from TMDB details and credits.
-- Trakt pull can keep inserting minimal rows while later backfill/lazy paths mark enrichment.

alter table public.movies
  add column tmdb_enriched_at timestamptz null;

update public.movies
set tmdb_enriched_at = metadata_updated_at
where tmdb_enriched_at is null
  and (
    original_title is not null
    or release_date is not null
    or primary_genre_id is not null
    or primary_genre_name is not null
    or original_language is not null
    or overview is not null
    or poster_path is not null
    or backdrop_path is not null
    or runtime_minutes is not null
    or tmdb_vote_average is not null
    or tmdb_vote_count is not null
    or popularity is not null
  );

create index movies_tmdb_enriched_at_idx
  on public.movies (tmdb_enriched_at, metadata_updated_at);
