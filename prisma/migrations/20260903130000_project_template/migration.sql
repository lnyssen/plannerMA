-- Projet servant de modèle. Dupliquer existait déjà, mais il fallait d'abord
-- retrouver un projet qui ressemble à ce qu'on veut : ce drapeau fait
-- remonter les modèles au moment de créer.
ALTER TABLE "projects" ADD COLUMN "is_template" BOOLEAN NOT NULL DEFAULT false;
