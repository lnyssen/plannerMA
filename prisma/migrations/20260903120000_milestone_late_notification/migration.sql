-- Alerte de jalon dépassé. Les tâches en retard étaient signalées, pas les
-- jalons — alors qu'un jalon manqué sur un projet européen engage davantage
-- qu'une tâche décalée.
ALTER TYPE "NotificationType" ADD VALUE 'MILESTONE_LATE';
