-- Improve get_user_storage_bytes function with explicit auth validation
-- This prevents querying storage for users other than the authenticated user
CREATE OR REPLACE FUNCTION public.get_user_storage_bytes(p_user_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate that the caller can only query their own storage
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: Cannot query storage for other users';
  END IF;
  
  RETURN (
    SELECT COALESCE(SUM(file_size), 0)::bigint
    FROM public.projects
    WHERE user_id = p_user_id
  );
END;
$function$;