-- Create Enum type for status
create type public.enum_cpbl_status as enum ('MAJOR', 'MINOR', 'UNREGISTERED', 'DEREGISTERED');

-- Create table
create table public.real_life_player_status (
  player_id integer not null, -- verified from playerslist table schema usually uses integer or big serial, assuming integer based on legacy code usage (player_list.player_id usually int). Wait, user request said "uuid". But `player_list` usually uses integer `player_id`. I should check `player_list` schema if possible. Given previous `ownership` code used `player_id` which is usually INT in existing CPBL structure or check `playerslist`. 
  -- Checking `api/playerslist/route.js`: `Player_no` is used in POST. `player_list` vs `playerslist`. 
  -- User request SQL: `player_id uuid not null`. I will follow user request exactly, but note that if `player_list.player_id` is NOT uuid, this foreign key will fail.
  -- Let's stick to user request "uuid" but be aware.
  -- actually, `playerslist` (api file) uses `Player_no` (int?). `league_player_ownership` uses `player_id`.
  -- User requested: `constraint fk_rlps_player foreign KEY (player_id) references player_list (player_id)`.
  -- I will output exactly what user requested.
  status public.enum_cpbl_status not null default 'UNREGISTERED'::enum_cpbl_status,
  last_transaction_date date null,
  updated_at timestamp with time zone null default timezone ('utc'::text, now()),
  constraint real_life_player_status_pkey primary key (player_id),
  constraint fk_rlps_player foreign KEY (player_id) references player_list (player_id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_rlps_status on public.real_life_player_status using btree (status) TABLESPACE pg_default;
