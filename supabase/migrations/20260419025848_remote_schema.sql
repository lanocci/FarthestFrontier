


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."can_manage_player"("target_player_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.is_coach()
    or exists (
      select 1
      from public.team_members tm
      where tm.user_id = auth.uid()
        and tm.status = 'approved'
        and target_player_id::text = any(tm.player_ids)
    )
$$;


ALTER FUNCTION "public"."can_manage_player"("target_player_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_team_member_by_email"("login_email" "text") RETURNS TABLE("user_id" "uuid", "email" "text", "player_ids" "text"[], "role" "text", "status" "text", "registration_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  normalized_email text := lower(trim(login_email));
begin
  if auth.uid() is null or normalized_email is null or normalized_email = '' then
    return;
  end if;

  return query
  with existing_self as (
    select tm.user_id, tm.email, tm.player_ids, tm.role, tm.status, tm.registration_message
    from public.team_members tm
    where tm.user_id = auth.uid()
  ),
  claimed as (
    update public.team_members tm
    set user_id = auth.uid(),
        email = normalized_email
    where not exists (select 1 from existing_self)
      and lower(coalesce(tm.email, '')) = normalized_email
    returning tm.user_id, tm.email, tm.player_ids, tm.role, tm.status, tm.registration_message
  )
  select es.user_id, es.email, es.player_ids, es.role, es.status, es.registration_message
  from existing_self es
  union all
  select c.user_id, c.email, c.player_ids, c.role, c.status, c.registration_message
  from claimed c
  limit 1;
end;
$$;


ALTER FUNCTION "public"."claim_team_member_by_email"("login_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_membership_status"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select tm.status
  from public.team_members tm
  where tm.user_id = auth.uid()
$$;


ALTER FUNCTION "public"."current_membership_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_team_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select tm.role
  from public.team_members tm
  where tm.user_id = auth.uid()
$$;


ALTER FUNCTION "public"."current_team_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_team_member"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not exists (
    select 1
    from public.team_members tm
    where lower(coalesce(tm.email, '')) = lower(coalesce(new.email, ''))
  ) then
    insert into public.team_members (user_id, email, player_ids, role, status)
    values (new.id, lower(new.email), '{}'::text[], 'guardian', 'pending')
    on conflict (user_id) do update
      set email = excluded.email;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_team_member"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_coach"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select public.current_team_role() = 'coach'
$$;


ALTER FUNCTION "public"."is_coach"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_team_member"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select public.current_team_role() in ('coach', 'guardian')
    and public.current_membership_status() = 'approved'
$$;


ALTER FUNCTION "public"."is_team_member"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."goal_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "goal_template_id" "text",
    "goal_text" "text" NOT NULL,
    "log_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "note" "text",
    "submitted_by_role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "goal_logs_submitted_by_role_check" CHECK (("submitted_by_role" = ANY (ARRAY['coach'::"text", 'guardian'::"text"])))
);


ALTER TABLE "public"."goal_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goal_templates" (
    "id" "text" NOT NULL,
    "side" "text" NOT NULL,
    "title" "text" NOT NULL,
    "prompt" "text" NOT NULL,
    "emoji" "text" DEFAULT '🏈'::"text" NOT NULL,
    "color" "text" DEFAULT 'orange'::"text" NOT NULL,
    "template_text" "text" NOT NULL,
    "input_placeholder" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "goal_templates_side_check" CHECK (("side" = ANY (ARRAY['offense'::"text", 'defense'::"text"])))
);


ALTER TABLE "public"."goal_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "material_type" "text" NOT NULL,
    "audience" "text" NOT NULL,
    "google_url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "materials_audience_check" CHECK (("audience" = ANY (ARRAY['all'::"text", 'guardians'::"text", 'coaches'::"text"]))),
    CONSTRAINT "materials_material_type_check" CHECK (("material_type" = ANY (ARRAY['slide'::"text", 'sheet'::"text", 'doc'::"text"])))
);


ALTER TABLE "public"."materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "jersey_number" "text",
    "grade_label" "text" NOT NULL,
    "guardian_name" "text" NOT NULL,
    "favorite_skill" "text",
    "offense_goal" "text",
    "defense_goal" "text",
    "offense_reflection_rating" smallint,
    "offense_reflection_comment" "text",
    "defense_reflection_rating" smallint,
    "defense_reflection_comment" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "offense_position_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "defense_position_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "players_defense_reflection_rating_check" CHECK ((("defense_reflection_rating" >= 1) AND ("defense_reflection_rating" <= 5))),
    CONSTRAINT "players_offense_reflection_rating_check" CHECK ((("offense_reflection_rating" >= 1) AND ("offense_reflection_rating" <= 5)))
);


ALTER TABLE "public"."players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."position_masters" (
    "id" "text" NOT NULL,
    "label" "text" NOT NULL,
    "side" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "position_masters_side_check" CHECK (("side" = ANY (ARRAY['offense'::"text", 'defense'::"text"])))
);


ALTER TABLE "public"."position_masters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."practice_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "practice_date" "date" NOT NULL,
    "offense_goal" "text",
    "defense_goal" "text",
    "offense_reflection_rating" smallint,
    "offense_reflection_comment" "text",
    "defense_reflection_rating" smallint,
    "defense_reflection_comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "practice_entries_defense_reflection_rating_check" CHECK ((("defense_reflection_rating" >= 1) AND ("defense_reflection_rating" <= 5))),
    CONSTRAINT "practice_entries_offense_reflection_rating_check" CHECK ((("offense_reflection_rating" >= 1) AND ("offense_reflection_rating" <= 5)))
);


ALTER TABLE "public"."practice_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."season_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "season_id" "uuid" NOT NULL,
    "offense_goal" "text",
    "defense_goal" "text",
    "offense_reflection_rating" smallint,
    "offense_reflection_comment" "text",
    "defense_reflection_rating" smallint,
    "defense_reflection_comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "season_goals_defense_reflection_rating_check" CHECK ((("defense_reflection_rating" >= 1) AND ("defense_reflection_rating" <= 5))),
    CONSTRAINT "season_goals_offense_reflection_rating_check" CHECK ((("offense_reflection_rating" >= 1) AND ("offense_reflection_rating" <= 5)))
);


ALTER TABLE "public"."season_goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seasons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "label" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "target_date" "date" NOT NULL,
    "active" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."seasons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text",
    "player_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "registration_message" "text",
    CONSTRAINT "team_members_role_check" CHECK (("role" = ANY (ARRAY['coach'::"text", 'guardian'::"text"]))),
    CONSTRAINT "team_members_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


ALTER TABLE ONLY "public"."goal_logs"
    ADD CONSTRAINT "goal_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_templates"
    ADD CONSTRAINT "goal_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."position_masters"
    ADD CONSTRAINT "position_masters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."practice_entries"
    ADD CONSTRAINT "practice_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."practice_entries"
    ADD CONSTRAINT "practice_entries_player_id_practice_date_key" UNIQUE ("player_id", "practice_date");



ALTER TABLE ONLY "public"."season_goals"
    ADD CONSTRAINT "season_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."season_goals"
    ADD CONSTRAINT "season_goals_player_id_season_id_key" UNIQUE ("player_id", "season_id");



ALTER TABLE ONLY "public"."seasons"
    ADD CONSTRAINT "seasons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("user_id");



CREATE UNIQUE INDEX "team_members_email_unique" ON "public"."team_members" USING "btree" ("lower"("email")) WHERE ("email" IS NOT NULL);



CREATE OR REPLACE TRIGGER "NewUserNotification" AFTER INSERT ON "public"."team_members" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://skltaucmhngaptjvnhem.supabase.co/functions/v1/rapid-task', 'POST', '{"Content-type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrbHRhdWNtaG5nYXB0anZuaGVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjExMjM4MywiZXhwIjoyMDkxNjg4MzgzfQ.Hdmg7TNqllRb3OiLXMGsWM9fx-nqNqjf1eSaR0ZcCEQ"}', '{}', '5000');



CREATE OR REPLACE TRIGGER "materials_set_updated_at" BEFORE UPDATE ON "public"."materials" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "practice_entries_set_updated_at" BEFORE UPDATE ON "public"."practice_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "season_goals_set_updated_at" BEFORE UPDATE ON "public"."season_goals" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."goal_logs"
    ADD CONSTRAINT "goal_logs_goal_template_id_fkey" FOREIGN KEY ("goal_template_id") REFERENCES "public"."goal_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."goal_logs"
    ADD CONSTRAINT "goal_logs_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."practice_entries"
    ADD CONSTRAINT "practice_entries_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_goals"
    ADD CONSTRAINT "season_goals_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_goals"
    ADD CONSTRAINT "season_goals_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."goal_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goal_logs_manage_coaches" ON "public"."goal_logs" TO "authenticated" USING ("public"."is_coach"()) WITH CHECK ("public"."is_coach"());



CREATE POLICY "goal_logs_select_team_members" ON "public"."goal_logs" FOR SELECT TO "authenticated" USING ("public"."is_team_member"());



ALTER TABLE "public"."goal_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goal_templates_manage_coaches" ON "public"."goal_templates" TO "authenticated" USING ("public"."is_coach"()) WITH CHECK ("public"."is_coach"());



CREATE POLICY "goal_templates_select_team_members" ON "public"."goal_templates" FOR SELECT TO "authenticated" USING ("public"."is_team_member"());



ALTER TABLE "public"."materials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "materials_manage_coaches" ON "public"."materials" TO "authenticated" USING ("public"."is_coach"()) WITH CHECK ("public"."is_coach"());



CREATE POLICY "materials_select_team_members" ON "public"."materials" FOR SELECT TO "authenticated" USING (("public"."is_coach"() OR ("public"."is_team_member"() AND ("audience" = ANY (ARRAY['all'::"text", 'guardians'::"text"])))));



ALTER TABLE "public"."players" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "players_manage_coaches" ON "public"."players" TO "authenticated" USING ("public"."is_coach"()) WITH CHECK ("public"."is_coach"());



CREATE POLICY "players_select_team_members" ON "public"."players" FOR SELECT TO "authenticated" USING ("public"."is_team_member"());



ALTER TABLE "public"."position_masters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "position_masters_manage_coaches" ON "public"."position_masters" TO "authenticated" USING ("public"."is_coach"()) WITH CHECK ("public"."is_coach"());



CREATE POLICY "position_masters_select_team_members" ON "public"."position_masters" FOR SELECT TO "authenticated" USING ("public"."is_team_member"());



ALTER TABLE "public"."practice_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "practice_entries_manage_team_members" ON "public"."practice_entries" TO "authenticated" USING ("public"."can_manage_player"("player_id")) WITH CHECK ("public"."can_manage_player"("player_id"));



CREATE POLICY "practice_entries_select_team_members" ON "public"."practice_entries" FOR SELECT TO "authenticated" USING ("public"."is_team_member"());



ALTER TABLE "public"."season_goals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "season_goals_manage_team_members" ON "public"."season_goals" TO "authenticated" USING ("public"."can_manage_player"("player_id")) WITH CHECK ("public"."can_manage_player"("player_id"));



CREATE POLICY "season_goals_select_team_members" ON "public"."season_goals" FOR SELECT TO "authenticated" USING ("public"."is_team_member"());



ALTER TABLE "public"."seasons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "seasons_manage_coaches" ON "public"."seasons" TO "authenticated" USING ("public"."is_coach"()) WITH CHECK ("public"."is_coach"());



CREATE POLICY "seasons_select_team_members" ON "public"."seasons" FOR SELECT TO "authenticated" USING ("public"."is_team_member"());



ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_members_insert_self" ON "public"."team_members" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("lower"(COALESCE("email", ''::"text")) = "lower"(COALESCE(("auth"."jwt"() ->> 'email'::"text"), ''::"text"))) AND ("role" = 'guardian'::"text") AND ("status" = 'pending'::"text")));



CREATE POLICY "team_members_manage_coaches" ON "public"."team_members" FOR UPDATE TO "authenticated" USING ("public"."is_coach"()) WITH CHECK ("public"."is_coach"());



CREATE POLICY "team_members_select_coaches" ON "public"."team_members" FOR SELECT TO "authenticated" USING ("public"."is_coach"());



CREATE POLICY "team_members_select_self" ON "public"."team_members" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "team_members_update_self_message" ON "public"."team_members" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND ("status" = 'pending'::"text"))) WITH CHECK ((("user_id" = "auth"."uid"()) AND ("status" = 'pending'::"text")));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."can_manage_player"("target_player_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_player"("target_player_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_player"("target_player_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_team_member_by_email"("login_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_team_member_by_email"("login_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_team_member_by_email"("login_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_membership_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_membership_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_membership_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_team_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_team_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_team_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_team_member"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_team_member"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_team_member"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_coach"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_coach"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_coach"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_team_member"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_team_member"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_team_member"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."goal_logs" TO "anon";
GRANT ALL ON TABLE "public"."goal_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_logs" TO "service_role";



GRANT ALL ON TABLE "public"."goal_templates" TO "anon";
GRANT ALL ON TABLE "public"."goal_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_templates" TO "service_role";



GRANT ALL ON TABLE "public"."materials" TO "anon";
GRANT ALL ON TABLE "public"."materials" TO "authenticated";
GRANT ALL ON TABLE "public"."materials" TO "service_role";



GRANT ALL ON TABLE "public"."players" TO "anon";
GRANT ALL ON TABLE "public"."players" TO "authenticated";
GRANT ALL ON TABLE "public"."players" TO "service_role";



GRANT ALL ON TABLE "public"."position_masters" TO "anon";
GRANT ALL ON TABLE "public"."position_masters" TO "authenticated";
GRANT ALL ON TABLE "public"."position_masters" TO "service_role";



GRANT ALL ON TABLE "public"."practice_entries" TO "anon";
GRANT ALL ON TABLE "public"."practice_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."practice_entries" TO "service_role";



GRANT ALL ON TABLE "public"."season_goals" TO "anon";
GRANT ALL ON TABLE "public"."season_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."season_goals" TO "service_role";



GRANT ALL ON TABLE "public"."seasons" TO "anon";
GRANT ALL ON TABLE "public"."seasons" TO "authenticated";
GRANT ALL ON TABLE "public"."seasons" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































CREATE TRIGGER on_auth_user_created_team_member AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_team_member();


