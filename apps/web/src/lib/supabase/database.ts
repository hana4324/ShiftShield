import type { Database as SharedDatabase } from "@shiftshield/shared";

/**
 * supabase-js constrains every `Row` / `Insert` / `Update` / `Args` to `Record<string, unknown>`.
 * The shared package declares its rows as interfaces, which have no implicit index signature and
 * therefore fail that constraint (the whole schema then resolves to `never`). Re-mapping each
 * interface into an anonymous object type restores the index signature without changing a field.
 */
type Mapped<T> = { [K in keyof T]: T[K] };

type SharedPublic = SharedDatabase["public"];

type MapTable<T extends { Row: unknown; Insert: unknown; Update: unknown }> = {
  Row: Mapped<T["Row"]>;
  Insert: Mapped<T["Insert"]>;
  Update: Mapped<T["Update"]>;
  Relationships: [];
};

type MapView<T extends { Row: unknown }> = { Row: Mapped<T["Row"]>; Relationships: [] };

type MapFunction<T extends { Args: unknown; Returns: unknown }> = {
  Args: Mapped<T["Args"]>;
  Returns: T["Returns"];
};

export type Database = {
  public: {
    Tables: { [K in keyof SharedPublic["Tables"]]: MapTable<SharedPublic["Tables"][K]> };
    Views: { [K in keyof SharedPublic["Views"]]: MapView<SharedPublic["Views"][K]> };
    Functions: { [K in keyof SharedPublic["Functions"]]: MapFunction<SharedPublic["Functions"][K]> };
    Enums: SharedPublic["Enums"];
    CompositeTypes: SharedPublic["CompositeTypes"];
  };
};
