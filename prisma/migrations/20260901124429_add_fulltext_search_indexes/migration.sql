-- Index GIN sur le texte plein des tâches (titre + description) et des
-- commentaires — recherche plein texte française (configuration "french"
-- livrée avec PostgreSQL, aucune extension requise). Aucune colonne stockée
-- : l'index porte directement sur l'expression to_tsvector, recalculée à
-- l'écriture par PostgreSQL lui-même, pas de trigger de maintenance à écrire.
CREATE INDEX "tasks_fulltext_idx" ON "tasks" USING GIN (to_tsvector('french', coalesce("title", '') || ' ' || coalesce("description", '')));

CREATE INDEX "comments_fulltext_idx" ON "comments" USING GIN (to_tsvector('french', "body"));
