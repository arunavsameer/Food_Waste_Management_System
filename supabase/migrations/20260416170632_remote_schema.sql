


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


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."day_enum" AS ENUM (
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday'
);


ALTER TYPE "public"."day_enum" OWNER TO "postgres";


CREATE TYPE "public"."food_type_enum" AS ENUM (
    'regular',
    'jain'
);


ALTER TYPE "public"."food_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."hostel_enum" AS ENUM (
    'APJ',
    'CVR',
    'DA',
    'VSB',
    'HJB',
    'JCB',
    'PM Ajay',
    'Others'
);


ALTER TYPE "public"."hostel_enum" OWNER TO "postgres";


CREATE TYPE "public"."meal_type_enum" AS ENUM (
    'breakfast',
    'lunch',
    'dinner'
);


ALTER TYPE "public"."meal_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."question_type_enum" AS ENUM (
    'rating',
    'text',
    'yes_no'
);


ALTER TYPE "public"."question_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."role_enum" AS ENUM (
    'student',
    'caterer',
    'admin'
);


ALTER TYPE "public"."role_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."role_enum" IS 'person type';



CREATE TYPE "public"."wastage_type_enum" AS ENUM (
    'plate_waste',
    'kitchen_uncooked',
    'platform_waste'
);


ALTER TYPE "public"."wastage_type_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_admin"("user_id_to_delete" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- 1. Clean up student dependencies (if they exist)
  DELETE FROM skip_table WHERE student_id = user_id_to_delete;
  DELETE FROM feedback WHERE student_id = user_id_to_delete;
  DELETE FROM player_score WHERE student_id = user_id_to_delete;
  
  -- 2. Clean up caterer dependencies (if they exist)
  DELETE FROM waste_reports WHERE caterer_id = user_id_to_delete;
  DELETE FROM feedback_cal WHERE caterer_id = user_id_to_delete;

  -- 3. Clean up generic profile dependencies
  DELETE FROM messages WHERE sender_id = user_id_to_delete OR reciever_id = user_id_to_delete;

  -- 4. Delete from specific role tables
  DELETE FROM students WHERE id = user_id_to_delete;
  DELETE FROM admins WHERE admin_id = user_id_to_delete;
  DELETE FROM caterers WHERE caterer_id = user_id_to_delete;
  
  -- 5. Delete from public profiles
  DELETE FROM profiles WHERE id = user_id_to_delete;
  
  -- 6. Finally, delete from the secure authentication table
  DELETE FROM auth.users WHERE id = user_id_to_delete;
END;
$$;


ALTER FUNCTION "public"."delete_user_admin"("user_id_to_delete" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  pre_reg_record record;
BEGIN
  -- 1. Check pre-registrations
  SELECT * INTO pre_reg_record
  FROM public.pre_registrations
  WHERE email = NEW.email;

  -- 2. Enforce access
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access Denied: Email % is not pre-registered. Please contact the administrator.', NEW.email;
  END IF;

  -- 3. Update JWT
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', pre_reg_record.role)
  WHERE id = NEW.id;

  -- 4. Create Profile with exact enum casting
  INSERT INTO public.profiles (id, email, role, mess_name)
  VALUES (
    NEW.id, 
    NEW.email, 
    pre_reg_record.role::public.role_enum, -- <--- Explicitly cast to your enum here
    pre_reg_record.mess_name
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_feedback_cal"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Insert the very first rating for this date/meal/caterer
  INSERT INTO public.feedback_cal (date, meal_type, caterer_id, feedback_count, average)
  VALUES (NEW.date, NEW.meal_type, NEW.caterer_id, 1, NEW.rating)
  
  -- If this date/meal/caterer already exists, apply the rolling average formula
  ON CONFLICT (date, meal_type, caterer_id)
  DO UPDATE SET
    feedback_count = feedback_cal.feedback_count + 1,
    average = feedback_cal.average + ((NEW.rating - feedback_cal.average) / (feedback_cal.feedback_count + 1));
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_feedback_cal"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admins" (
    "admin_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "phone_no" "text"
);


ALTER TABLE "public"."admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."caterers" (
    "caterer_id" "uuid" NOT NULL,
    "name" character varying(150) NOT NULL,
    "manager_name" "text" NOT NULL,
    "phone_no" "text" NOT NULL
);


ALTER TABLE "public"."caterers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_emission_factors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "category" "text",
    "name" "text" NOT NULL,
    "process_ef" numeric NOT NULL,
    "transport_km" numeric DEFAULT 0,
    "transport_ef" numeric DEFAULT 0.00015,
    "calculated_ef" numeric NOT NULL,
    CONSTRAINT "custom_emission_factors_category_check" CHECK (("category" = ANY (ARRAY['baseline'::"text", 'project'::"text"])))
);


ALTER TABLE "public"."custom_emission_factors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" integer NOT NULL,
    "caterer_id" "uuid" NOT NULL,
    "meal_type" "public"."meal_type_enum" NOT NULL,
    "rating" smallint NOT NULL,
    "comment" "text",
    "student_id" "uuid",
    "date" "date" NOT NULL,
    CONSTRAINT "feedback_meal_type_check" CHECK ((("meal_type")::"text" = ANY (ARRAY[('breakfast'::character varying)::"text", ('lunch'::character varying)::"text", ('dinner'::character varying)::"text"]))),
    CONSTRAINT "feedback_rating_check" CHECK ((("rating" >= 0) AND ("rating" <= 10)))
);


ALTER TABLE "public"."feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_cal" (
    "date" "date" NOT NULL,
    "meal_type" "public"."meal_type_enum" NOT NULL,
    "feedback_count" integer DEFAULT 0,
    "average" real DEFAULT '0'::real,
    "caterer_id" "uuid" NOT NULL
);


ALTER TABLE "public"."feedback_cal" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."feedback_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."feedback_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."feedback_id_seq" OWNED BY "public"."feedback"."id";



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "message_time" timestamp with time zone NOT NULL,
    "message" "text" NOT NULL,
    "reciever_id" "uuid"
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_score" (
    "student_id" "uuid" NOT NULL,
    "game_points" integer DEFAULT 0 NOT NULL,
    "high_score" integer DEFAULT 0 NOT NULL,
    "attempts_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."player_score" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pre_registrations" (
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "mess_name" "text",
    "caterer_id" "uuid",
    "hostel" "text",
    "food_type" "text",
    "manager_name" "text",
    "phone_no" "text",
    "admin_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pre_registrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "role" "public"."role_enum",
    "mess_name" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "check_student_mess" CHECK ((("role" <> 'student'::"public"."role_enum") OR ("mess_name" IS NOT NULL)))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."skip_table" (
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "menu_type" "public"."meal_type_enum" NOT NULL,
    "student_id" "uuid" NOT NULL
);


ALTER TABLE "public"."skip_table" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."students" (
    "roll_no" "text" NOT NULL,
    "name" "text" NOT NULL,
    "hostel" "public"."hostel_enum",
    "caterer_id" "uuid",
    "food_type" "public"."food_type_enum" NOT NULL,
    "id" "uuid" NOT NULL,
    "serial_no" integer
);


ALTER TABLE "public"."students" OWNER TO "postgres";


COMMENT ON COLUMN "public"."students"."serial_no" IS 'serial number of the student, given by the caterer';



CREATE TABLE IF NOT EXISTS "public"."waste_reports" (
    "report_id" integer NOT NULL,
    "caterer_id" "uuid" NOT NULL,
    "report_date" "date" NOT NULL,
    "meal_type" "public"."meal_type_enum" NOT NULL,
    "plate_waste" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "kitchen_uncooked" numeric NOT NULL,
    "kitchen_cooked" numeric NOT NULL,
    CONSTRAINT "waste_reports_wastage_quantity_check" CHECK (("plate_waste" >= (0)::numeric))
);


ALTER TABLE "public"."waste_reports" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."waste_reports_report_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."waste_reports_report_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."waste_reports_report_id_seq" OWNED BY "public"."waste_reports"."report_id";



CREATE TABLE IF NOT EXISTS "public"."weekly_menu" (
    "id" integer NOT NULL,
    "meal_type" "public"."meal_type_enum" NOT NULL,
    "menu_items" "text" NOT NULL,
    "food_type" "public"."food_type_enum" NOT NULL,
    "date" "date" NOT NULL
);


ALTER TABLE "public"."weekly_menu" OWNER TO "postgres";


ALTER TABLE "public"."weekly_menu" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."weekly_menu_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."feedback" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."feedback_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."waste_reports" ALTER COLUMN "report_id" SET DEFAULT "nextval"('"public"."waste_reports_report_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."admins"
    ADD CONSTRAINT "admins_pkey" PRIMARY KEY ("admin_id");



ALTER TABLE ONLY "public"."caterers"
    ADD CONSTRAINT "caterers_phone_no_key" UNIQUE ("phone_no");



ALTER TABLE ONLY "public"."caterers"
    ADD CONSTRAINT "caterers_pkey" PRIMARY KEY ("caterer_id");



ALTER TABLE ONLY "public"."custom_emission_factors"
    ADD CONSTRAINT "custom_emission_factors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_cal"
    ADD CONSTRAINT "feedback_cal_pkey" PRIMARY KEY ("date", "meal_type", "caterer_id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_score"
    ADD CONSTRAINT "player_score_pkey" PRIMARY KEY ("student_id");



ALTER TABLE ONLY "public"."pre_registrations"
    ADD CONSTRAINT "pre_registrations_pkey" PRIMARY KEY ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."skip_table"
    ADD CONSTRAINT "skip_table_pkey" PRIMARY KEY ("date", "menu_type", "student_id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_roll_no_key" UNIQUE ("roll_no");



ALTER TABLE ONLY "public"."waste_reports"
    ADD CONSTRAINT "waste_reports_pkey" PRIMARY KEY ("report_id");



ALTER TABLE ONLY "public"."weekly_menu"
    ADD CONSTRAINT "weekly_menu_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "unique_caterer_name_ci" ON "public"."caterers" USING "btree" ("lower"(("name")::"text"));



CREATE OR REPLACE TRIGGER "trigger_update_feedback_cal" AFTER INSERT ON "public"."feedback" FOR EACH ROW EXECUTE FUNCTION "public"."update_feedback_cal"();



ALTER TABLE ONLY "public"."admins"
    ADD CONSTRAINT "admins_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_cal"
    ADD CONSTRAINT "feedback_cal_caterer_id_fkey" FOREIGN KEY ("caterer_id") REFERENCES "public"."caterers"("caterer_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."caterers"
    ADD CONSTRAINT "fk_caterer_profile" FOREIGN KEY ("caterer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "fk_feedback_caterer" FOREIGN KEY ("caterer_id") REFERENCES "public"."caterers"("caterer_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_score"
    ADD CONSTRAINT "fk_player_score_student" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_reciever_id_fkey" FOREIGN KEY ("reciever_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."pre_registrations"
    ADD CONSTRAINT "pre_registrations_caterer_id_fkey" FOREIGN KEY ("caterer_id") REFERENCES "public"."caterers"("caterer_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."skip_table"
    ADD CONSTRAINT "skip_table_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_caterer_id_fkey" FOREIGN KEY ("caterer_id") REFERENCES "public"."caterers"("caterer_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."waste_reports"
    ADD CONSTRAINT "waste_reports_caterer_id_fkey" FOREIGN KEY ("caterer_id") REFERENCES "public"."caterers"("caterer_id") ON DELETE CASCADE;



CREATE POLICY "Admins and caterers access all messages" ON "public"."messages" USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'caterer'::"text"])));



CREATE POLICY "Admins can insert admins" ON "public"."admins" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"public"."role_enum"));



CREATE POLICY "Admins can insert caterers" ON "public"."caterers" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"public"."role_enum"));



CREATE POLICY "Admins can insert profiles" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "profiles_1"."role"
   FROM "public"."profiles" "profiles_1"
  WHERE ("profiles_1"."id" = "auth"."uid"())) = 'admin'::"public"."role_enum"));



CREATE POLICY "Admins can insert students" ON "public"."students" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"public"."role_enum"));



CREATE POLICY "Admins can manage admins" ON "public"."admins" USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can manage emission factors" ON "public"."custom_emission_factors" TO "authenticated" USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text")) WITH CHECK (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can update admins" ON "public"."admins" FOR UPDATE TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"public"."role_enum"));



CREATE POLICY "Admins can update caterers" ON "public"."caterers" FOR UPDATE TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"public"."role_enum"));



CREATE POLICY "Admins can update profiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "profiles_1"."role"
   FROM "public"."profiles" "profiles_1"
  WHERE ("profiles_1"."id" = "auth"."uid"())) = 'admin'::"public"."role_enum"));



CREATE POLICY "Admins can update students" ON "public"."students" FOR UPDATE TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"public"."role_enum"));



CREATE POLICY "Admins manage caterers" ON "public"."caterers" USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins manage students" ON "public"."students" USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins manage weekly menu" ON "public"."weekly_menu" USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins view waste reports" ON "public"."waste_reports" FOR SELECT USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Caterers manage own waste reports" ON "public"."waste_reports" USING ((("caterer_id" = "auth"."uid"()) AND ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'caterer'::"text")));



CREATE POLICY "Caterers view skips" ON "public"."skip_table" FOR SELECT USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'caterer'::"text"));



CREATE POLICY "Enable read/write for admins" ON "public"."pre_registrations" USING (true);



CREATE POLICY "Everyone views feedback" ON "public"."feedback" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Everyone views feedback_cal" ON "public"."feedback_cal" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Everyone views weekly menu" ON "public"."weekly_menu" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Public profiles are viewable by everyone" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Strict read access for admins table" ON "public"."admins" FOR SELECT USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'caterer'::"text"])));



CREATE POLICY "Strict read access for caterers table" ON "public"."caterers" FOR SELECT USING ((("caterer_id" = "auth"."uid"()) OR ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = ANY (ARRAY['student'::"text", 'admin'::"text"]))));



CREATE POLICY "Strict read access for students table" ON "public"."students" FOR SELECT USING ((("id" = "auth"."uid"()) OR ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'caterer'::"text"]))));



CREATE POLICY "Students can see student scores" ON "public"."player_score" USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'student'::"text"));



CREATE POLICY "Students manage feedback_cal" ON "public"."feedback_cal" USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'student'::"text"));



CREATE POLICY "Students manage own feedback" ON "public"."feedback" USING ((("student_id" = "auth"."uid"()) AND ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'student'::"text")));



CREATE POLICY "Students manage own skips" ON "public"."skip_table" USING (("student_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."admins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."caterers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_emission_factors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_cal" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."player_score" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pre_registrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."skip_table" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."students" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."waste_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_menu" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."delete_user_admin"("user_id_to_delete" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_admin"("user_id_to_delete" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_admin"("user_id_to_delete" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_feedback_cal"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_feedback_cal"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_feedback_cal"() TO "service_role";
























GRANT ALL ON TABLE "public"."admins" TO "anon";
GRANT ALL ON TABLE "public"."admins" TO "authenticated";
GRANT ALL ON TABLE "public"."admins" TO "service_role";



GRANT ALL ON TABLE "public"."caterers" TO "anon";
GRANT ALL ON TABLE "public"."caterers" TO "authenticated";
GRANT ALL ON TABLE "public"."caterers" TO "service_role";



GRANT ALL ON TABLE "public"."custom_emission_factors" TO "anon";
GRANT ALL ON TABLE "public"."custom_emission_factors" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_emission_factors" TO "service_role";



GRANT ALL ON TABLE "public"."feedback" TO "anon";
GRANT ALL ON TABLE "public"."feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_cal" TO "anon";
GRANT ALL ON TABLE "public"."feedback_cal" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_cal" TO "service_role";



GRANT ALL ON SEQUENCE "public"."feedback_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."feedback_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."feedback_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."player_score" TO "anon";
GRANT ALL ON TABLE "public"."player_score" TO "authenticated";
GRANT ALL ON TABLE "public"."player_score" TO "service_role";



GRANT ALL ON TABLE "public"."pre_registrations" TO "anon";
GRANT ALL ON TABLE "public"."pre_registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."pre_registrations" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."skip_table" TO "anon";
GRANT ALL ON TABLE "public"."skip_table" TO "authenticated";
GRANT ALL ON TABLE "public"."skip_table" TO "service_role";



GRANT ALL ON TABLE "public"."students" TO "anon";
GRANT ALL ON TABLE "public"."students" TO "authenticated";
GRANT ALL ON TABLE "public"."students" TO "service_role";



GRANT ALL ON TABLE "public"."waste_reports" TO "anon";
GRANT ALL ON TABLE "public"."waste_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."waste_reports" TO "service_role";



GRANT ALL ON SEQUENCE "public"."waste_reports_report_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."waste_reports_report_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."waste_reports_report_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_menu" TO "anon";
GRANT ALL ON TABLE "public"."weekly_menu" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_menu" TO "service_role";



GRANT ALL ON SEQUENCE "public"."weekly_menu_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."weekly_menu_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."weekly_menu_id_seq" TO "service_role";









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































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


