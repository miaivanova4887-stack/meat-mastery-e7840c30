DROP POLICY IF EXISTS "Anyone can read post likes" ON public.post_likes;
CREATE POLICY "Users can read own post likes"
ON public.post_likes FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can read likes" ON public.recipe_likes;
CREATE POLICY "Users can read own recipe likes"
ON public.recipe_likes FOR SELECT TO authenticated
USING (auth.uid() = user_id);