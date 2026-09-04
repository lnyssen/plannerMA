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
  { id: "retours", label: "Retours et confirmations" },
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

/** Procédure numérotée — distincte des puces `Ul` (repères), pour un enchaînement d'actions dans l'ordre. */
function Steps({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 rounded-lg border border-line p-3.5">
      <p className="mb-2 text-sm font-bold text-heading">{title}</p>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-ink marker:font-semibold marker:text-heading">
        {children}
      </ol>
    </div>
  );
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

/** Capture d'écran — bordée comme les cartes de l'appli, jamais plus large que son conteneur. */
function Shot({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className="mb-4 w-full rounded-lg border border-line" />
  );
}

/**
 * Documentation interne — page statique volontairement (pas de FieldSection
 * ni d'état) : c'est un texte de référence à parcourir ou chercher (Ctrl+F
 * navigateur), pas un écran d'action. Un seul document plutôt qu'une page
 * par section : plus simple à chercher dedans, et le sommaire en haut sert
 * de sauts d'ancre pour qui sait déjà ce qu'il cherche. Les captures d'écran
 * (public/docs/) datent du 1er septembre 2026 — à regénérer si l'interface
 * change sensiblement.
 */
export default function AidePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="mb-2 font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
        Documentation
      </h1>
      <p className="mb-6 max-w-3xl text-sm text-ink-muted">
        Comment utiliser Studio planner, écran par écran. Les puces « réservé aux administrateurs » signalent ce que
        seul un compte administrateur voit ou peut faire — pour les autres comptes, cette partie n’apparaît pas dans
        l’application.
      </p>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_200px]">
        <div className="flex max-w-3xl flex-col">
          <nav className="mb-8 rounded-lg border border-line p-4 lg:hidden">
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
        <section className="mb-8">
          <H2 id="aujourdhui">Aujourd’hui</H2>
          <Shot src="/docs/aujourdhui.png" alt="Page d’accueil Aujourd’hui : tâches du jour, minuteur, absences à venir" />
          <P>
            Page d’accueil personnelle pour un compte solo : vos tâches du jour, un minuteur, et vos prochaines
            absences (les vôtres et celles de l’équipe). Rien à configurer — elle se construit toute seule à partir
            de ce qui vous est attribué et de vos échéances proches.
          </P>
        </section>

        <section className="mb-8">
          <H2 id="taches">Tâches</H2>
          <Shot src="/docs/taches.png" alt="Liste des tâches, avec ses quatre filtres et le tri par colonne" />
          <P>
            Liste de toutes les tâches actives de l’équipe (hors corbeille, hors projets archivés), en tableau sur
            grand écran et en cartes sur mobile.
          </P>
          <H3>Filtrer et chercher</H3>
          <Ul>
            <li>Quatre filtres combinables, en haut de la liste : Projet, Studio, Personne, Statut.</li>
            <li>
              La recherche (icône loupe, à droite des filtres) couvre le titre <em>et</em> la description de la
              tâche, ainsi que le contenu des commentaires — un mot cherché dans un commentaire remonte la tâche
              concernée (voir <a href="#recherche" className="text-heading underline-offset-2 hover:underline">Recherche</a> ci-dessous pour un exemple).
            </li>
            <li>Cliquer un en-tête de colonne trie la liste ; recliquer inverse l’ordre.</li>
          </Ul>
          <Steps title="Réattribuer plusieurs tâches d’un coup">
            <li>Cocher les tâches concernées (case en tête de ligne), ou la case d’en-tête pour tout sélectionner.</li>
            <li>Dans la barre qui apparaît, choisir « Changer le statut… » ou « Changer la personne… ».</li>
            <li>
              Si la réattribution surchargerait quelqu’un (voir <a href="#charge" className="text-heading underline-offset-2 hover:underline">Charge</a>), une confirmation
              s’affiche avant d’appliquer — annuler pour revenir en arrière, valider pour continuer quand même.
            </li>
          </Steps>
          <Steps title="Dupliquer une tâche">
            <li>Ouvrir la tâche à dupliquer.</li>
            <li>
              Cliquer « Dupliquer » (à côté de « Corbeille », en haut de la fiche) — voir{" "}
              <a href="#fiche-tache" className="text-heading underline-offset-2 hover:underline">La fiche d’une tâche</a> pour le détail de ce qui est copié.
            </li>
            <li>La copie s’ouvre directement, prête à ajuster (dates déjà décalées à aujourd’hui).</li>
          </Steps>
        </section>

        <section className="mb-8">
          <H2 id="fiche-tache">La fiche d’une tâche</H2>
          <Shot src="/docs/fiche-tache.png" alt="Fiche d’une tâche : champs, sous-tâches, pièces jointes, activité, temps" />
          <P>Ouvrir une tâche (clic sur sa ligne, depuis n’importe quelle vue) ouvre sa fiche complète en pleine page.</P>
          <H3>Champs</H3>
          <Ul>
            <li>
              Intitulé, description, statut, projet (ou « Sans projet »), personne attribuée. Studios : un ou plusieurs
              (puces à cliquer), sans hiérarchie entre eux.
            </li>
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
          <P>
            Si la personne attribuée dépasserait 90 % de charge la semaine concernée (avec cette tâche incluse), un
            bandeau orange s’affiche directement dans le formulaire, avant même d’enregistrer. Ce n’est qu’un
            signal — rien n’empêche d’enregistrer quand même.
          </P>
          <Steps title="Commenter et mentionner quelqu’un">
            <li>Descendre à « Activité », tout en bas de la fiche.</li>
            <li>Écrire le texte dans le champ « Ajouter un commentaire… ».</li>
            <li>Cliquer une des puces « @Nom » sous le champ pour insérer une mention.</li>
            <li>
              Cliquer « Commenter » — la personne mentionnée reçoit une notification (cloche, et courriel si activé) ;
              l’attributaire de la tâche est lui aussi averti de tout nouveau commentaire, même sans être mentionné.
            </li>
          </Steps>
          <Steps title="Ajouter une sous-tâche">
            <li>Dans la section « Sous-tâches », taper l’intitulé dans le champ « Nouvelle sous-tâche ».</li>
            <li>Choisir une échéance (facultatif).</li>
            <li>Cliquer « Ajouter ». Cocher la case à gauche marque une sous-tâche comme faite.</li>
          </Steps>
          <Steps title="Suivre le temps passé">
            <li>« Démarrer un minuteur » lance un chronomètre, visible et arrêtable depuis n’importe quelle page tant qu’il tourne.</li>
            <li>« Saisie manuelle » ouvre une date + une durée à saisir directement, pour du temps déjà passé.</li>
          </Steps>
          <H3>Activité</H3>
          <P>
            Un seul fil chronologique regroupe les commentaires, les pièces jointes déposées et le journal des
            changements (création, modification, changement de statut…) — pour voir d’un coup d’œil tout ce qui
            s’est passé sur la tâche, dans l’ordre où c’est arrivé.
          </P>
        </section>

        <section className="mb-8">
          <H2 id="planning">Planning</H2>
          <P>Trois façons de voir les mêmes tâches, à choisir selon ce qu’on cherche (onglets en haut de la page) :</P>
          <Shot src="/docs/planning-kanban.png" alt="Planning en vue Kanban, colonnes par statut" />
          <Ul>
            <li>
              <strong>Kanban</strong> — colonnes par statut. Attrapez la poignée d’une carte (à droite de son titre)
              et glissez-la vers une autre colonne pour changer son statut, à la souris comme au doigt. Le bouton en
              bas de chaque colonne crée une tâche déjà dans ce statut.
            </li>
            <li><strong>Semaine</strong> — grille jour par jour, une ligne par personne.</li>
            <li><strong>Gantt</strong> — barres sur une frise, dépendances affichées en trait reliant deux tâches, nombre de semaines réglable.</li>
          </Ul>
          <P>
            Sur téléphone, la frise devient une liste chronologique groupée par semaine : un diagramme de Gantt suppose
            de la largeur, puisqu’on y compare des barres côte à côte. La liste garde ce que la frise apprend — l’ordre
            des choses, ce qui chevauche, ce qui attend quoi — mais écrit les dates au lieu de les dessiner et nomme la
            tâche dont on dépend au lieu d’y tirer un trait.
          </P>
          <H3>Créer une tâche en tirant sur la grille</H3>
          <Shot src="/docs/planning-semaine.png" alt="Planning en vue Semaine, une ligne par personne" />
          <P>
            Inutile de re-saisir ce que l’écran affiche déjà : le geste porte la personne (ou le projet) et les dates.
          </P>
          <Ul>
            <li>
              <strong>Semaine</strong> — glisser sur les jours d’une ligne (ou cliquer une case vide) ouvre la création
              déjà attribuée à cette personne, du premier au dernier jour couvert.
            </li>
            <li>
              <strong>Gantt</strong> — glisser sur une zone vide de la frise ouvre la création sur ces dates, rattachée
              au projet de la ligne (ou à la personne, si l’affichage est regroupé par personne).
            </li>
            <li>Dans les deux cas, tout reste modifiable dans le formulaire avant d’enregistrer.</li>
          </Ul>
        </section>

        <section className="mb-8">
          <H2 id="projets">Projets</H2>
          <Shot src="/docs/projets.png" alt="Liste des projets en vue Tableau" />
          <P>Vue Tableau par défaut, ou Cartes (regroupées par client), avec un onglet Archives séparé.</P>
          <H3>Fiche projet</H3>
          <Ul>
            <li>Nom, code, client (existant ou créé à la volée), pôle interne qui porte le projet (Fonctionnement / Équipe éducative / Éducation permanente / Européen, ou aucun), studios concernés.</li>
            <li>Budget de temps facultatif, en heures — un bandeau d’alerte apparaît si le temps enregistré le dépasse.</li>
            <li>Liste des tâches du projet et de ses dates clés, avec ajout direct depuis la fiche.</li>
            <li>Historique propre au projet (création, duplication, modification, archivage).</li>
          </Ul>
          <Steps title="Créer un projet">
            <li>Bouton « Nouveau projet » (barre latérale, ou en haut de la liste Projets).</li>
            <li>Choisir un client existant ou taper un nouveau nom (créé à la volée).</li>
            <li>Pôle et studios concernés. Le caractère interne ou externe se saisit sur la fiche du client, pas ici.</li>
            <li>Enregistrer — la fiche s’ouvre, prête à recevoir des tâches et un budget.</li>
          </Steps>
          <Steps title="Dupliquer un projet">
            <li>Ouvrir le projet à dupliquer.</li>
            <li>Cliquer « Dupliquer » — copie le projet et toutes ses tâches actives (sous-tâches, dépendances remappées, dates clés).</li>
            <li>Dates décalées pour démarrer aujourd’hui, en conservant l’espacement relatif entre tâches.</li>
          </Steps>
        </section>

        <section className="mb-8">
          <H2 id="clients">Clients</H2>
          <Shot src="/docs/clients.png" alt="Liste des clients, avec projets actifs et temps agrégé par carte" />
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
          <Shot src="/docs/tableau-de-bord.png" alt="Tableau de bord : budget total/réalisé/restant, échéances, détail par projet" />
          <P>
            Vue d’ensemble « budget de temps vs réalisé » : total budgété, réalisé, restant et écart, puis le détail
            par projet (barre de consommation, avancement des tâches, rythme — « en avance », « dans les temps » ou
            « en retard » selon que le budget se consomme plus vite ou moins vite que les tâches n’avancent). Une
            section séparée liste les dates clés des 30 prochains jours, en retard ou à venir.
          </P>
          <Steps title="Exporter en CSV">
            <li>Cliquer « Exporter en CSV », en haut de la page (n’apparaît que s’il y a au moins un projet avec budget).</li>
            <li>Le fichier téléchargé reprend exactement les lignes affichées à l’écran.</li>
          </Steps>
        </section>

        <section className="mb-8">
          <H2 id="subventions">
            Projets EP/Européens
            <Admin />
          </H2>
          <Shot src="/docs/subventions.png" alt="Vue Projets EP/Européens, groupée par catégorie de financement" />
          <P>
            Même calcul que le Tableau de bord, mais filtré et groupé par catégorie de financement associatif :
            Éducation permanente d’un côté, Européen de l’autre. Deux démarches de justification distinctes auprès de
            deux bailleurs différents — d’où des sections séparées plutôt qu’une liste unique. Export CSV disponible,
            avec la catégorie en colonne.
          </P>
        </section>

        <section className="mb-8">
          <H2 id="temps">Temps</H2>
          <Shot src="/docs/temps.png" alt="Page Temps : ajout de temps en haut, puis votre temps déjà enregistré" />
          <P>
            La page se lit en deux temps : <strong>Ajouter du temps</strong> en haut (minuteur ou saisie manuelle),
            puis <strong>Votre temps</strong> — ce qui est déjà enregistré, avec le total à côté du titre.
          </P>
          <Ul>
            <li><strong>Calendrier</strong> — la semaine heure par heure, affichage par défaut.</li>
            <li><strong>Liste</strong> — les écritures groupées par jour, avec le total de chaque journée.</li>
            <li><strong>Par projet</strong> — la répartition du temps, du projet le plus consommateur au moins.</li>
          </Ul>
          <P>
            Une écriture peut être liée à une tâche précise (<em>Tâche planifiée</em>) ou directement à un projet, voire
            à aucun (<em>Autre activité</em> — réunion, suivi de courriels, aide à un collègue…).
          </P>
          <P>
            Si la tâche choisie a plusieurs studios, un champ « Studio (pour cette écriture) » apparaît pour préciser
            lequel compte pour ce temps — invisible sinon, la tâche n’ayant qu’un seul studio à choisir.
          </P>
          <P>Export CSV pour le reporting — même principe que sur le Tableau de bord.</P>
          <H3>Feuilles de temps</H3>
          <P>
            L’onglet <strong>Feuilles</strong> liste vos six derniers mois. Une fois un mois terminé, « Remettre » le
            transmet pour validation.
          </P>
          <Ul>
            <li><strong>En cours</strong> — vous saisissez et corrigez librement.</li>
            <li>
              <strong>Remise</strong> — vous ne pouvez plus rien y modifier : ni ajouter, ni déplacer, ni supprimer une
              écriture de ce mois. Demandez sa réouverture à un administrateur.
            </li>
            <li><strong>Validée</strong> — verrouillée pour tout le monde, jusqu’à réouverture par un administrateur.</li>
          </Ul>
          <H3>Clockify</H3>
          <P>
            Si l’équipe pointe dans Clockify, Réglages → Clockify relie les deux — un seul sens par type de donnée.
          </P>
          <Ul>
            <li><strong>Relier les personnes</strong> — rapproche chaque fiche de son compte Clockify, par adresse courriel.</li>
            <li><strong>Envoyer le référentiel</strong> — crée ou renomme dans Clockify les clients et projets du planner, pour pointer sur les bons projets. Rien n’y est supprimé.</li>
            <li><strong>Importer les heures</strong> — reprend un mois de pointages. Réimporter le même mois ne double rien.</li>
          </Ul>
          <P>
            Une écriture posée sur un projet Clockify sans équivalent ici est écartée et signalée, jamais rattachée au
            hasard. Un mois dont la feuille est déjà remise ou validée n’est pas réimporté.
          </P>
          <Steps title="Valider une feuille (administrateur)">
            <li>Temps → Feuilles → section « Feuilles remises et validées ».</li>
            <li>« Valider » verrouille le mois, « Rouvrir » le rend de nouveau modifiable.</li>
            <li>Une feuille déjà validée reste dans la liste : elle peut toujours être rouverte si une correction s’impose.</li>
          </Steps>
        </section>

        <section className="mb-8">
          <H2 id="charge">
            Charge
            <Admin />
          </H2>
          <Shot src="/docs/charge.png" alt="Vue Charge : occupation par personne et par semaine" />
          <P>
            Les cases se teintent avec la charge, et passent au rose au-delà du seuil de surcharge. Le « i » à côté du
            titre détaille la façon dont le pourcentage est calculé.
          </P>
          <P>
            Occupation de chaque personne, semaine par semaine (4, 8 ou 12 semaines affichables, sélecteur en haut de
            page).
          </P>
          <Ul>
            <li>
              Chaque jour ouvrable couvert par une tâche non terminée compte comme occupé, plafonné à 100 % par jour —
              une tâche avec une estimation en demi-journées répartit son effort sur sa plage plutôt que de compter
              chaque jour couvert comme entièrement pris.
            </li>
            <li>Les absences réduisent la disponibilité de la personne concernée.</li>
            <li>Une puce signale un chevauchement (deux tâches actives en même temps pour la même personne un même jour).</li>
            <li>
              Le seuil de « surcharge » (≥ 90 % en moyenne) est le même que celui qui déclenche l’avertissement à
              l’assignation d’une tâche (voir <a href="#fiche-tache" className="text-heading underline-offset-2 hover:underline">La fiche d’une tâche</a>) et sur la
              réattribution groupée (voir <a href="#taches" className="text-heading underline-offset-2 hover:underline">Tâches</a>).
            </li>
          </Ul>
        </section>

        <section className="mb-8">
          <H2 id="equipe">Équipe</H2>
          <Shot src="/docs/equipe.png" alt="Page Équipe, onglet Personnes" />
          <P>Trois onglets, en haut de la page : Personnes, Absences, Calendrier (vue mensuelle des absences de toute l’équipe).</P>
          <Steps title="Déclarer une absence (tout le monde)">
            <li>Onglet « Absences ».</li>
            <li>Choisir les dates de début et de fin, un motif facultatif.</li>
            <li>Enregistrer — elle apparaît aussitôt dans le Calendrier de l’équipe et réduit la disponibilité dans Charge.</li>
          </Steps>
          <Steps title="Créer un accès de connexion pour quelqu’un">
            <Admin>admin</Admin>
            <li>Onglet « Personnes », ouvrir la fiche de la personne (ou en créer une nouvelle).</li>
            <li>Bouton « Inviter » (ou équivalent) — choisir son rôle.</li>
            <li>
              Un mot de passe temporaire est généré et envoyé par courriel ; s’il échoue (SMTP pas configuré), il
              s’affiche directement pour le communiquer soi-même. La personne peut ensuite le changer depuis ses
              propres réglages.
            </li>
          </Steps>
        </section>

        <section className="mb-8">
          <H2 id="demandes">
            Demandes
            <Admin />
          </H2>
          <Shot src="/docs/demandes.png" alt="File des demandes non planifiées" />
          <P>
            File des demandes non planifiées (« ce qu’on vous demande dans un couloir ») : n’importe qui peut en
            déposer une depuis le bouton « Nouvelle demande » (barre latérale), les administrateurs les reçoivent en
            notification.
          </P>
          <Ul>
            <li><strong>Convertir en tâche</strong> — crée une vraie tâche à partir de la demande, qui disparaît alors de la file.</li>
            <li><strong>Écarter</strong> — la retire sans créer de tâche (avec confirmation).</li>
          </Ul>
        </section>

        <section className="mb-8">
          <H2 id="reglages">
            Réglages
            <Admin />
          </H2>
          <Shot src="/docs/reglages.png" alt="Page Réglages, onglet Général" />
          <P>Configuration de fond, en quatre onglets :</P>
          <Ul>
            <li><strong>Général</strong> — couleurs et ordre des studios, statuts de tâche et leur ordre, bouton de test du récap quotidien par courriel.</li>
            <li><strong>Catégories de tâches</strong> — nomenclature utilisée pour classer le temps saisi.</li>
            <li><strong>Corbeille</strong> — tâches supprimées, restaurables ou à effacer définitivement.</li>
            <li><strong>Journal</strong> — toutes les écritures d’historique de l’application, pas seulement celles d’une fiche.</li>
          </Ul>
        </section>

        <section className="mb-8">
          <H2 id="recherche">Recherche et palette de commandes</H2>
          <Shot src="/docs/recherche.png" alt="Résultats de recherche : tâches, commentaires, projets" />
          <P>
            Le champ « Rechercher… » (en haut de la barre latérale) ouvre une recherche rapide : tâches (titre et
            description), commentaires (avec un extrait du texte trouvé), projets (nom et code), clients.
          </P>
          <Shot src="/docs/palette.png" alt="Palette de commandes ouverte, avec actions rapides" />
          <P>
            <Kbd>⌘</Kbd>/<Kbd>Ctrl</Kbd> + <Kbd>K</Kbd> depuis n’importe où ouvre la palette de commandes : la même
            recherche, plus des actions rapides (nouvelle tâche/projet/demande, aller à une page) et vos éléments
            récemment consultés.
          </P>
        </section>

        <section className="mb-8">
          <H2 id="notifications">Notifications</H2>
          <Shot src="/docs/notifications.png" alt="Panneau de notifications ouvert" />
          <P>
            La cloche (barre latérale) liste vos notifications dans l’application — toujours actives, rien à
            configurer.
          </P>
          <Ul>
            <li>Une tâche qui vous est attribuée.</li>
            <li>Une mention (« @Nom ») dans un commentaire.</li>
            <li>Un nouveau commentaire sur une tâche qui vous est attribuée, même sans mention.</li>
            <li>Une nouvelle demande <Admin />.</li>
            <li>Un budget de projet dépassé, ou un rythme de consommation qui dérive <Admin />.</li>
          </Ul>
          <P>
            Le courriel correspondant à chacune de ces alertes se règle indépendamment dans « Mes notifications »
            (menu du compte, en bas de la barre latérale) — la cloche reste active même si tous les courriels sont
            désactivés.
          </P>
        </section>

        <section className="mb-8">
          <H2 id="retours">Ce que l’appli répond quand vous agissez</H2>
          <Ul>
            <li>
              Chaque action réussie affiche une confirmation brève en bas à droite (« Tâche enregistrée »,
              « Minuteur arrêté »…). Elle disparaît seule au bout de quelques secondes.
            </li>
            <li>
              Les actions qui suppriment ou dupliquent demandent confirmation dans une fenêtre qui indique la
              conséquence exacte — corbeille (restaurable) ou suppression définitive, notamment.
            </li>
            <li>
              Les erreurs de formulaire restent affichées près du champ concerné, elles n’attendent pas que vous
              lisiez la confirmation.
            </li>
          </Ul>
        </section>

        <section className="mb-8">
          <H2 id="compte">Mon compte et mot de passe</H2>
          <Ul>
            <li>Changer son mot de passe : menu du compte (en bas de la barre latérale) → Mot de passe.</li>
            <li>Thème clair/sombre : bascule dans la barre latérale.</li>
            <li>Ordre du menu de gauche : personnalisable par glisser-déposer (menu du compte → Réorganiser le menu).</li>
          </Ul>
          <H3>Lire les puces du menu de gauche</H3>
          <Ul>
            <li>
              <strong>Puce neutre</strong> — un simple compte : tâches ou projets en cours, tâches qui vous sont
              attribuées, demandes en attente.
            </li>
            <li>
              <strong>Puce rouge ⚠</strong> — le sous-ensemble qui pose problème dans ce compte : tâches en retard,
              projets au-delà de leur budget de temps. Les deux puces se lisent côte à côte : « 12 ⚠3 » = douze tâches
              en cours, dont trois en retard.
            </li>
            <li>Replier un groupe ne masque pas ses alertes : elles remontent sur l’intitulé du groupe.</li>
            <li>Le détail de chaque puce s’affiche en survolant l’entrée du menu.</li>
          </Ul>
          <Steps title="Mot de passe oublié">
            <li>Sur l’écran de connexion, cliquer « Mot de passe oublié ? ».</li>
            <li>Saisir son adresse courriel — un lien de réinitialisation est envoyé, valable une heure.</li>
            <li>
              Si le courriel n’arrive pas (SMTP pas encore configuré), demander à un administrateur de réinitialiser
              l’accès depuis Équipe.
            </li>
          </Steps>
        </section>

        <section className="mb-10">
          <H2 id="roles">Rôles et droits</H2>
          <P>
            Deux paliers effectifs, pas trois : <strong>administrateur</strong> voit et gère tout — équipe, clients,
            budgets, Charge, Tableau de bord, Projets EP/Européens, Demandes, Réglages. Tout autre compte voit ses propres
            tâches et celles de l’équipe sur les projets, peut commenter, joindre des fichiers, saisir du temps et
            déclarer ses propres absences, mais pas les données de budget ni d’occupation d’équipe, et ne gère ni les
            fiches personnes ni les réglages de fond.
          </P>
        </section>
        </div>

        <nav aria-label="Sommaire" className="hidden lg:sticky lg:top-8 lg:block lg:self-start">
          <p className="mb-2 text-2xs font-semibold tracking-wide text-ink-muted uppercase">Sommaire</p>
          <ul className="flex max-h-[calc(100vh-6rem)] flex-col gap-1 overflow-y-auto border-l border-line pl-3 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-ink-muted underline-offset-2 hover:text-heading hover:underline">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
