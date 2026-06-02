-- Phase 1: 基础表结构
create extension if not exists "uuid-ossp";

create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  title text not null,
  description text,
  quadrant smallint not null check (quadrant between 1 and 4),
  progress numeric(5,2) not null default 0,
  status text not null default 'active' check (status in ('active','completed','archived')),
  due_date timestamptz,
  ai_generated boolean not null default false,
  ai_reasoning text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.checkpoints (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  weight numeric(10,2) not null default 1,
  is_completed boolean not null default false,
  "order" integer not null default 0,
  completed_at timestamptz
);
