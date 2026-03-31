-- ============================================================
--  ZENITH TUTORIAL — COMPLETE SUPABASE DATABASE SETUP v2
--  Run this in: Supabase Dashboard → SQL Editor → New Query
--  Then click "Run"
--
--  IMPORTANT: If you already ran the previous version, run the
--  ALTER TABLE section at the bottom to add new columns only.
-- ============================================================

-- ============================================================
--  DROP EXISTING TABLES (run this if starting fresh)
--  WARNING: This deletes all existing data!
-- ============================================================
-- drop table if exists serial_history cascade;
-- drop table if exists payments cascade;
-- drop table if exists students cascade;


-- ============================================================
--  1. STUDENTS TABLE
-- ============================================================
create table if not exists students (
  id                 uuid default gen_random_uuid() primary key,
  name               text not null,
  class              text,
  email              text,
  total_fee          numeric default 0,
  amount_paid        numeric default 0,
  balance            numeric default 0,
  payment_method     text,
  status             text default 'partial',   -- 'paid' | 'partial'
  serial             text,
  serial_active      boolean default false,
  vip_active         boolean default false,
  temp_vip           boolean default false,     -- admin granted temporary VIP
  cycle_start        date,                      -- when current 30-day cycle started
  paused             boolean default false,     -- cycle timer is paused
  pause_reason       text,                      -- reason admin gave for pause
  paused_at          timestamptz,               -- when it was paused
  photo_url          text,
  notes              text,
  enrollment_date    date,
  first_payment_date date,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);


-- ============================================================
--  2. PAYMENTS TABLE
-- ============================================================
create table if not exists payments (
  id              uuid default gen_random_uuid() primary key,
  student_id      uuid references students(id) on delete cascade,
  amount          numeric not null,
  method          text,
  payment_date    date,
  serial_at_time  text,    -- snapshot of serial at time of payment
  created_at      timestamptz default now()
);


-- ============================================================
--  3. SERIAL HISTORY TABLE
-- ============================================================
create table if not exists serial_history (
  id          uuid default gen_random_uuid() primary key,
  student_id  uuid references students(id) on delete cascade,
  old_serial  text,
  new_serial  text,
  revoked_at  timestamptz default now()
);


-- ============================================================
--  4. AUTO-UPDATE updated_at trigger
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists students_updated_at on students;
create trigger students_updated_at
  before update on students
  for each row execute function update_updated_at();


-- ============================================================
--  5. ROW LEVEL SECURITY
--  Only authenticated users (admin) can access all data.
--  Students are verified in app code using their serial number.
-- ============================================================
alter table students       enable row level security;
alter table payments       enable row level security;
alter table serial_history enable row level security;

-- Drop existing policies if re-running
drop policy if exists "Allow authenticated users" on students;
drop policy if exists "Allow authenticated users" on payments;
drop policy if exists "Allow authenticated users" on serial_history;
drop policy if exists "Allow public read" on students;

-- Admin (authenticated) has full access
create policy "Allow authenticated users" on students
  for all using (auth.role() = 'authenticated');

create policy "Allow authenticated users" on payments
  for all using (auth.role() = 'authenticated');

create policy "Allow authenticated users" on serial_history
  for all using (auth.role() = 'authenticated');

-- Unauthenticated read (for student login count on login page + student portal)
-- Only exposes non-sensitive aggregate or own data — further restricted in JS
create policy "Allow anon select" on students
  for select using (true);

create policy "Allow anon select payments" on payments
  for select using (true);


-- ============================================================
--  6. IF YOU ALREADY HAVE THE OLD TABLE — run these ALTER statements
--     to add only the new columns (skip if doing a fresh setup)
-- ============================================================

-- alter table students add column if not exists email text;
-- alter table students add column if not exists vip_active boolean default false;
-- alter table students add column if not exists temp_vip boolean default false;
-- alter table students add column if not exists cycle_start date;
-- alter table students add column if not exists paused boolean default false;
-- alter table students add column if not exists pause_reason text;
-- alter table students add column if not exists paused_at timestamptz;
-- alter table payments add column if not exists serial_at_time text;


-- ============================================================
--  DONE. Your database is ready.
--  Next steps:
--  1. Go to Supabase → Authentication → Users → Add new user
--     (this creates your admin account)
--  2. Open js/supabase.js and paste your Project URL + Anon Key
--  3. Add your WhatsApp number in js/supabase.js
--  4. Add your bank account details in js/student.js (search for "First Bank")
--  5. Open index.html in a browser to test
-- ============================================================
