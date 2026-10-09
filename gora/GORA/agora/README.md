# GORA

**A shared vault whose members are public — but not who acts.**

Originally built for ETHGlobal Lisbon (*Most Creative Use of ENS*), now deployed
on **BOT Chain** — the EVM-compatible L1 for AI agents and DePIN
([botchain.ai](https://www.botchain.ai/en)).

### What it does, in one paragraph

Every multisig publishes its signer list — that is a target list. GORA splits
the two things multisigs confuse: **who was given power** (public, named,
accountable, written in an ENS namespace) and **which address exercises it**
(mathematically unattributable, even to the other signers). Two properties
multisigs don't have: a mandate **expires by itself** — doing nothing revokes —
and the **address can be rotated without breaking the mandate**.

**The contract holds no signer list. It reads ENS, live.** The right to appoint
*is* ownership of the parent name; the length of a mandate *is* the expiry of a
wrapped subname. Remove ENS and the product doesn't exist.

### Live on BOT Chain

| | |
|---|---|
| Chain | BOT Chain mainnet (chain id **677**) — see [dev-docs.botchain.ai](https://dev-docs.botchain.ai/docs/Developers/quick-guide/) |
| **GoraVault** | *filled in after deploy — see `frontend/.env.botchain`* |
| Namespace | `gora.eth` → `treasury.gora.eth` → `seat-1…5` |
| Members | `anakin.eth`, `leia.eth`, `luc.eth`, `obi-wan.eth`, `padme.eth` |
| ENS stack | Our own deployment of `@ensdomains/ens-contracts` 1.7.0, addresses in `.env.botchain` |
| Explorer | [scan.botchain.ai](https://scan.botchain.ai) |

> ⚠️ **Why our own ENS deployment?** BOT Chain doesn't ship with a canonical
> ENS. Solution: deploy `@ensdomains/ens-contracts` 1.7.0 **unchanged** on BOT
> Chain — real ENS code, real network. Same recipe as the original Sepolia
> release; only the chain and brand changed. Bohr testnet (chain id 968) is
> supported too — see [RUNBOOK.md](RUNBOOK.md).

### Tests

`forge test` — 16 · `npm test` — 13 · `npm run test:e2e` — 7 end-to-end steps on
a throwaway chain (appoint → detect → 3 signatures → execute → rotate → expire).

---

**Un coffre partagé dont on connaît les membres, mais pas qui agit.**

La suite de ce document est la spécification complète, en français.

---

## 1. Résumé en une page

Un multisig classique publie la liste de ses signataires. C'est le point faible réel de tout coffre on-chain : on n'attaque pas la cryptographie, on identifie les sept humains et on va chercher le plus fragile. Publier son organigramme, c'est publier une liste de cibles.

GORA sépare deux choses que tout le monde confond aujourd'hui :

- **qui a reçu le pouvoir** → public, nominatif, débattable, inscrit dans un espace de noms ENS ;
- **quelle adresse l'exerce** → mathématiquement inattribuable, y compris pour les autres signataires.

S'y ajoutent deux propriétés que les multisig n'ont pas :

- **l'autorité expire d'elle-même.** Un poste est un sous-nom ENS daté. Ne rien faire révoque.
- **l'adresse tourne sans casser le mandat.** Le poste est stable, la clé qui l'exerce ne l'est pas.

Le contrat ne tient pas de liste interne de signataires : **il lit ENS** pour savoir qui peut signer et jusqu'à quand.

> Le nom dit qui a le pouvoir. Les mathématiques empêchent de savoir qui l'exerce. L'expiration fait que le pouvoir s'éteint tout seul.

### L'invariant qui tient tout

**Une adresse furtive d'GORA signe, elle n'émet jamais de transaction.**

Elle produit une signature EIP-712 hors chaîne ; `execute()` est appelé par n'importe qui, qui paie le gas depuis sa propre adresse. Conséquence : une adresse de signataire n'a jamais besoin d'être financée, donc jamais besoin de recevoir des fonds depuis une adresse connue. C'est le financement qui désanonymise une adresse furtive, et GORA n'en a pas besoin.

Cet invariant est la raison pour laquelle le design tient. Il détermine aussi qui peut faire tourner une adresse (§5.7) et pourquoi une rotation « à chaque résolution » est impossible ici.

---

## 2. Ce que le projet garantit — et ce qu'il ne garantit pas

À lire avant d'écrire une ligne de code. Ces limites doivent être assumées dans le pitch, pas découvertes par un juge.

### Garanti

- Aucun lien entre un nom ENS et une adresse de signature n'existe **sur la chaîne**. Un attaquant qui lit la blockchain — c'est ce qu'un attaquant fait — ne peut pas reconstituer la liste des signataires.
- Un signataire ne peut pas identifier les autres signataires.
- L'expiration est vérifiée à chaque signature. Un poste périmé ne signe plus, sans qu'aucun humain n'ait à intervenir.
- Le droit de nommer est vérifié on-chain contre la propriété du nom parent dans ENS.
- Une adresse de poste peut être remplacée à tout moment sans interrompre le mandat, et l'ancienne cesse d'être signataire à la transaction près (§5.7).
- Aucune adresse de signataire n'a besoin d'être financée. Voir §1.

### Non garanti — à dire soi-même avant qu'on le demande

**Celui qui nomme connaît la correspondance, et c'est irréductible.**

Il produit l'aléa `r`, donc il sait que `anakin.eth` correspond à telle adresse. Ce n'est pas un défaut d'implémentation : le nommant choisit la personne *et* publie l'adresse, il ne peut pas ne pas savoir.

La formulation chiffrée, à donner telle quelle :

> Avec k nommants et n postes, chacun connaît n/k correspondances. Reconstituer le corps exige la collusion des k. Le boucher complètement exige un relayeur — donc un tiers de confiance, qu'on ne voulait pas.

Pourquoi un flux de réclamation ne règle rien : pour que le nommé inscrive lui-même son adresse, il faudrait qu'il émette une transaction depuis cette adresse, donc qu'elle soit financée, donc qu'elle soit liée à lui. On retombe sur l'invariant du §1. Sans relayeur, non.

Côté contrat, passer de k=1 à k>1 est un `mapping(bytes32 => bool) isParentNode` au lieu d'un `immutable`. C'est chiffré, c'est court, et savoir le dire vaut mieux qu'une mitigation bancale.

**L'attribution est élective, pas impossible.**

Un signataire détient sa clé, donc il peut toujours prouver volontairement qu'il a signé. C'est un choix de conception, pas une fuite : GORA empêche un tiers de compiler la liste, il n'empêche pas un membre de se déclarer.

> L'attribution n'est pas impossible. Elle est élective. C'est le signataire qui décide de se révéler, pas l'observateur qui décide de le révéler.

L'écran 4 expose ce choix comme un bouton (§7). Le corollaire à assumer : **on ne peut pas sanctionner individuellement un signataire.** L'unité de responsabilité d'un multisig est le seuil, pas l'individu — savoir *lesquels* des trois ont approuvé n'est exigé par aucune politique, c'est un effet de bord de la façon dont les multisig sont construits.

**Les montants, les dates et les transactions restent publics.** Les adresses furtives cachent l'identité du titulaire, rien d'autre.

**La corrélation reste possible sur la durée.** Une adresse fixe pendant tout un mandat est un pseudonyme persistant : « l'adresse du seat-3 a signé quarante fois ». La rotation (§5.7) casse cette accumulation, elle ne l'annule pas. La corrélation temporelle fine — un signataire qui signe systématiquement dans les dix minutes suivant un message Telegram — reste hors périmètre.

La formulation à ne jamais changer, vraie dans tous les cas :

> Le corps est public. L'attribution ne l'est pas.

---

## 3. Rôles

| Rôle | Qui | Ce qu'il fait |
|---|---|---|
| Autorité de nomination | Détenteur du nom parent (EOA ou exécuteur de DAO) | Crée les postes, nomme, fait tourner les adresses, révoque |
| Signataire | Une personne possédant un nom ENS et une méta-adresse publiée | Détecte sa nomination, signe |
| Observateur | N'importe qui | Lit l'organigramme, ne peut relier noms et adresses |

Il n'y a **aucun système de vote dans GORA**. La délibération se fait là où elle se fait déjà (Snapshot, forum, réunion) ; GORA exécute. Le droit de nommer découle de la propriété du nom parent.

---

## 4. Schéma de nommage ENS

```
gora.eth                     nom racine de l'organisation
└── treasury.gora.eth        le coffre, seuil 3 sur 5
    ├── seat-1.treasury.gora.eth
    ├── seat-2.treasury.gora.eth
    ├── seat-3.treasury.gora.eth
    ├── seat-4.treasury.gora.eth
    └── seat-5.treasury.gora.eth
```

**Règles strictes :**

- Le nom parent (`treasury.gora.eth`) doit être **wrappé** (NameWrapper). Sa propriété est le droit de nommer.
- Chaque poste est un sous-nom **wrappé**, avec une **expiry** portée par le NameWrapper. C'est la source de vérité de l'expiration — le contrat la lit, il ne la duplique pas.
- Le record `addr` de chaque poste pointe vers l'adresse furtive du titulaire. C'est le seul endroit où l'adresse est inscrite.
- Le label d'un poste (`seat-1`) est **fixe et ne dit rien du titulaire**. Ne jamais nommer un poste `anakin`.

### Fuses — décision assumée

**`PARENT_CANNOT_CONTROL` n'est pas brûlé sur les postes.** C'est délibéré : l'émancipation interdirait au parent de reprendre la main avant l'expiration, donc supprimerait à la fois la rotation (§5.7) et la révocation anticipée. Deux fonctionnalités utilisées contre une propriété qui ne sert à rien ici.

Conséquence à assumer : le parent peut réécrire un poste à tout moment. C'est cohérent — le parent *est* l'autorité de nomination. Ce qu'il ne peut pas faire, c'est signer à la place du titulaire.

L'`expiry` est lue brute dans `getData` et renseignée indépendamment des fuses : la logique du contrat tient quel que soit le choix. **Vérifier ce point sur Sepolia avant d'écrire autre chose** (§9, bloc 0).

Réponse à « alors l'expiration n'est pas vraiment ENS, vous lisez juste un entier » :

> Le coffre ne peut pas écrire cet entier. Il est écrit par le NameWrapper, plafonné par l'expiry du parent, et seul le propriétaire du nom peut le prolonger. Le chemin d'écriture est intégralement ENS.

**Contrainte de durée :** l'expiry d'un sous-nom est plafonnée par celle du parent. Enregistrer `gora.eth` pour au moins un an, sinon le cran « 1 an » du curseur de l'écran 2 est écrêté en silence — bug de démo silencieux, donc le pire genre.

### Enregistrements texte utilisés

Sur le nom d'un futur signataire (`anakin.eth`), clé de text record :

```
clé   : stealth-meta-address
valeur: st:eth:0x<P_compressé_33o><V_compressé_33o>     (132 caractères hex après 0x)
```

Cette clé n'est pas un standard ENSIP ratifié à ma connaissance — nous la définissons pour le projet. À mentionner honnêtement au stand : c'est une proposition, pas une norme existante.

Sur le nom **parent** (`treasury.gora.eth`) — et jamais sur un poste :

```
clé   : gora-members
valeur: anakin.eth, leia.eth, luc.eth, obi-wan.eth, padme.eth
```

C'est le registre des membres : public, **en vrac**, au niveau du coffre. On sait qui fait partie du corps ; on ne sait pas qui occupe quel poste.

> ⚠️ Règle absolue : **aucun nom de membre ne doit jamais être attaché à un poste** — ni en text record, ni dans un événement, ni dans l'UI. Un poste porte publiquement son adresse (le contrat en a besoin) : y attacher aussi un nom relierait membre et adresse, ce qui détruirait la promesse centrale du projet (§2). Le registre révèle l'appartenance — c'est voulu, le corps est public — mais jamais l'assignation.
>
> Corollaire assumé : la correspondance membre↔poste n'existe que dans le carnet **local** du nommant (localStorage de son navigateur) — matérialisation honnête de la limite « celui qui nomme sait » (§2).

---

## 5. Spécification cryptographique

Courbe `secp256k1`. Point générateur `G`, ordre `n`. `keccak256` pour tous les hachages. Points sérialisés en **compressé (33 octets)** sauf mention contraire.

### 5.1 Clés d'un signataire

Deux paires de clés, jamais une seule :

```
clé de dépense :  privée p    publique P = p·G
clé de vue     :  privée v    publique V = v·G
```

Méta-adresse publiée = `st:eth:0x` ‖ `P` ‖ `V`.

### 5.2 Dérivation déterministe des clés (côté client)

L'utilisateur ne stocke aucune graine supplémentaire. Les deux clés sont dérivées d'une signature sur un message fixe :

```
message = "GORA key derivation v1"
sig     = personal_sign(message)            // signature EIP-191, déterministe
p       = keccak256(sig ‖ 0x01) mod n
v       = keccak256(sig ‖ 0x02) mod n
```

**Contrainte impérative :** MetaMask produit des signatures déterministes (RFC 6979), donc `sig` est reproductible. Vérifier ce point tôt avec le wallet visé — si le wallet signe de façon non déterministe, tout l'accès est perdu. C'est le tout premier test à faire (§9, bloc 0), pas un test de dimanche.

### 5.3 Nomination — côté de celui qui nomme

Entrée : la méta-adresse `(P, V)` d'Alice, lue dans son text record ENS.

```
1.  r        = aléa cryptographique 32 octets, 0 < r < n     ← crypto.getRandomValues
2.  R        = r·G                                            ← clé éphémère, 33 octets
3.  S        = r·V                                            ← secret partagé
4.  s        = keccak256(S_compressé)
5.  P_stealth = P + s·G                                       ← addition de points
6.  adresse  = 20 derniers octets de keccak256(P_stealth_non_compressé[1:])
7.  viewTag  = s[0]                                           ← premier octet
8.  DÉTRUIRE r                                                ← non négociable
```

**`r` ne doit jamais quitter le navigateur, jamais être journalisé, jamais être écrit sur la chaîne.** Quiconque connaît `r` peut recalculer `S = r·V`, donc l'adresse, donc la correspondance. C'est la raison pour laquelle **cette dérivation ne peut pas être faite par un contrat** : tout ce qu'un contrat calcule est public.

Publié on-chain : `adresse`, `R`, `viewTag`. Jamais `r`, jamais `S`, jamais `s`.

### 5.4 Détection — côté du signataire

Pour chaque événement `SeatAssigned` du contrat :

```
1.  S = v·R
2.  s = keccak256(S_compressé)
3.  si s[0] ≠ viewTag  →  passer à l'événement suivant
4.  recalculer P + s·G et son adresse ; comparer à stealthAddress
5.  si égal : le poste est à moi
```

`v·R = v·(r·G) = vr·G = r·(v·G) = r·V` — c'est bien le même point.

> ⚠️ **Piège de rotation.** Un poste peut avoir plusieurs événements `SeatAssigned`. Le scan doit retenir, par nœud, **le plus récent** — pas le premier trouvé. Sinon un titulaire dont l'adresse a tourné recalcule une clé périmée et sa signature est rejetée. C'est le bug le plus probable de tout le projet.

### 5.5 Signature — côté du signataire

```
p_stealth = (p + s) mod n
```

Vérification : `p_stealth·G = (p+s)·G = p·G + s·G = P + s·G = P_stealth` ✓

Cette clé signe le message EIP-712 de la transaction. Elle n'est jamais persistée : recalculée à la volée à chaque session. **Elle ne signe jamais de transaction** (§1) — uniquement des messages typés.

### 5.6 Sur le scan

Le scan global est le problème connu d'ERC-5564 : une multiplication scalaire par annonce du réseau entier. **Ce problème n'existe pas ici** : un signataire ne balaie que les événements `SeatAssigned` d'un seul contrat, soit une poignée. Ne pas construire d'optimisation d'index — c'est du temps perdu pour ce périmètre.

### 5.7 Rotation d'adresse

Un mandat dure ; l'adresse qui l'exerce n'a aucune raison de durer autant.

```
même nom de poste, nouveau r
1.  dériver une nouvelle adresse furtive (§5.3) à partir de la même méta-adresse (P, V)
2.  setAddr(node, nouvelle_adresse)
3.  assignSeat(node, R', viewTag')                   ← même nœud, nouvelle clé éphémère
```

Ce qui se passe :

- l'ancienne adresse **cesse d'être signataire à la transaction près**, parce que `isActiveSigner` résout `addr(node)` en direct ;
- le titulaire détecte le nouvel événement, recalcule `p_stealth`, et **ne s'aperçoit de rien** — son poste et son expiration n'ont pas bougé ;
- **le contrat n'a pas une ligne à changer.** `assignSeat` ré-émet `SeatAssigned` sans condition ; le garde `isSeat` protège seulement le push dans le tableau.

> Le poste est stable. L'adresse en dessous ne l'est pas. Le mandat survit à la rotation parce que l'autorité est portée par le nom, pas par la clé.

**Qui fait tourner, et pourquoi pas le titulaire.** La rotation est une opération du parent. Le titulaire ne peut pas la faire lui-même : il faudrait qu'il écrive le record `addr`, donc qu'il émette une transaction, donc que son adresse furtive soit financée — ce qui la lierait à lui (§1). La rotation par le parent n'ajoute aucune fuite : le nommant connaissait déjà la correspondance (§2).

**C'est aussi la réponse à « pourquoi pas une rotation à chaque résolution ? ».** Un résolveur rotatif (ENSIP-10 / CCIP-Read) renverrait une adresse différente à chaque lecture, mais `execute()` vérifie les signataires **on-chain** : un `OffchainLookup` ne peut pas être résolu au milieu d'un appel `view`. La rotation à la résolution et la vérification on-chain sont incompatibles. On a choisi la vérification.

**Deux contraintes opérationnelles :**

- ne pas faire tourner pendant une collecte de signatures en cours — les signatures déjà déposées sous l'ancienne adresse deviennent invalides ;
- le scan de détection doit prendre le dernier événement par nœud (§5.4).

---

## 6. Contrats

Solidity `^0.8.24`. Un seul contrat, `GoraVault`.

### 6.1 Dépendances externes

À récupérer sur la documentation ENS officielle pour le réseau visé — **ne pas inventer ces adresses** :

| Contrat | Rôle | Adresse Sepolia |
|---|---|---|
| `ENSRegistry` | `resolver(node)` | à récupérer sur docs.ens.domains |
| `NameWrapper` | `getData(id)` → owner, fuses, expiry | à récupérer sur docs.ens.domains |
| Résolveur public | `addr(node)`, `text(node,key)` | lu dynamiquement via le registre |

### 6.2 Interfaces lues

```solidity
interface IENSRegistry {
    function resolver(bytes32 node) external view returns (address);
}

interface IAddrResolver {
    function addr(bytes32 node) external view returns (address payable);
}

interface INameWrapper {
    function getData(uint256 id)
        external view
        returns (address owner, uint32 fuses, uint64 expiry);
    function ownerOf(uint256 id) external view returns (address);
}
```

### 6.3 GoraVault

```solidity
contract GoraVault {

    bytes32 public immutable parentNode;   // namehash("treasury.gora.eth")
    uint256 public immutable threshold;    // 3
    uint256 public nonce;

    bytes32[] public seatNodes;            // namehash de chaque poste enregistré
    mapping(bytes32 => bool) public isSeat;

    /// AUCUN nom de membre dans l'événement — délibéré (§4) : le lier au nœud
    /// relierait publiquement un membre à une adresse.
    event SeatAssigned(
        bytes32 indexed node,
        address indexed stealthAddress,
        bytes   ephemeralPubKey,   // R, 33 octets compressés
        uint8   viewTag
    );
    event SeatRemoved(bytes32 indexed node);
    event Executed(bytes32 indexed digest, address to, uint256 value);

    error NotNameOwner();
    error SeatExpired(bytes32 node);
    error NotASigner(address who);
    error DuplicateSigner(address who);
    error ThresholdNotMet(uint256 got, uint256 need);
    error BadNonce();

    // ——— nomination et rotation ————————————————————————————

    /// @notice Enregistre ou fait tourner un poste. Le sous-nom ENS doit déjà
    ///         exister, être wrappé, non expiré, et son record addr doit déjà
    ///         pointer vers l'adresse furtive. Le contrat vérifie, il ne crée pas.
    /// @dev    Rappelé sur un nœud déjà enregistré, ceci EST la rotation (§5.7) :
    ///         nouvelle clé éphémère, nouvel événement, aucun état à modifier.
    function assignSeat(
        bytes32 node,
        bytes calldata ephemeralPubKey,
        uint8 viewTag
    ) external onlyParentOwner {
        require(ephemeralPubKey.length == 33, "R must be 33 bytes");
        (, , uint64 expiry) = NAME_WRAPPER.getData(uint256(node));
        if (expiry <= block.timestamp) revert SeatExpired(node);

        address a = _resolve(node);
        require(a != address(0), "seat has no addr record");

        if (!isSeat[node]) { isSeat[node] = true; seatNodes.push(node); }
        emit SeatAssigned(node, a, ephemeralPubKey, viewTag);
    }

    function removeSeat(bytes32 node) external onlyParentOwner { /* … */ }

    modifier onlyParentOwner() {
        if (NAME_WRAPPER.ownerOf(uint256(parentNode)) != msg.sender)
            revert NotNameOwner();
        _;
    }

    // ——— lecture de l'état ————————————————————————————————

    /// @notice Un poste est actif si son nom n'est pas expiré ET
    ///         si son record addr résout vers une adresse non nulle.
    /// @dev    La résolution est faite à la lecture, jamais mise en cache.
    ///         C'est ce qui rend la rotation instantanée : dès que le record
    ///         addr change, l'ancienne adresse n'est plus signataire.
    function isActiveSigner(address who) public view returns (bool) {
        for (uint256 i; i < seatNodes.length; ++i) {
            bytes32 node = seatNodes[i];
            (, , uint64 expiry) = NAME_WRAPPER.getData(uint256(node));
            if (expiry <= block.timestamp) continue;
            if (_resolve(node) == who) return true;
        }
        return false;
    }

    function activeSignerCount() external view returns (uint256);

    function _resolve(bytes32 node) internal view returns (address) {
        address r = ENS.resolver(node);
        if (r == address(0)) return address(0);
        return IAddrResolver(r).addr(node);
    }

    // ——— exécution ————————————————————————————————————————

    function execute(
        address to,
        uint256 value,
        bytes calldata data,
        uint256 expectedNonce,
        bytes[] calldata signatures
    ) external {
        if (expectedNonce != nonce) revert BadNonce();
        bytes32 digest = _digest(to, value, data, expectedNonce);

        address last;                       // tri croissant = anti-doublon O(n)
        uint256 valid;
        for (uint256 i; i < signatures.length; ++i) {
            address rec = ECDSA.recover(digest, signatures[i]);
            if (rec <= last) revert DuplicateSigner(rec);
            if (!isActiveSigner(rec)) revert NotASigner(rec);
            last = rec;
            ++valid;
        }
        if (valid < threshold) revert ThresholdNotMet(valid, threshold);

        ++nonce;
        (bool ok, ) = to.call{value: value}(data);
        require(ok, "call failed");
        emit Executed(digest, to, value);
    }
}
```

**Trois lignes à souligner devant les juges :**

1. `onlyParentOwner` — le droit de nommer n'est pas une liste dans le contrat, c'est la propriété d'un nom ENS.
2. la lecture de `expiry` dans `NameWrapper` — la durée d'un mandat n'est pas un champ du contrat, c'est l'expiry d'un nom ENS.
3. `_resolve(node)` appelé **à chaque vérification** — c'est ce qui rend la rotation gratuite et instantanée.

Le contrat ne tient aucune liste d'autorité : il interroge ENS. Retire ENS et il faut réécrire un système de permissions hiérarchiques avec expiration à l'intérieur du contrat.

Noter que `execute()` n'exige rien du signataire sinon une signature valide : **n'importe qui peut soumettre le lot et payer le gas**. C'est l'invariant du §1 rendu exécutable.

### 6.4 EIP-712

```
domaine : { name: "GORA", version: "1", chainId, verifyingContract }
type    : Execute(address to,uint256 value,bytes32 dataHash,uint256 nonce)
```

`dataHash = keccak256(data)`. Les signatures doivent être passées **triées par adresse recouvrée croissante** — le contrat s'en sert pour rejeter les doublons en une passe.

### 6.5 Tests Foundry minimaux

- poste expiré rejeté ;
- doublon de signature rejeté ;
- non-propriétaire du nom parent rejeté sur `assignSeat` ;
- **après rotation, l'ancienne adresse est rejetée et la nouvelle est acceptée** ;
- seuil non atteint rejeté.

---

## 7. Frontend

React + Vite + TypeScript + Tailwind + wagmi/viem. Cinq écrans, pas un de plus.

### Écran 1 — Organigramme (public, sans wallet)

Deux blocs volontairement **disjoints** : le registre des membres (`gora-members` du parent, en vrac), puis les postes — pour chaque poste : label, état (actif / expiré), date d'expiration, adresse résolue, **fuses brûlés**, **nombre de rotations** (compte des événements `SeatAssigned` du nœud). Aucun nom à côté d'un poste (§4).

Afficher les fuses coûte quinze minutes et fait disparaître la question « vous avez brûlé quoi ? » avant qu'elle soit posée. C'est le signal le plus court qu'on a lu le NameWrapper au lieu de l'appeler au hasard.

Aucune correspondance nom → adresse affichée, et c'est le sujet.

### Écran 2 — Nommer *(visible seulement si le wallet connecté possède le nom parent)*

1. champ « nom ENS du signataire » → résolution → lecture du text record `stealth-meta-address` ; erreur explicite si absent
2. choix du poste libre + durée (curseur : 24 h / 7 j / 30 j / 1 an — écrêté à l'expiry du parent, l'afficher)
3. dérivation locale (§5.3), affichage de l'adresse qui sera inscrite
4. transactions : création du sous-nom wrappé avec expiry → `setAddr` → `assignSeat`
5. `r` effacé de la mémoire immédiatement après l'étape 3

Afficher pendant l'opération un bandeau : *« l'aléa qui relie ce nom à cette adresse n'existe que dans cet onglet et sera détruit »*. C'est un élément de démo autant que d'UX.

**Bouton « faire tourner l'adresse de ce poste » sur chaque poste occupé.** Rejoue les étapes 3 → 5 sur le même nœud, sans toucher au nom ni à l'expiration : `setAddr` puis `assignSeat` (§5.7). Deux transactions, zéro changement de contrat. Afficher l'ancienne et la nouvelle adresse côte à côte, avec la mention « l'ancienne n'est plus signataire ».

Griser le bouton s'il existe des signatures en attente sur le nonce courant.

### Écran 3 — Mon poste

Connexion → signature de dérivation (§5.2) → scan des événements `SeatAssigned` → **retenir le plus récent par nœud** (§5.4) → si un poste correspond, affichage : « vous détenez `seat-3`, expire le … ».

Sinon : « aucun poste détecté ». Insister visuellement sur le fait que l'utilisateur **n'a rien reçu** : c'est calculé.

Afficher l'adresse courante et le nombre de rotations subies. Après une rotation, cet écran doit continuer d'afficher le même poste avec une adresse différente — c'est la démonstration visuelle que le mandat survit à la clé.

### Écran 4 — Signer

Liste des transactions en attente (stockage local ou simple JSON partagé — pas de backend). Bouton signer → recalcul de `p_stealth` → signature EIP-712 → ajout au lot. Quand le seuil est atteint, bouton exécuter. N'importe quel wallet peut exécuter et payer le gas — le montrer, en exécutant depuis un wallet qui n'est pas signataire.

**Bouton « prouver que j'ai signé » (optionnel, à faire seulement si les écrans 1 à 3 tournent).** Produit deux signatures : une avec la clé principale résolue par `anakin.eth` déclarant que l'adresse furtive lui appartient, une avec la clé furtive sur le digest. Vérifiable par n'importe qui en deux `ecrecover`.

C'est la §2 rendue tangible : l'attribution existe, elle appartient au signataire.

### Écran 5 — Le défi *(l'écran de démo)*

Deux colonnes : à gauche les noms sous lesquels on a nommé, à droite les adresses réellement inscrites. Un bouton « faire correspondre » qui affiche : *« il n'existe aucune donnée publique permettant cette correspondance »*. Un compte à rebours vers l'expiration du poste de démonstration.

---

## 8. Stack et dépendances

```
Contrats    Foundry, Solidity ^0.8.24, OpenZeppelin (ECDSA)
Front       React 18, Vite, TypeScript, Tailwind, wagmi v2, viem v2
Crypto      @noble/secp256k1  (multiplication scalaire, addition de points)
            viem (keccak256, encodage EIP-712, namehash)
ENS         viem/ens (getEnsText, getEnsAddress) + appels directs NameWrapper
Réseau      Sepolia — ENS et NameWrapper y sont déployés, les noms y sont réels
```

Ne pas ajouter de backend. Tout est client + chaîne, ce qui est aussi un argument de pitch.

---

## 9. Plan de construction

Par ordre de priorité, pas par jour. Si un bloc n'est pas fait, il passe devant tout le reste — y compris devant du code déjà commencé.

**Bloc 0 — bloquant, rien d'autre avant**
- Enregistrer `gora.eth` sur Sepolia (**au moins un an**), wrapper, créer `treasury.gora.eth`
- Créer manuellement un sous-nom avec expiry, vérifier qu'on lit bien `expiry` via `getData` **sans brûler PCC** (§4)
- **Vérifier le déterminisme de `personal_sign`** sur le wallet visé (§5.2) — dix minutes, et tout l'accès en dépend

**Bloc 1 — la cryptographie, isolée**
- Module TS pur : dériver `(p,v)`, générer, détecter, recalculer `p_stealth`
- Test aller-retour : générer une adresse, la retrouver par scan, signer avec, vérifier `ecrecover`
- Test de rotation : deux `SeatAssigned` sur le même nœud, le scan retient le second
- Ne pas toucher à l'UI tant que ces deux tests ne passent pas

**Bloc 2 — le contrat**
- `GoraVault` + tests Foundry (§6.5)
- Déploiement BOT Chain

**Bloc 3 — le jalon critique**
- Écrans 2 et 3 : nommer, puis détecter depuis un autre navigateur
- **Enregistrer la vidéo dès que ce bloc passe**, même si le reste n'existe pas. On la refait plus tard si mieux. Une vidéo médiocre bat une vidéo inexistante.

**Bloc 4 — ce qui fait gagner**
- Bouton de rotation (écran 2) — 45 min, c'est le meilleur rapport temps/points du projet
- Fuses affichés (écran 1) — 15 min
- Écran 4 puis écran 5

**Bloc 5 — seulement si en avance**
- Bouton « prouver que j'ai signé »
- Multi-parent (k>1 nommants, §2)

**Raccourci assumé :** pré-créer les cinq sous-noms de postes avant la démo et ne faire en direct que `setAddr` + `assignSeat`. Deux transactions au lieu de trois, deux points de panne en moins. Ce ne sont pas des valeurs codées en dur — les noms sont réels, la résolution est réelle. Garder un poste à créer en direct pour la démo d'expiration à 60 secondes.

---

## 10. Script de démonstration (3 minutes)

L'ordre compte. **Les primitifs cryptographiques arrivent en dernier**, comme un détail d'implémentation — jamais en ouverture.

1. **La menace** *(sans écran, 20 secondes)* — « Un multisig publie la liste de ses signataires. On n'attaque pas la cryptographie d'un coffre : on identifie les sept humains et on va chercher le plus fragile. Publier son organigramme, c'est publier une liste de cibles. »
2. **L'organigramme** — cinq postes, cinq noms lisibles, seuil 3 sur 5, fuses et expirations visibles. « Tout ceci est public, et c'est voulu. »
3. **Le contrat ne tient aucune liste** — montrer `onlyParentOwner` et la lecture de `expiry`. « Le droit de nommer est la propriété d'un nom. La durée d'un mandat est l'expiry d'un nom. Retirez ENS, il faut réécrire tout ça dans le contrat. »
4. **Nommer** — on nomme `anakin.eth` sur `seat-4`, durée 24 h. Montrer le bandeau sur la destruction de `r`.
5. **Le point de vue d'Alice** — autre navigateur, autre wallet, jamais rien reçu. Elle se connecte : « vous détenez `seat-4` ».
6. **La rotation** — on fait tourner l'adresse de `seat-4` en direct. L'ancienne adresse est rejetée par `isActiveSigner`. L'écran d'Alice affiche toujours `seat-4`. « Le poste est stable, l'adresse en dessous ne l'est pas. »
7. **Signer** — Alice signe, deux autres signent, exécution depuis un wallet qui n'est pas signataire. « Aucune adresse de signataire n'a jamais eu besoin d'être financée. »
8. **Le défi** — écran 5. « Cinq noms à gauche, cinq adresses à droite. Faites correspondre. »
9. **L'expiration** — nommer quelqu'un pour 60 secondes au tout début du pitch, laisser tourner, retenter une signature en direct : refusée. « Personne n'a rien révoqué. Le pouvoir s'est éteint tout seul. »

Les points 6 et 9 sont les deux meilleurs moments. Le 9 est la chute : préparer le chronomètre en premier plan et lancer le compte à rebours avant le point 1.

---

## 11. Questions attendues et réponses

**« En quoi ENS améliore le produit ? »**
Le contrat ne tient aucune liste d'autorité. Le droit de nommer est la propriété d'un nom, la durée d'un mandat est l'expiry d'un nom, l'organigramme est l'espace de noms, et la rotation d'adresse est une écriture de record. Sans ENS on réécrit tout ça dans le contrat, en moins lisible.

**« Vous avez fait deux des trois exemples de notre énoncé. »**
Les primitifs, oui. L'usage, non : ils servent ici à porter une **structure d'autorité**, pas un annuaire ni des paiements. Et on n'a volontairement pas fait le résolveur rotatif que vous suggérez — voir la question suivante.

**« Pourquoi pas une rotation à chaque résolution ? »**
Parce qu'un résolveur rotatif (CCIP-Read) est incompatible avec la vérification on-chain : `execute()` ne peut pas résoudre un `OffchainLookup` au milieu d'un appel `view`. On a choisi la vérification. La rotation existe quand même, déclenchée par le parent, sans changement de contrat (§5.7). Et elle ne peut pas être déclenchée par le titulaire : il faudrait que son adresse furtive émette une transaction, donc qu'elle soit financée, donc qu'elle soit liée à lui.

**« Quels fuses avez-vous brûlés ? »**
Pas `PARENT_CANNOT_CONTROL` sur les postes, délibérément : émanciper un poste interdirait la rotation et la révocation anticipée, qui sont des opérations du parent. Le parent *est* l'autorité de nomination, il est normal qu'il garde la main.

**« Alors l'expiration n'est pas vraiment ENS, vous lisez un entier. »**
Le coffre ne peut pas écrire cet entier. Il est écrit par le NameWrapper, plafonné par l'expiry du parent, et seul le propriétaire du nom peut le prolonger. Le chemin d'écriture est intégralement ENS.

**« Celui qui nomme ne connaît-il pas la correspondance ? »**
Si, et c'est irréductible : il choisit la personne et publie l'adresse. Avec k nommants et n postes, chacun en connaît n/k ; il faut la collusion des k pour reconstituer le corps. Le boucher complètement exige un relayeur, donc un tiers de confiance. Côté contrat, k>1 est un mapping au lieu d'un immutable.

**« Comment sanctionner le signataire qui a approuvé une mauvaise transaction ? »**
On ne le sanctionne pas individuellement, et c'est le prix assumé. L'unité de responsabilité d'un multisig est le seuil, pas l'individu — savoir *lesquels* des trois ont approuvé n'est exigé par aucune politique, c'est un effet de bord de la construction habituelle. Le corps répond collectivement, et un mandat qui ne convient plus ne se révoque même pas : il ne se renouvelle pas. Cela dit, l'attribution reste possible : elle est élective, à l'initiative du signataire (bouton de l'écran 4).

**« ERC-6538 ne fait-il pas déjà la découverte de méta-adresse ? »**
Si, et nous ne prétendons pas le contraire. Ce n'est pas là qu'ENS sert : il porte la structure d'autorité, pas l'annuaire.

**« Pourquoi pas des preuves à divulgation nulle ? »**
Ni circuit, ni trusted setup, ni temps de preuve, ni ensemble d'anonymat. Et aucun mélange de fonds, donc aucun rapprochement possible avec Tornado Cash.

**« Y a-t-il un vote ? »**
Non, et c'est délibéré. La délibération se fait où elle se fait déjà. GORA exécute.

**« Et ensuite ? »**
Multi-parent pour fragmenter la connaissance des nommants. Rotation automatique par époques plutôt que manuelle. Le nom parent détenu par un exécuteur de DAO plutôt qu'un EOA.

---

## 12. Checklist de soumission

- [ ] Démo fonctionnelle sur Sepolia, **aucune valeur codée en dur** — noms réels, résolution réelle
- [ ] Vidéo enregistrée **dès que le bloc 3 passe**, pas à la fin (les démos en direct tombent en panne)
- [ ] Lien de démo publique
- [ ] Ce README traduit en anglais pour la soumission
- [ ] Code source public
- [ ] Présence physique au stand ENS dimanche matin
- [ ] Pitch répété à voix haute au moins trois fois, **dans l'ordre du §10** — menace d'abord, cryptographie en dernier
- [ ] Réponses des §11 sur les fuses, la rotation et le nommant sues par cœur — ce sont les trois questions qui viendront

---

## 13. Hors périmètre — et pourquoi

Ne pas construire ce week-end. Chaque ligne est une réponse en dix secondes si la question vient.

| Écarté | Raison à donner |
|---|---|
| Résolveur rotatif CCIP-Read | `OffchainLookup` ne se résout pas dans un `view` appelé par `execute()` |
| Flux de réclamation par le nommé | Exigerait de financer l'adresse furtive, ce qui la désanonymise |
| Preuves à divulgation nulle | Ni circuit, ni trusted setup, ni ensemble d'anonymat, pour un gain nul ici |
| Système de vote | La délibération se fait ailleurs ; GORA exécute |
| Rotation automatique par époques | La rotation manuelle démontre déjà la propriété ; l'automatisation est du confort |
| Index privé de notifications | Une poignée d'événements sur un seul contrat, le scan naïf suffit |
| Multi-chaînes, ERC-4337, récupération sociale | Hors sujet pour la track |

Aucune de ces pistes ne doit consommer une heure avant dimanche.
