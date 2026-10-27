-- Traffic managers of the barbershop company; kept in its own migration because a new enum value cannot be used in the transaction that adds it.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gestor';
