-- Create a function to calculate user's total storage usage
CREATE OR REPLACE FUNCTION public.get_user_storage_bytes(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(file_size), 0)::bigint
  FROM public.projects
  WHERE user_id = p_user_id;
$$;

-- Create a function to check if upload would exceed limit
CREATE OR REPLACE FUNCTION public.check_storage_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_usage bigint;
  storage_limit bigint := 1073741824; -- 1GB in bytes
BEGIN
  -- Calculate current storage usage for this user
  SELECT COALESCE(SUM(file_size), 0) INTO current_usage
  FROM public.projects
  WHERE user_id = NEW.user_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  -- Check if adding this file would exceed the limit
  IF current_usage + COALESCE(NEW.file_size, 0) > storage_limit THEN
    RAISE EXCEPTION 'Storage limit exceeded. Maximum allowed: 1GB. Current usage: % bytes', current_usage;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to enforce storage limit on insert and update
DROP TRIGGER IF EXISTS enforce_storage_limit ON public.projects;
CREATE TRIGGER enforce_storage_limit
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.check_storage_limit();