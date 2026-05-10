import type { JsonValue } from "@/lib/fetch";

export type Json = JsonValue;

export type MovieStatus = "watched" | "to_watch";
export type WatchLogSource = "manual" | "trakt_sync" | "tmdb_sync" | "import";
export type Provider = "trakt" | "tmdb";
export type ProviderMappingProvider = Provider | "imdb";
export type ProviderConnectionStatus = "active" | "revoked" | "error";
export type SyncDirection = "push" | "pull";
export type SyncEventStatus = "pending" | "success" | "error";
export type SyncItemFailureStatus = "pending" | "resolved";
export type SyncRunStatus = "running" | "success" | "error" | "cancelled";

export type Database = {
  public: {
    Tables: {
      movies: {
        Row: {
          id: string;
          tmdb_id: number;
          imdb_id: string | null;
          title: string;
          original_title: string | null;
          release_date: string | null;
          release_year: number | null;
          primary_genre_id: number | null;
          primary_genre_name: string | null;
          original_language: string | null;
          overview: string | null;
          poster_path: string | null;
          backdrop_path: string | null;
          runtime_minutes: number | null;
          tmdb_vote_average: number | null;
          tmdb_vote_count: number | null;
          popularity: number | null;
          metadata_updated_at: string;
          tmdb_enriched_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tmdb_id: number;
          imdb_id?: string | null;
          title: string;
          original_title?: string | null;
          release_date?: string | null;
          primary_genre_id?: number | null;
          primary_genre_name?: string | null;
          original_language?: string | null;
          overview?: string | null;
          poster_path?: string | null;
          backdrop_path?: string | null;
          runtime_minutes?: number | null;
          tmdb_vote_average?: number | null;
          tmdb_vote_count?: number | null;
          popularity?: number | null;
          metadata_updated_at?: string;
          tmdb_enriched_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tmdb_id?: number;
          imdb_id?: string | null;
          title?: string;
          original_title?: string | null;
          release_date?: string | null;
          primary_genre_id?: number | null;
          primary_genre_name?: string | null;
          original_language?: string | null;
          overview?: string | null;
          poster_path?: string | null;
          backdrop_path?: string | null;
          runtime_minutes?: number | null;
          tmdb_vote_average?: number | null;
          tmdb_vote_count?: number | null;
          popularity?: number | null;
          metadata_updated_at?: string;
          tmdb_enriched_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      movie_cast: {
        Row: {
          id: string;
          movie_id: string;
          tmdb_person_id: number;
          name: string;
          character_name: string | null;
          profile_path: string | null;
          cast_order: number | null;
        };
        Insert: {
          id?: string;
          movie_id: string;
          tmdb_person_id: number;
          name: string;
          character_name?: string | null;
          profile_path?: string | null;
          cast_order?: number | null;
        };
        Update: {
          id?: string;
          movie_id?: string;
          tmdb_person_id?: number;
          name?: string;
          character_name?: string | null;
          profile_path?: string | null;
          cast_order?: number | null;
        };
        Relationships: [];
      };
      user_movies: {
        Row: {
          id: string;
          user_id: string;
          movie_id: string;
          status: MovieStatus;
          personal_rating: number | null;
          added_at: string;
          watchlisted_at: string | null;
          last_watched_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          movie_id: string;
          status: MovieStatus;
          personal_rating?: number | null;
          added_at?: string;
          watchlisted_at?: string | null;
          last_watched_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          movie_id?: string;
          status?: MovieStatus;
          personal_rating?: number | null;
          added_at?: string;
          watchlisted_at?: string | null;
          last_watched_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_movies_movie_id_fkey";
            columns: ["movie_id"];
            isOneToOne: false;
            referencedRelation: "movies";
            referencedColumns: ["id"];
          },
        ];
      };
      watch_logs: {
        Row: {
          id: string;
          user_id: string;
          movie_id: string;
          watched_at: string;
          source: WatchLogSource;
          provider_event_id: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          movie_id: string;
          watched_at: string;
          source: WatchLogSource;
          provider_event_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          movie_id?: string;
          watched_at?: string;
          source?: WatchLogSource;
          provider_event_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "watch_logs_movie_id_fkey";
            columns: ["movie_id"];
            isOneToOne: false;
            referencedRelation: "movies";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          normalized_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          normalized_name?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          normalized_name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      user_movie_tags: {
        Row: {
          user_id: string;
          movie_id: string;
          tag_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          movie_id: string;
          tag_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          movie_id?: string;
          tag_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_movie_tags_movie_id_fkey";
            columns: ["movie_id"];
            isOneToOne: false;
            referencedRelation: "movies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_movie_tags_tag_id_user_id_fkey";
            columns: ["tag_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      provider_connections: {
        Row: {
          id: string;
          user_id: string;
          provider: Provider;
          provider_user_id: string | null;
          token_expires_at: string | null;
          scopes: string[] | null;
          status: ProviderConnectionStatus;
          last_validated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: Provider;
          provider_user_id?: string | null;
          token_expires_at?: string | null;
          scopes?: string[] | null;
          status?: ProviderConnectionStatus;
          last_validated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider?: Provider;
          provider_user_id?: string | null;
          token_expires_at?: string | null;
          scopes?: string[] | null;
          status?: ProviderConnectionStatus;
          last_validated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      provider_connection_secrets: {
        Row: {
          id: string;
          connection_id: string;
          user_id: string;
          provider: Provider;
          access_token_secret_id: string | null;
          refresh_token_secret_id: string | null;
          client_id_encrypted: string | null;
          client_secret_encrypted: string | null;
          api_token_encrypted: string | null;
          access_token_encrypted: string | null;
          refresh_token_encrypted: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          connection_id: string;
          user_id: string;
          provider: Provider;
          access_token_secret_id?: string | null;
          refresh_token_secret_id?: string | null;
          client_id_encrypted?: string | null;
          client_secret_encrypted?: string | null;
          api_token_encrypted?: string | null;
          access_token_encrypted?: string | null;
          refresh_token_encrypted?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          connection_id?: string;
          user_id?: string;
          provider?: Provider;
          access_token_secret_id?: string | null;
          refresh_token_secret_id?: string | null;
          client_id_encrypted?: string | null;
          client_secret_encrypted?: string | null;
          api_token_encrypted?: string | null;
          access_token_encrypted?: string | null;
          refresh_token_encrypted?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_connection_secrets_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: true;
            referencedRelation: "provider_connections";
            referencedColumns: ["id"];
          },
        ];
      };
      provider_mappings: {
        Row: {
          movie_id: string;
          provider: ProviderMappingProvider;
          provider_movie_id: string;
          created_at: string;
        };
        Insert: {
          movie_id: string;
          provider: ProviderMappingProvider;
          provider_movie_id: string;
          created_at?: string;
        };
        Update: {
          movie_id?: string;
          provider?: ProviderMappingProvider;
          provider_movie_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_mappings_movie_id_fkey";
            columns: ["movie_id"];
            isOneToOne: false;
            referencedRelation: "movies";
            referencedColumns: ["id"];
          },
        ];
      };
      sync_cursors: {
        Row: {
          id: string;
          user_id: string;
          provider: Provider;
          cursor_key: string;
          cursor_value: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: Provider;
          cursor_key: string;
          cursor_value?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider?: Provider;
          cursor_key?: string;
          cursor_value?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      sync_events: {
        Row: {
          id: string;
          user_id: string;
          provider: Provider;
          direction: SyncDirection;
          event_type: string;
          status: SyncEventStatus;
          payload: Json;
          error_message: string | null;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: Provider;
          direction: SyncDirection;
          event_type: string;
          status: SyncEventStatus;
          payload?: Json;
          error_message?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider?: Provider;
          direction?: SyncDirection;
          event_type?: string;
          status?: SyncEventStatus;
          payload?: Json;
          error_message?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
        Relationships: [];
      };
      sync_item_failures: {
        Row: {
          id: string;
          user_id: string;
          sync_run_id: string | null;
          provider: Provider;
          direction: SyncDirection;
          phase: string;
          item_key: string;
          item_payload: Json;
          error_message: string;
          retry_status: SyncItemFailureStatus;
          attempt_count: number;
          first_failed_at: string;
          last_failed_at: string;
          resolved_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          sync_run_id?: string | null;
          provider: Provider;
          direction: SyncDirection;
          phase: string;
          item_key: string;
          item_payload?: Json;
          error_message: string;
          retry_status?: SyncItemFailureStatus;
          attempt_count?: number;
          first_failed_at?: string;
          last_failed_at?: string;
          resolved_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          sync_run_id?: string | null;
          provider?: Provider;
          direction?: SyncDirection;
          phase?: string;
          item_key?: string;
          item_payload?: Json;
          error_message?: string;
          retry_status?: SyncItemFailureStatus;
          attempt_count?: number;
          first_failed_at?: string;
          last_failed_at?: string;
          resolved_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sync_item_failures_sync_run_id_fkey";
            columns: ["sync_run_id"];
            isOneToOne: false;
            referencedRelation: "sync_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      user_preferences: {
        Row: {
          user_id: string;
          co_watch_tag: string | null;
          theme: "light" | "dark" | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          co_watch_tag?: string | null;
          theme?: "light" | "dark" | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          co_watch_tag?: string | null;
          theme?: "light" | "dark" | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      sync_runs: {
        Row: {
          id: string;
          user_id: string;
          provider: Provider;
          direction: SyncDirection;
          status: SyncRunStatus;
          phase: string;
          label: string;
          current: number;
          total: number;
          summary: Json;
          error_message: string | null;
          started_at: string;
          updated_at: string;
          finished_at: string | null;
          cancelled_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: Provider;
          direction: SyncDirection;
          status?: SyncRunStatus;
          phase?: string;
          label?: string;
          current?: number;
          total?: number;
          summary?: Json;
          error_message?: string | null;
          started_at?: string;
          updated_at?: string;
          finished_at?: string | null;
          cancelled_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider?: Provider;
          direction?: SyncDirection;
          status?: SyncRunStatus;
          phase?: string;
          label?: string;
          current?: number;
          total?: number;
          summary?: Json;
          error_message?: string | null;
          started_at?: string;
          updated_at?: string;
          finished_at?: string | null;
          cancelled_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type PublicTableName = keyof Database["public"]["Tables"];
type PublicTable<TTable extends PublicTableName> = Database["public"]["Tables"][TTable];

export type TableRow<TTable extends PublicTableName> = PublicTable<TTable>["Row"];
export type TableInsert<TTable extends PublicTableName> = PublicTable<TTable>["Insert"];
export type TableUpdate<TTable extends PublicTableName> = PublicTable<TTable>["Update"];

export type Movie = TableRow<"movies">;
export type MovieInsert = TableInsert<"movies">;
export type MovieUpdate = TableUpdate<"movies">;
export type MovieCastMember = TableRow<"movie_cast">;
export type MovieCastMemberInsert = TableInsert<"movie_cast">;
export type UserMovie = TableRow<"user_movies">;
export type UserMovieInsert = TableInsert<"user_movies">;
export type UserMovieUpdate = TableUpdate<"user_movies">;
export type WatchLog = TableRow<"watch_logs">;
export type WatchLogInsert = TableInsert<"watch_logs">;
export type Tag = TableRow<"tags">;
export type TagInsert = TableInsert<"tags">;
export type UserMovieTag = TableRow<"user_movie_tags">;
export type ProviderConnection = TableRow<"provider_connections">;
export type ProviderConnectionSecret = TableRow<"provider_connection_secrets">;
export type ProviderMapping = TableRow<"provider_mappings">;
export type ProviderMappingInsert = TableInsert<"provider_mappings">;
export type SyncCursor = TableRow<"sync_cursors">;
export type SyncEvent = TableRow<"sync_events">;
export type SyncEventUpdate = TableUpdate<"sync_events">;
export type SyncItemFailure = TableRow<"sync_item_failures">;
export type SyncItemFailureInsert = TableInsert<"sync_item_failures">;
export type SyncRun = TableRow<"sync_runs">;
export type UserPreferences = TableRow<"user_preferences">;
export type Theme = NonNullable<UserPreferences["theme"]> | "auto";

export type UserMovieWithMovie = UserMovie & {
  movie: Movie;
  tags: Tag[];
};

export type MovieDetail = Movie & {
  cast: MovieCastMember[];
  userMovie: UserMovie | null;
  watchLogs: WatchLog[];
  tags: Tag[];
};

export type LibraryStatsTimeBucket = {
  key: string;
  label: string;
  count: number;
  runtimeMinutes: number;
};

export type LibraryStatsBreakdownItem = {
  key: string;
  label: string;
  count: number;
  percentage: number;
};

export type LibraryStatsRatingBucket = {
  rating: number;
  count: number;
};

export type LibraryStats = {
  watchedCount: number;
  watchEventCount: number;
  runtimeMinutes: number;
  avgRuntimeMinutes: number;
  avgRating: number | null;
  favGenre: string | null;
  favGenreCount: number | null;
  favDecade: string | null;
  coWatchMinutes: number;
  monthBuckets: LibraryStatsTimeBucket[];
  yearBuckets: LibraryStatsTimeBucket[];
  genreBreakdown: LibraryStatsBreakdownItem[];
  languageBreakdown: LibraryStatsBreakdownItem[];
  tagBreakdown: LibraryStatsBreakdownItem[];
  ratingBreakdown: LibraryStatsRatingBucket[];
};
