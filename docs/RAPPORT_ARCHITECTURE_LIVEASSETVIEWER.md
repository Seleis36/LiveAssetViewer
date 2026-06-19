# Rapport d'Architecture Technique — LiveAssetViewer

## 1. Introduction et Vue d’Ensemble

### 1.1 Contexte métier et objectif de la plateforme

**LiveAssetViewer** est une application de visualisation de données financières en **temps réel**. Le périmètre fonctionnel principal est de fournir, pour un univers de symboles (actions, FX, crypto), une interface graphique affichant des chandeliers (OHLCV) alimentés en continu.  
Dans ce contexte, l’architecture doit satisfaire simultanément plusieurs contraintes :

- **Faible latence** de propagation de la donnée vers l’interface.
- **Fiabilité** de la chaîne de collecte/agrégation/diffusion.
- **Capacité d’évolution** (nouvelles granularités, nouveaux symboles, nouveaux flux).
- **Séparation claire des responsabilités** entre ingestion data, exposition API, et rendu UI.
- **Maîtrise du risque sécurité** au niveau infrastructure (IAM, réseau, secrets).

Le choix architectural global repose sur un **monorepo** intégrant :

- un frontend **React SPA** (servi par Nginx),
- un backend **Express + WebSocket** jouant le rôle de passerelle,
- un moteur data **kdb+/q** (tickerplant + RDB + génération synthétique),
- un cache **Redis** pour les métadonnées de symboles,
- une cible d’hébergement **AWS** provisionnée via **OpenTofu/Terraform** et configurée via **Ansible**.

### 1.2 Périmètre technique du document

Ce rapport couvre :

- la structure d’architecture actuelle (composants, interactions, responsabilités),
- le **Comment** (mécanique d’implémentation observable dans le code),
- le **Pourquoi** (justification technique et métier des choix),
- l’analyse de la sécurité selon le principe de **moindre privilège**,
- les limites assumées et axes d’amélioration.

### 1.3 Résumé exécutif

LiveAssetViewer met en place une architecture **event-driven pragmatique** : kdb+ publie des ticks, le backend les consomme et agrège à la granularité demandée, puis les diffuse en WebSocket au frontend. En parallèle, des API REST servent l’historique initial et la liste des symboles (cache Redis).  
L’implémentation infrastructure AWS est globalement alignée avec les pratiques de segmentation (**VPC/subnets/SG**), séparation de rôles (**IAM par type d’instance**) et externalisation des secrets (**SSM + Secrets Manager**).  
Les principales limites de sécurité sont clairement identifiées côté applicatif : **absence d’AuthN/AuthZ**, **CORS permissif**, et **egress SG ouverts**.

---

## 2. Architecture Globale et Patterns

### 2.1 Topologie d’ensemble

L’architecture logique se décompose en quatre plans :

1. **Plan présentation** : SPA React + Recharts, servie par Nginx.
2. **Plan API/Gateway** : backend Node.js/Express exposant REST et WebSocket.
3. **Plan data temps réel** : kdb+/q (tickerplant, RDB, génération synthetic feed).
4. **Plan plateforme** : AWS + IaC + automatisation de configuration.

Schéma simplifié (logique) :

```text
Browser (React SPA)
  ├─ HTTP /api/*        ──► Express API (Node/TS)
  └─ WebSocket /ws      ──► Express WS Gateway
                             ├─ node-q IPC ──► kdb+ (RDB/tick)
                             └─ ioredis     ──► Redis (cache symbols)
```

### 2.2 Pattern 1 — Event-Driven Data Flow

#### Comment

- Le flux principal est alimenté par des événements de type `trade` publiés par kdb+.
- Le backend s’abonne explicitement via :

```ts
conn.ks('.u.sub[`trade;`]', ...)
```

(`backend/src/kdb/subscriber.ts`)

- À chaque `upd`, le backend :
  - identifie les symboles impactés,
  - calcule les granularités réellement demandées par des clients WebSocket actifs,
  - reconstruit la bougie courante via `queryHistory(... buildBars ...)`,
  - diffuse l’update en fan-out (`dispatcher.fanOut`).

#### Pourquoi

- Le pattern évite le polling permanent côté frontend.
- Il limite les appels de calcul aux granularités effectivement souscrites.
- Il découple la production de données (kdb+) de la consommation UI.
- Il permet d’augmenter le nombre de clients consommateurs sans modifier la logique du moteur data.

### 2.3 Pattern 2 — Gateway/BFF léger (REST + WS)

#### Comment

Le backend centralise les contrats de communication :

- **REST**
  - `GET /api/symbols` (avec cache Redis, TTL 60s),
  - `GET /api/history/:symbol?granularity=...&from=...&to=...`.
- **WebSocket**
  - endpoint `/ws`,
  - messages `subscribe`, `unsubscribe`, `ping/pong`,
  - push de `candle_update`.

Extraits de points d’entrée :

```ts
app.use(historyRouter)
app.use(createSymbolsRouter(redis))
attachWsServer(httpServer)
```

(`backend/src/server.ts`)

#### Pourquoi

- Un point d’entrée unique réduit la complexité côté frontend.
- Le backend absorbe les spécificités de kdb+/q et expose un contrat JSON stable.
- Le modèle hybride REST+WS est adapté au cas d’usage finance :
  - REST pour le **snapshot historique initial**,
  - WS pour les **mises à jour incrémentales live**.

### 2.4 Pattern 3 — Infrastructure as Code + Configuration as Code

#### Comment

- Le provisioning AWS est défini en modules OpenTofu/Terraform :
  - `infra/modules/vpc`,
  - `infra/modules/sg`,
  - `infra/modules/iam`,
  - `infra/modules/ec2`, `alb`, `ecr`, `efs`, `elasticache`, `ssm`, etc.
- Les instances sont configurées via Ansible (`ansible/playbooks/site.yml`, rôles `common`, `kdb`, `app`, `runner`).

Exemple d’assemblage modulaire :

```hcl
module "vpc" { ... }
module "sg"  { ... }
module "iam" { ... }
module "ec2" { ... }
module "alb" { ... }
module "ssm" { ... }
```

(`infra/main.tf`)

#### Pourquoi

- Garantit la reproductibilité d’environnement.
- Réduit le risque de dérive entre environnements.
- Facilite l’audit des choix d’infrastructure (revue de code, historique Git).
- Clarifie les responsabilités entre provisioning (Terraform/OpenTofu) et configuration logicielle (Ansible).

---

## 3. Stack Technique et Justification des Choix

### 3.1 Frontend — React, Vite, TypeScript, Zustand, Recharts

#### Comment (implémentation observée)

- **React** structure l’UI par composants :
  - `App.tsx`,
  - `AssetSelector.tsx`,
  - `CandleChart.tsx`,
  - `ConnectionIndicator.tsx`.
- **Vite** pilote le développement (`npm run dev`) et le build (`vite build`).
- **TypeScript** typifie les contrats :
  - `Symbol`, `Candle` (`frontend/src/api/client.ts`),
  - stores Zustand typés.
- **Zustand** gère l’état de marché et de connexion :
  - `useMarketStore.ts`,
  - `useConnectionStore.ts`.
- **Recharts** rend la visualisation bougies + volumes avec transformation métier (`toRows`, `makeCandleShape`).

Extrait de fallback de connectivité WS en production ALB :

```ts
const WS_URL =
  import.meta.env.VITE_WS_URL ||
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
```

(`frontend/src/App.tsx`)

#### Pourquoi (justification)

- **React** : excellent compromis modularité/maintenabilité pour une SPA temps réel.
- **Vite** : cycle de feedback court, essentiel pour itérer rapidement sur des écrans métier.
- **TypeScript** : réduit les erreurs d’intégration sur des flux structurés (OHLCV).
- **Zustand** : léger, sans boilerplate excessif, performant pour état local orienté flux.
- **Recharts** : bon niveau de productivité pour charting financier customisé sans reconstruire un moteur graphique complet.

### 3.2 Backend — Node.js/TypeScript, Express 5, WebSocket, node-q, ioredis

#### Comment (implémentation observée)

- **Express 5** gère les routes API et le middleware HTTP :
  - CORS global,
  - parse JSON,
  - journalisation pino-http,
  - routes métier.
- Le serveur HTTP embarque un serveur **WebSocket** (`ws`) au path `/ws`.
- La connectivité kdb+ est assurée via **node-q** avec logique de reconnexion exponentielle.
- Redis est consommé via **ioredis** pour le cache des symboles.

Extrait de démarrage :

```ts
await redis.connect()
initKdb()
onKdbConnect((conn) => startSubscriber(conn))
httpServer.listen(config.port, ...)
```

(`backend/src/server.ts`)

#### Pourquoi (justification)

- **Node/Express** est particulièrement adapté à une passerelle I/O intensive (REST + WS + IPC kdb).
- **WebSocket** est plus naturel que du polling pour la diffusion continue de ticks/bougies.
- **node-q** permet l’intégration directe avec l’écosystème q/kdb sans couche intermédiaire lourde.
- **ioredis** apporte robustesse opérationnelle sur les accès cache réseau.
- Le choix TypeScript côté backend aligne les contrats avec le frontend et sécurise les transformations de payload.

### 3.3 Moteur Data — kdb+/q

#### Comment (implémentation observée)

Le moteur q est structuré en scripts spécialisés :

- `kdb/q/schemas.q` : schémas `trade`, `bar`, `symbolRef`.
- `kdb/q/tick.q` : tickerplant (`.u.sub`, `.u.upd`, `.u.pub`) + `buildBars`.
- `kdb/q/r.q` : RDB abonné au tickerplant.
- `kdb/q/feed/synthetic.q` : générateur synthétique d’événements de marché.

Extrait de logique d’agrégation :

```q
select open:first price,high:max price,low:min price,close:last price,volume:sum size
  by time:gran xbar time,sym
from data
```

(`kdb/q/bars.q`, logique équivalente dans `tick.q`)

#### Pourquoi (justification)

- kdb+/q est historiquement et techniquement aligné avec les workloads **timeseries financières**.
- Le modèle tabulaire/colonnaire et le langage q sont très efficaces pour :
  - agrégation temporelle,
  - requêtes à faible latence,
  - manipulations massives de séries.
- Le couplage tickerplant + RDB correspond à un pattern robuste en environnement market data.

### 3.4 Infra/Ops — Docker, OpenTofu/Terraform, Ansible, GitLab CI

#### Comment (implémentation observée)

- **Docker** :
  - multi-stage builds frontend/backend,
  - image kdb spécifique,
  - orchestration locale via `docker-compose.yml`.
- **OpenTofu/Terraform** :
  - modules dédiés par domaine infra,
  - backend remote state S3 + lock DynamoDB.
- **Ansible** :
  - configuration des hôtes EC2,
  - déploiement des conteneurs,
  - récupération de secrets (SSM/Secrets Manager).
- **GitLab CI** :
  - jobs lint/test/sonar actifs,
  - build/deploy documentés mais désactivés (absence OIDC côté GitLab actuel).

#### Pourquoi (justification)

- Docker standardise les artefacts d’exécution entre local et cloud.
- IaC donne une base gouvernable et auditable.
- Ansible complète Terraform pour la couche OS/runtime applicative.
- Pipeline CI sépare clairement qualité statique, tests, et analyse Sonar.

### 3.5 Tableau de synthèse des choix techniques

| Domaine | Technologie | Comment c’est utilisé | Pourquoi c’est pertinent |
|---|---|---|---|
| UI SPA | React + TS | Composants + contrats typés | Maintenabilité, fiabilité des payloads |
| Build Front | Vite | Dev server HMR + build prod | Itération rapide |
| State Mgmt | Zustand | Store marché + connexion | Simplicité, faible overhead |
| Charting | Recharts | Bougies + volume custom | Time-to-market pour visualisation financière |
| API Gateway | Express 5 | REST `/api/*` + WS `/ws` | Point d’entrée unifié |
| Temps réel | WebSocket | Push de `candle_update` | Latence faible, modèle push |
| Intégration kdb | node-q | IPC + abonnements `.u.sub` | Intégration native avec q |
| Cache | Redis (ioredis) | Cache symboles (TTL 60s) | Réduction latence et charge amont |
| Data engine | kdb+/q | Tick + RDB + buildBars | Excellente adéquation finance/timeseries |
| Infra | OpenTofu/Terraform | Provisioning AWS modulaire | Reproductibilité, auditabilité |
| Config hôtes | Ansible | Setup OS, secrets, containers | Industrialisation des déploiements |

---

## 4. Flux de Données et Communication Inter-Composants

### 4.1 Vue séquentielle du parcours de la donnée

1. Le script `synthetic.q` génère périodiquement des ticks (`time`, `sym`, `price`, `size`, `side`).
2. Les ticks sont envoyés au tickerplant via `.u.upd`.
3. Le tickerplant persiste/relaye les événements et notifie les abonnés.
4. Le RDB (`r.q`) est abonné et maintient la table `trade` en mémoire.
5. Le backend Node, connecté à kdb+, reçoit les notifications `upd`.
6. Pour chaque symbole concerné et granularité active, le backend appelle `buildBars`.
7. Le backend fan-out les mises à jour vers les clients WS concernés.
8. Le frontend met à jour le store local (`updateLastCandle`) et rerend le graphique.
9. En parallèle, au chargement/changement de symbole, le frontend appelle REST historique pour amorcer la série.

### 4.2 Pipeline kdb+ : génération, publication, agrégation

#### Comment

Le script de démarrage kdb lance trois processus :

```sh
q /q/q/tick.q -p 5010 sym /data/tp-log &
q /q/q/r.q -p 5011 localhost 5010 &
q /q/q/feed/synthetic.q -p 5012 localhost 5010 &
```

(`kdb/scripts/startup.sh`)

Le tickerplant gère la publication asynchrone :

```q
.u.pub:{[t;x] {[t;x;sub] neg[sub 0] (`upd; t; x)}[t;x;] each .u.w[t];}
```

(`kdb/q/tick.q`)

#### Pourquoi

- La séparation feed/tickerplant/RDB découple génération, distribution et stockage.
- Le modèle pub/sub kdb est efficace pour diffuser des événements à plusieurs consommateurs.
- La logique `buildBars` côté q garantit une agrégation cohérente avec les primitives temporelles du moteur.

### 4.3 Pipeline backend : souscription, filtrage, fan-out

#### Comment

- Souscription kdb initiale au flux `trade`.
- Extraction des symboles modifiés par batch d’updates.
- Filtrage des granularités réellement demandées (`dispatcher.granularitiesFor(sym)`).
- Requête d’agrégation bornée sur la fenêtre de barre courante.
- Emission WS ciblée par `symbol` + `granularity`.

Extrait :

```ts
for (const sym of symsSeen) {
  for (const granularity of dispatcher.granularitiesFor(sym)) {
    const bars = await queryHistory(sym, granularity, barStart, new Date(now))
    ...
    dispatcher.fanOut(sym, granularity, {...})
  }
}
```

(`backend/src/kdb/subscriber.ts`)

#### Pourquoi

- Évite de recalculer inutilement des granularités non consommées.
- Réduit le volume de messages envoyés à chaque client.
- Favorise une scalabilité horizontale du pattern de diffusion.

### 4.4 Pipeline frontend : amorçage historique + incréments live

#### Comment

Au montage/changement d’actif :

- appel `fetchHistory(...)` pour charger 24h d’historique,
- souscription WS (`subscribe(symbol, granularity)`),
- fusion dans le store :
  - `pushCandles` pour la base historique,
  - `updateLastCandle` pour les incréments live.

Le store protège contre des updates obsolètes :

```ts
if (candle.t > state.candles[state.candles.length - 1].t) {
  return { candles: [...state.candles, candle] }
}
```

(`frontend/src/stores/useMarketStore.ts`)

#### Pourquoi

- Le chargement initial via REST évite les écrans vides.
- Le flux WS maintient la fraîcheur de la dernière barre sans recharger tout l’historique.
- La logique de fusion évite les artefacts visuels en cas d’ordre de réception non idéal.

### 4.5 Cache Redis pour `/api/symbols`

#### Comment

Le backend met en cache la réponse des symboles :

```ts
const CACHE_KEY = 'symbols'
const CACHE_TTL_S = 60
```

(`backend/src/routes/symbols.ts`)

#### Pourquoi

- Les symboles changent peu fréquemment.
- Le cache réduit la pression sur kdb et améliore le temps de réponse API.
- TTL court (60s) : équilibre entre fraîcheur et performance.

### 4.6 Tableau de communication inter-composants

| Source | Destination | Protocole/Port | Contrat principal | Objectif |
|---|---|---|---|---|
| Browser | Backend via ALB | HTTPS/HTTP (`/api/*`) | JSON REST | Historique, symboles |
| Browser | Backend via ALB | WebSocket (`/ws`) | JSON (`subscribe`, `candle_update`) | Streaming temps réel |
| Backend | kdb+ tickerplant/RDB | TCP IPC (`5010`/`5011`) | `.u.sub`, `buildBars` | Ingestion + agrégation |
| Backend | Redis | TCP `6379` | GET/SETEX | Cache symboles |
| kdb synthetic feed | tickerplant | IPC q | `.u.upd` | Production d’événements |
| kdb tickerplant | RDB | IPC q | `upd` | Réplication intraday |

---

## 5. Sécurité et Application du Principe de Moindre Privilège (Least Privilege)

### 5.1 Principes directeurs observés

L’implémentation met en œuvre des mécanismes de sécurité solides côté infrastructure :

- **Segmentation réseau** (public/private app/private data).
- **Contrôle des flux par Security Groups**.
- **Rôles IAM distincts par responsabilité machine**.
- **Externalisation des secrets** (SSM SecureString + Secrets Manager).
- **Protection de l’état IaC** (S3 chiffré, DynamoDB lock, public access block).

Ces choix constituent une base saine de **defense in depth** sur la couche plateforme.

### 5.2 IAM : séparation des rôles et limitation des permissions

#### Comment

Les rôles EC2 sont créés par profil :

```hcl
locals { roles = ["app", "kdb", "runner"] }
resource "aws_iam_role" "ec2" { for_each = toset(local.roles) ... }
```

(`infra/modules/iam/main.tf`)

Permissions observées :

- Attachements communs :
  - `AmazonSSMManagedInstanceCore`,
  - `CloudWatchAgentServerPolicy`,
  - politique custom `pv-ecr-pull`,
  - lecture SSM `/pv/*`.
- Permission EFS **seulement** pour rôle `kdb`.
- Permission Secrets Manager dédiée au rôle `runner`.

#### Pourquoi

- Découper les rôles limite le blast radius en cas de compromission d’une instance.
- Le rôle kdb seul obtient les droits de mount/write EFS, aligné au besoin réel.
- Le runner dispose de privilèges spécifiques à son rôle d’automatisation.

#### Tableau IAM (synthèse)

| Rôle EC2 | Permissions clés | Usage attendu | Alignement moindre privilège |
|---|---|---|---|
| `app` | SSM read `/pv/*`, ECR pull, SSM core, CloudWatch | Exécution frontend/backend, lecture conf | Bon : pas de droits EFS/Secrets étendus |
| `kdb` | + EFS `ClientMount/ClientWrite` | Exécution moteur data avec persistance | Bon : droit EFS ciblé |
| `runner` | + Secrets Manager (secret token) | Bootstrap/exécution runner CI in-VPC | Bon en principe, à aligner avec nommage réel des secrets |

> Point d’attention : la policy runner référence `arn:...:secret:pv/github/*` alors que le rôle Ansible lit `pv/gitlab/runner-token`. Cette divergence doit être harmonisée pour conserver un principe de moindre privilège **effectif** et non seulement intentionnel.

### 5.3 Réseau : VPC, subnets et Security Groups segmentés

#### Comment

Le module VPC crée :

- 2 subnets publics (`10.0.0.0/24`, `10.0.1.0/24`),
- 2 subnets privés app (`10.0.10.0/24`, `10.0.11.0/24`),
- 2 subnets privés data (`10.0.20.0/24`, `10.0.21.0/24`),
- IGW + NAT + tables de routage.

Les SG filtrent finement les entrées :

- ALB : 80/443 depuis Internet.
- App : 80/3000 depuis SG ALB, 22 depuis SG runner.
- kdb : 5010–5011 depuis SG app, 22 depuis SG runner.
- Data : 6379 depuis SG app, 2049 depuis SG kdb.

#### Pourquoi

- La segmentation subnet sépare exposition publique et workloads internes.
- Les règles SG “security-group to security-group” matérialisent des flux métier explicites.
- Le routage privé via NAT évite d’exposer directement les instances applicatives.

#### Tableau Security Groups (ingress)

| SG | Entrées autorisées | Justification |
|---|---|---|
| `sg-alb` | `80`, `443` depuis `0.0.0.0/0` | Point d’entrée public HTTP(S) |
| `sg-app` | `80`, `3000` depuis `sg-alb`; `22` depuis `sg-runner` | App derrière ALB + admin depuis runner |
| `sg-kdb` | `5010-5011` depuis `sg-app`; `22` depuis `sg-runner` | IPC kdb limité au backend + admin interne |
| `sg-data` | `6379` depuis `sg-app`; `2049` depuis `sg-kdb` | Redis pour app, EFS pour kdb |
| `sg-runner` | pas d’ingress explicite | Runner orienté sorties |

### 5.4 Gestion des secrets et paramètres sensibles

#### Comment

- **SSM Parameter Store** :
  - `/pv/kdb/host` (`String`),
  - `/pv/kdb/port` (`String`),
  - `/pv/redis/url` (`SecureString`),
  - `/pv/sonar/token` (`SecureString`).
- **Secrets Manager** :
  - `pv/kdb/license`,
  - `pv/gitlab/runner-token` (consommé par rôle runner).

Extrait Ansible :

```yaml
- name: Read SSM parameters
  community.aws.aws_ssm_parameter_store:
    name: "{{ item }}"
```

(`ansible/roles/app/tasks/main.yml`)

#### Pourquoi

- Évite le stockage des secrets en clair dans le code ou les images Docker.
- Permet une rotation indépendante des artefacts applicatifs.
- Réduit la surface d’exposition lors de revues de code et de logs CI.

### 5.5 Points forts sécurité (état actuel)

- **Isolation forte** entre couche publique et couches privées.
- **Rôles IAM par type de machine** avec droits ciblés.
- **State Terraform protégé** (chiffrement + lock + blocage accès public).
- **ECR scan_on_push** activé.
- **Health checks** ALB et conteneurs facilitant la résilience opérationnelle.

### 5.6 Limites actuelles (transparence professionnelle)

#### Limites applicatives

1. **Absence d’AuthN/AuthZ applicative**
   - API et WS ne mettent pas en œuvre de contrôle d’identité/autorisation.
2. **CORS permissif**
   - `Access-Control-Allow-Origin: *` dans `backend/src/server.ts`.
3. **Validation d’entrée minimale**
   - Validation basique de certains champs, mais sans framework centralisé de validation/sanitation.

#### Limites réseau

1. **Egress SG ouvert (`0.0.0.0/0`)** sur plusieurs SG.
2. **SSH management via runner** (pratique mais à renforcer via SSM Session Manager uniquement dans une cible durcie).

### 5.7 Feuille de route sécurité recommandée (priorisée)

#### Priorité 1 — Contrôle d’accès applicatif

- Introduire **AuthN** (OIDC/JWT) pour REST et WS.
- Introduire **AuthZ** (scope/role/asset-level policies).
- Associer la souscription WebSocket à un contexte utilisateur validé.

#### Priorité 2 — Durcissement des interfaces

- Restreindre CORS aux origines autorisées.
- Ajouter rate limiting et protection anti-abus sur endpoints critiques.
- Centraliser validation d’inputs (schémas stricts).

#### Priorité 3 — Durcissement réseau et secrets

- Restreindre egress SG vers destinations nécessaires.
- Harmoniser policy IAM runner et nommage réel des secrets.
- Mettre en place rotation et politique de cycle de vie des secrets.

#### Priorité 4 — Gouvernance et observabilité sécurité

- Corréler logs app + infra (CloudWatch + trace request-id).
- Définir des alertes sécurité ciblées (anomalies trafic, erreurs auth futures).
- Formaliser une baseline de hardening par environnement.

---

## 6. Conclusion

LiveAssetViewer présente une architecture techniquement cohérente avec son objectif : livrer une expérience de visualisation de marché **réactive** sur des flux **temps réel**.  
Le découplage des responsabilités entre moteur data, passerelle backend et frontend est clair et maintenable. Les choix de stack (React/Vite/TypeScript, Express/WebSocket, kdb+/q, IaC modulaire) sont alignés avec le besoin métier de rapidité, de performance et de lisibilité opérationnelle.

Sur la sécurité, la plateforme montre déjà un socle robuste côté infrastructure : segmentation réseau, séparation IAM par rôle, externalisation des secrets. L’étape de maturité suivante est principalement applicative (AuthN/AuthZ, CORS strict, egress restreint), afin de compléter l’excellent travail de cloisonnement infra par une gouvernance d’accès de bout en bout.

En synthèse :

- **Architecture actuelle :** adaptée, pragmatique, performante pour un cas d’usage market data.
- **Niveau de sécurité infra :** bon et structuré.
- **Prochain gain majeur :** renforcer la sécurité applicative pour convergence vers un standard production d’entreprise.

---

## Annexes — Références de fichiers clés

```text
/home/runner/work/LiveAssetViewer/LiveAssetViewer/backend/src/server.ts
/home/runner/work/LiveAssetViewer/LiveAssetViewer/backend/src/kdb/subscriber.ts
/home/runner/work/LiveAssetViewer/LiveAssetViewer/backend/src/kdb/queries.ts
/home/runner/work/LiveAssetViewer/LiveAssetViewer/backend/src/ws/wsServer.ts
/home/runner/work/LiveAssetViewer/LiveAssetViewer/frontend/src/App.tsx
/home/runner/work/LiveAssetViewer/LiveAssetViewer/frontend/src/services/wsClient.ts
/home/runner/work/LiveAssetViewer/LiveAssetViewer/kdb/q/tick.q
/home/runner/work/LiveAssetViewer/LiveAssetViewer/kdb/q/r.q
/home/runner/work/LiveAssetViewer/LiveAssetViewer/kdb/q/bars.q
/home/runner/work/LiveAssetViewer/LiveAssetViewer/kdb/q/feed/synthetic.q
/home/runner/work/LiveAssetViewer/LiveAssetViewer/infra/main.tf
/home/runner/work/LiveAssetViewer/LiveAssetViewer/infra/modules/iam/main.tf
/home/runner/work/LiveAssetViewer/LiveAssetViewer/infra/modules/sg/main.tf
/home/runner/work/LiveAssetViewer/LiveAssetViewer/infra/modules/vpc/main.tf
/home/runner/work/LiveAssetViewer/LiveAssetViewer/infra/modules/ssm/main.tf
/home/runner/work/LiveAssetViewer/LiveAssetViewer/ansible/roles/app/tasks/main.yml
/home/runner/work/LiveAssetViewer/LiveAssetViewer/ansible/roles/kdb/tasks/main.yml
/home/runner/work/LiveAssetViewer/LiveAssetViewer/ansible/roles/runner/tasks/main.yml
```
