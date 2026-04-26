ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free',
ADD COLUMN IF NOT EXISTS plan_type text,
ADD COLUMN IF NOT EXISTS plan_start_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS plan_expiry timestamp with time zone,
ADD COLUMN IF NOT EXISTS razorpay_subscription_id text;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free', 'pro'));

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_plan_type_check CHECK (plan_type IS NULL OR plan_type IN ('monthly', 'annual'));

CREATE INDEX IF NOT EXISTS idx_profiles_plan_expiry ON public.profiles (plan, plan_expiry);