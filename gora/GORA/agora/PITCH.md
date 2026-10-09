# Pitch — stand ENS, dimanche matin (3 minutes)

> Règle absolue, du README §10 : la menace ouvre, la cryptographie arrive en
> avant-dernier, comme un détail d'implémentation. Ne JAMAIS ouvrir sur
> « we use ERC-5564 stealth addresses ».

## Le script (anglais, ~3 min à débit calme)

**[Avant de commencer — une action, pas un mot]**
Lance la nomination du poste de démo pour 60 secondes, chrono visible à l'écran 5.

> “Before I start the clock on my pitch, let me start another clock: I'm
> appointing a signer — for sixty seconds. Keep an eye on this timer.”

**1 — La menace** *(0:00–0:25, aucun écran, regard au jury)*

> “Every multisig publishes its signer list. Think about what that means: to
> rob a treasury, you don't attack the cryptography — you look up seven names
> and go after the weakest human. This year, in Europe, that stopped being
> theoretical. Publishing your org chart means publishing a target list.”

**2 — L'idée** *(0:25–0:45)*

> “GORA splits the two things every multisig confuses. Who was *given*
> power: public, named, accountable. And which *address* exercises it:
> mathematically unattributable — even to the other signers. The body is
> public. Attribution is not.”

**3 — ENS est structurel** *(0:45–1:15, écran 1)* ← le critère de la track

> “This is the vault: five seats, five real ENS subnames on Sepolia, threshold
> three of five. All public, on purpose. Now the part that matters for this
> track: **the contract holds no signer list.** To decide who may sign, it
> reads ENS, live. The right to appoint *is* ownership of the parent name. The
> length of a mandate *is* the expiry of a wrapped subname. Remove ENS and
> this product doesn't exist — you'd be rebuilding a hierarchical permission
> system with expiry inside the contract, in worse.”

**4 — Nommer** *(1:15–1:35, écran 2)*

> “I appoint anakin.eth. She published a stealth meta-address in a text record
> on her name. My browser derives a fresh address from it — and see this
> banner: the randomness linking her name to this address exists only in this
> tab, and is destroyed. It never touches the chain.”

**5 — Le point de vue d'Alice** *(1:35–1:55, autre navigateur)*

> “Alice's side. She has received nothing — no token, no message, no
> transaction. She signs one fixed message, scans the public announcements,
> and: ‘you hold seat-4’. Computed, not received.”

**6 — La rotation** *(1:55–2:15, écran 2 puis 3)*

> “Watch the address under her seat. One click — rotated. The old address
> stopped being a signer at transaction speed, because the vault resolves the
> addr record live. And Alice's screen hasn't changed: same seat, same expiry.
> The seat is stable. The key under it is not.”

**7 — Signer et exécuter** *(2:15–2:35, écran 4)*

> “Three seats sign — EIP-712, off-chain. And execution is submitted by *this*
> wallet, which is not a signer. Signer addresses never send transactions, so
> they never need funding — and funding is exactly what deanonymizes stealth
> addresses.”

**8 — Le défi** *(2:35–2:45, écran 5)*

> “Five names. Five addresses. Match them. There is no public data that can.”

**9 — La chute** *(2:45–3:00, le chrono)*

> “Remember the signer I appointed when I started? Time's up. Signature —
> refused. Nobody revoked anything. *Doing nothing* revoked. In GORA,
> power expires by default.
>
> ENS is not a nametag on this product. It is the permission system. Thank you.”

---

## La manière — coaching

**L'ordre est le message.** Menace → séparation des pouvoirs → ENS structurel
→ démo → crypto en détail → chute. Si tu ouvres sur les stealth addresses, le
jury te range dans « encore un projet ERC-5564 » et tu passes ton temps à en
sortir. La crypto n'apparaît qu'au point 7, en une phrase.

**Le chrono d'abord, toujours.** La nomination 60 s AVANT la première phrase.
C'est elle qui donne la chute — sans elle, le pitch finit à plat.

**Débit.** Plus lent que ton envie. Pause d'une seconde après « The body is
public. Attribution is not. » et après « refused ». Ce sont les deux phrases
qu'ils retiendront — laisse-les atterrir.

**Assume les limites avant qu'on te les demande** (§2). Si le temps le permet,
glisse après le point 4 : “One honest limit: the person who appoints knows the
mapping, transiently — with k appointers each knows n over k of it. Killing
that entirely needs a trusted relayer, which we refused.” Un jury technique
note mieux une limite assumée qu'une mitigation bancale.

**La carte maîtresse — à jouer au stand ENS, pas dans le pitch chronométré.**
En déployant samedi soir, on a découvert que le déploiement ENS canonique de
Sepolia n'accepte plus d'enregistrement : son NameWrapper n'est plus contrôleur
du BaseRegistrar (vérifié en `eth_call` brut), la migration v2 a fermé la porte,
et Holesky est éteint. On a donc déployé `@ensdomains/ens-contracts` 1.7.0
**inchangés** sur Sepolia. À dire ainsi :

> “One thing you might want to know: your canonical Sepolia deployment can't
> register new wrapped names any more — NameWrapper isn't a BaseRegistrar
> controller, we checked with a raw eth_call. The v2 migration closed that door
> and Holesky is gone. So we deployed your contracts, unchanged, ourselves.
> Everything you see is real ENS code on a real network.”

Aucune autre équipe ne leur dira ça. C'est la preuve qu'on a travaillé dans le
cambouis — et ça transforme la question « NameWrapper, legacy ou pas ? » en
conversation d'égal à égal.

**Les trois questions qui viendront** (réponses complètes au README §11, à
savoir dire en dix secondes chacune) :
1. *Why not rotate on every resolution?* → CCIP-Read est incompatible avec la
   vérification on-chain dans `execute()` ; et une rotation par le titulaire
   exigerait de financer l'adresse furtive, ce qui la désanonymise.
2. *Which fuses did you burn?* → Pas PARENT_CANNOT_CONTROL, délibérément : la
   rotation et la révocation anticipée sont des opérations du parent.
3. *The appointer knows the mapping, no?* → Oui, c'est irréductible. k
   nommants → n/k correspondances chacun. Le supprimer = relayeur = tiers de
   confiance qu'on refuse.

**Logistique.**
- Vidéo enregistrée AVANT dimanche = ton filet. Si la démo live casse, tu
  bascules sur la vidéo sans t'excuser plus d'une phrase.
- Deux navigateurs déjà ouverts et connectés (toi = admin, l'autre = Alice),
  onglets dans l'ordre des écrans. Partage de connexion du téléphone en
  secours du Wi-Fi du venue.
- Sous-noms pré-créés (raccourci assumé §9) ; il ne reste en live que
  setAddr + assignSeat.
- Répète À VOIX HAUTE trois fois minimum, chronomètre en main. La première
  fois tu seras à 4 min 30 ; la troisième à 3 min.

**Une phrase à garder en réserve pour conclure si on te pousse :**
> “Most projects use ENS to *name* things. GORA uses ENS to *govern*
> things — the namespace is the org chart, ownership is authority, expiry is
> the term limit. That's what else it can do.”
