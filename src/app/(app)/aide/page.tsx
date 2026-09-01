const SECTIONS = [
  { id: "aujourdhui", label: "Aujourd’hui" },
  { id: "taches", label: "Tâches" },
  { id: "fiche-tache", label: "La fiche d’une tâche" },
  { id: "planning", label: "Planning" },
  { id: "projets", label: "Projets" },
  { id: "clients", label: "Clients" },
  { id: "tableau-de-bord", label: "Tableau de bord" },
  { id: "subventions", label: "Projets EP/Européens" },
  { id: "temps", label: "Temps" },
  { id: "charge", label: "Charge" },
  { id: "equipe", label: "Équipe" },
  { id: "demandes", label: "Demandes" },
  { id: "reglages", label: "Réglages" },
  { id: "recherche", label: "Recherche et palette de commandes" },
  { id: "notifications", label: "Notifications" },
  { id: "compte", label: "Mon compte et mot de passe" },
  { id: "roles", label: "Rôles et droits" },
];

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="mb-3 scroll-mt-20 font-[family-name:var(--font-display)] text-lg font-semibold tracking-[-0.1px] text-heading"
    >
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-4 mb-1.5 text-sm font-bold text-heading">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-2.5 text-sm text-ink">{children}</p>;
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="mb-2.5 flex list-disc flex-col gap-1 pl-5 text-sm text-ink marker:text-ink-muted">{children}</ul>;
}

function Admin({ children = "réservé aux administrateurs" }: { children?: React.ReactNode }) {
  return (
    <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-2xs font-semibold" style={{ background: "var(--color-wash)", color: "var(--color-ink-muted)" }}>
      {children}
    </span>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-line bg-wash px-1.5 py-0.5 text-2xs text-ink-muted">{children}</kbd>;
}

/**
 * Documentation interne — page statique volontairement (pas de FieldSection
 * ni d'état) : c'est un texte de référence à parcourir ou chercher (Ctrl+F
 * navigateur), pas un écran d'action. Un seul document plutôt qu'une page
 * par section : plus simple à chercher dedans, et le sommaire en haut sert
 * de sauts d'ancre pour qui sait déjà ce qu'il cherche.
 */
export default function AidePage() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h1 className="mb-2 font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
        Documentation
      </h1>
      <p className="mb-6 text-sm text-ink-muted">
        Comment utiliser Studio planner, écran par écran. Les puces « réservé aux administrateurs » signalent ce que
        seul un compte administrateur voit ou peut faire — pour les autres comptes, cette partie n’apparaît pas dans
        l’application.
      </p>

      <nav className="mb-8 rounded-lg border border-line p-4">
        <p className="mb-2 text-2xs font-semibold tracking-wide text-ink-muted uppercase">Sommaire</p>
        <ul className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-heading underline-offset-2 hover:underline">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex flex-col">
        <section className="mb-8">
          <H2 id="aujourdhui">Aujourd’hui</H2>
          <P>
            Page d’accueil personnelle pour un compte solo : vos tâches du jour, un minuteur, et vos prochaines
            absences (les vôtres et celles de l’équipe). Rien à configurer — elle se construit toute seule à partir
            de ce qui vous est attribué et de vos échéances proches.
          </P>
        </section>

        <section className="mb-8">
          <H2 id="taches">Tâches</H2>
          <P>
            Liste de toutes les tâches actives de l’équipe (hors corbeille, hors projets archivés), en tableau sur
            grand écran et en cartes sur mobile.
          </P>
          <H3>Filtrer et chercher</H3>
          <Ul>
            <li>Quatre filtres combinables : Projet, Studio, Personne, Statut.</li>
            <li>
              La recherche (icône loupe, à droite des filtres) couvre le titre <em>et</em> la description de la
              tâche, ainsi que le contenu des commentaires — un mot cherché dans un commentaire remonte la tâche
              concernée.
            </li>
            <li>Cliquer un en-tête de colonne trie la liste ; recliquer inverse l’ordre.</li>
          </Ul>
          <H3>Actions groupées</H3>
          <P>
            Cocher plusieurs tâches (case en tête de ligne, ou la case d’en-tête pour tout sélectionner) fait
            apparaître une barre d’actions : changer le statut ou la personne attribuée pour toute la sélection en
            un seul choix. Si la réattribution surchargerait quelqu’un (voir <a href="#charge" className="text-heading underline-offset-2 hover:underline">Charge</a> ci-dessous), une
            confirmation s’affiche avant d’appliquer — vous pouvez annuler.
          </P>
          <H3>Dupliquer une tâche</H3>
          <P>
            Depuis la fiche d’une tâche, le bouton « Dupliquer » crée une copie : mêmes sous-tâches (remises à « non
            fait »), même dépendance, dates décalées pour démarrer aujourd’hui, statut remis au premier de la liste.
            Les commentaires, pièces jointes et écritures de temps ne sont jamais copiés — propres à l’historique de
            l’original.
          </P>
        </section>

        <section className="mb-8">
          <H2 id="fiche-tache">La fiche d’une tâche</H2>
          <P>Ouvrir une tâche (clic sur sa ligne, depuis n’importe quelle vue) ouvre sa fiche complète en pleine page.</P>
          <H3>Champs</H3>
          <Ul>
            <li>Intitulé, description, studio, statut, projet (ou « Sans projet »), personne attribuée.</li>
            <li>Dates de début/fin, durée maximale facultative (garde-fou contre une plage saisie par erreur).</li>
            <li>
              Estimation en demi-journées — distincte de la plage de dates, sert au calcul de charge (voir{" "}
              <a href="#charge" className="text-heading underline-offset-2 hover:underline">Charge</a>).
            </li>
            <li>Dépendance (« Dépend de ») vers une autre tâche du même projet ou d’un autre.</li>
            <li>
              Récurrence facultative (chaque semaine / chaque mois) : la tâche suivante se crée automatiquement dès
              que celle-ci passe à un statut « Terminé ».
            </li>
          </Ul>
          <H3>Avertissement de surcharge</H3>
          <P>
            Si la personne attribuée dépasserait 90 % de charge la semaine concernée (avec cette tâche incluse), un
            bandeau orange s’affiche directement dans le formulaire, avant même d’enregistrer. Ce n’est qu’un
            signal — rien n’empêche d’enregistrer quand même.
          </P>
          <H3>Sous-tâches</H3>
          <P>Une checklist avec échéance propre, éventuellement attribuée à quelqu’un d’autre que le titulaire de la tâche.</P>
          <H3>Pièces jointes</H3>
          <P>Un lien externe (SharePoint, Drive…) ou un fichier déposé directement. Chaque ligne indique qui l’a déposé et quand.</P>
          <H3>Activité</H3>
          <P>
            Un seul fil chronologique regroupe les commentaires, les pièces jointes déposées et le journal des
            changements (création, modification, changement de statut…) — pour voir d’un coup d’œil tout ce qui
            s’est passé sur la tâche, dans l’ordre où c’est arrivé.
          </P>
          <P>
            Écrire un commentaire : taper le texte, éventuellement cliquer une des puces « @Nom » sous le champ pour
            mentionner quelqu’un — la personne mentionnée reçoit une notification (cloche + courriel si activé).
            L’attributaire de la tâche est lui aussi averti de tout nouveau commentaire, même sans être mentionné
            explicitement.
          </P>
          <H3>Temps</H3>
          <P>
            Démarrer un minuteur (s’arrête depuis n’importe quelle page tant qu’il tourne) ou saisir une durée
            manuellement. Le total de la tâche s’affiche en tête de section.
          </P>
        </section>

        <section className="mb-8">
          <H2 id="planning">Planning</H2>
          <P>Trois façons de voir les mêmes tâches, à choisir selon ce qu’on cherche :</P>
          <Ul>
            <li><strong>Kanban</strong> — colonnes par statut, glisser-déposer une tâche pour changer son statut.</li>
            <li><strong>Semaine</strong> — grille jour par jour, une ligne par personne.</li>
            <li><strong>Gantt</strong> — barres sur une frise, dépendances affichées en trait reliant deux tâches, nombre de semaines réglable.</li>
          </Ul>
        </section>

        <section className="mb-8">
          <H2 id="projets">Projets</H2>
          <P>Vue Cartes (regroupées par client) ou Tableau, avec un onglet Archives séparé.</P>
          <H3>Fiche projet</H3>
          <Ul>
            <li>Nom, code, client (existant ou créé à la volée), type de client (interne/externe), type de projet (Externe / Équipe éducative / Européen / Fonctionnement / Éducation permanente), studios concernés.</li>
            <li>Budget de temps facultatif, en heures — un bandeau d’alerte apparaît si le temps enregistré le dépasse.</li>
            <li>Liste des tâches du projet et de ses jalons, avec ajout direct depuis la fiche.</li>
            <li>Historique propre au projet (création, duplication, modification, archivage).</li>
          </Ul>
          <H3>Dupliquer un projet</H3>
          <P>
            Copie le projet et toutes ses tâches actives (avec sous-tâches, dépendances remappées vers les copies, et
            jalons), dates décalées pour démarrer aujourd’hui en conservant l’espacement relatif. Sert de « modèle »
            léger pour un studio qui refait souvent le même type de projet.
          </P>
        </section>

        <section className="mb-8">
          <H2 id="clients">Clients</H2>
          <P>
            Liste des organisations (ONG, fédérations, services internes…) avec leurs coordonnées. Chaque carte
            affiche le nombre de projets (actifs vs total) et le temps total enregistré tous projets confondus — pour
            voir d’un coup d’œil la relation avec un client sur plusieurs projets, pas juste projet par projet.
          </P>
        </section>

        <section className="mb-8">
          <H2 id="tableau-de-bord">
            Tableau de bord
            <Admin />
          </H2>
          <P>
            Vue d’ensemble « budget de temps vs réalisé » : total budgété, réalisé, restant et écart, puis le détail
            par projet (barre de consommation, avancement des tâches, rythme — « en avance », « dans les temps » ou
            « en retard » selon que le budget se consomme plus vite ou moins vite que les tâches n’avancent). Une
            section séparée liste les prochaines échéances (jalons) sous 30 jours, en retard ou à venir. Export CSV
            disponible.
          </P>
        </section>

        <section className="mb-8">
          <H2 id="subventions">
            Projets EP/Européens
            <Admin />
          </H2>
          <P>
            Même calcul que le Tableau de bord, mais filtré et groupé par catégorie de financement associatif :
            Éducation permanente d’un côté, Européen de l’autre. Deux démarches de justification distinctes auprès de
            deux bailleurs différents — d’où des sections séparées plutôt qu’une liste unique. Export CSV disponible,
            avec la catégorie en colonne.
          </P>
        </section>

        <section className="mb-8">
          <H2 id="temps">Temps</H2>
          <P>
            Vos écritures de temps, par jour ou par semaine. Une écriture peut être liée à une tâche précise ou
            directement à un projet (temps non affecté à une tâche particulière). Export CSV pour le reporting.
          </P>
        </section>

        <section className="mb-8">
          <H2 id="charge">
            Charge
            <Admin />
          </H2>
          <P>
            Occupation de chaque personne, semaine par semaine (4, 8 ou 12 semaines affichables). Le calcul : chaque
            jour ouvrable couvert par une tâche non terminée compte comme occupé, plafonné à 100 % par jour — une
            tâche avec une estimation en demi-journées répartit son effort sur sa plage plutôt que de compter chaque
            jour couvert comme entièrement pris. Les absences réduisent la disponibilité. Une puce signale un
            chevauchement (deux tâches actives en même temps pour la même personne un même jour). Le seuil de
            « surcharge » (≥ 90 % en moyenne) est le même que celui qui déclenche l’avertissement à l’assignation
            d’une tâche (voir <a href="#fiche-tache" className="text-heading underline-offset-2 hover:underline">La fiche d’une tâche</a>) et sur la réattribution groupée
            (voir <a href="#taches" className="text-heading underline-offset-2 hover:underline">Tâches</a>).
          </P>
        </section>

        <section className="mb-8">
          <H2 id="equipe">Équipe</H2>
          <P>Trois onglets : Personnes, Absences, Calendrier (vue mensuelle des absences de toute l’équipe).</P>
          <Ul>
            <li>Déclarer sa propre absence est en libre-service pour tout le monde.</li>
            <li>
              Gérer les fiches personnes (ajouter, désactiver, créer un accès de connexion, réinitialiser un mot de
              passe) est <Admin>réservé aux administrateurs</Admin>.
            </li>
            <li>
              Créer un accès de connexion génère un mot de passe temporaire, envoyé par courriel (ou affiché
              directement si l’envoi échoue, pour le communiquer soi-même) — la personne peut ensuite le changer
              depuis ses propres réglages.
            </li>
          </Ul>
        </section>

        <section className="mb-8">
          <H2 id="demandes">
            Demandes
            <Admin />
          </H2>
          <P>
            File des demandes non planifiées (« ce qu’on vous demande dans un couloir ») : n’importe qui peut en
            déposer une depuis le bouton « Nouvelle demande », les administrateurs les reçoivent en notification et
            décident de les convertir en tâche ou de les écarter.
          </P>
        </section>

        <section className="mb-8">
          <H2 id="reglages">
            Réglages
            <Admin />
          </H2>
          <P>
            Configuration de fond : studios, statuts de tâche (et leur ordre), catégories de temps, et le journal
            global (toutes les écritures d’historique de l’application, pas seulement celles d’une fiche).
          </P>
        </section>

        <section className="mb-8">
          <H2 id="recherche">Recherche et palette de commandes</H2>
          <P>
            L’icône loupe (barre latérale) ouvre une recherche rapide : tâches (titre et description), commentaires
            (avec un extrait), projets (nom et code), clients.
          </P>
          <P>
            <Kbd>⌘</Kbd>/<Kbd>Ctrl</Kbd> + <Kbd>K</Kbd> depuis n’importe où ouvre la palette de commandes : la même
            recherche, plus des actions rapides (nouvelle tâche/projet/demande, aller à une page) et vos éléments
            récemment consultés.
          </P>
        </section>

        <section className="mb-8">
          <H2 id="notifications">Notifications</H2>
          <P>
            La cloche (barre latérale) liste vos notifications dans l’application — toujours actives, rien à
            configurer. Elle s’allume pour : une tâche qui vous est attribuée, une mention dans un commentaire, un
            nouveau commentaire sur une tâche qui vous est attribuée, une nouvelle demande <Admin />, un budget de
            projet dépassé ou un rythme de consommation qui dérive <Admin />.
          </P>
          <P>
            Le courriel correspondant à chacune de ces alertes se règle indépendamment dans « Mes notifications »
            (menu du compte, en bas de la barre latérale) — la cloche reste active même si tous les courriels sont
            désactivés.
          </P>
        </section>

        <section className="mb-8">
          <H2 id="compte">Mon compte et mot de passe</H2>
          <Ul>
            <li>Changer son mot de passe : menu du compte → Mot de passe.</li>
            <li>
              Mot de passe oublié : lien « Mot de passe oublié ? » sur l’écran de connexion — un courriel avec un
              lien de réinitialisation, valable une heure. Si le courriel n’arrive pas (SMTP pas encore configuré),
              demander à un administrateur de réinitialiser l’accès depuis Équipe.
            </li>
            <li>Thème clair/sombre : bascule dans la barre latérale.</li>
            <li>Ordre du menu de gauche : personnalisable par glisser-déposer (menu du compte → Réorganiser le menu).</li>
          </Ul>
        </section>

        <section className="mb-10">
          <H2 id="roles">Rôles et droits</H2>
          <P>
            Deux paliers effectifs, pas trois : <strong>administrateur</strong> voit et gère tout — équipe, clients,
            budgets, Charge, Tableau de bord, Subventions, Demandes, Réglages. Tout autre compte voit ses propres
            tâches et celles de l’équipe sur les projets, peut commenter, joindre des fichiers, saisir du temps et
            déclarer ses propres absences, mais pas les données de budget ni d’occupation d’équipe, et ne gère ni les
            fiches personnes ni les réglages de fond.
          </P>
        </section>
      </div>
    </div>
  );
}
