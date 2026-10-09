# GORA — frontend

React 18 + Vite + TypeScript + Tailwind v4 + wagmi v2/viem v2.

Le concept du projet est dans [../README.md](../README.md) — lis au moins les
§1, §2 et §7 avant de toucher aux écrans. Le §7 décrit les 5 écrans : **il n'y
en a pas un de plus**, c'est une contrainte assumée.

## Démarrage rapide

```bash
npm install

# terminal 1 — chaîne locale jetable
anvil

# terminal 2 — déploie les contrats mockés, nomme 5 membres, écrit .env.local
npm run seed

# puis
npm run dev        # http://localhost:5173
```

Aucun wallet requis pour les écrans 1 (Organigramme) et 5 (Le défi).
Pour les écrans 2-4, il faut un wallet injecté (Rabby/MetaMask) connecté —
les comptes de dev sont les wallets anvil (mnemonic public `test test … junk`,
admin = index 0, membres = 1 à 5).

## Tests — à lancer avant chaque push

```bash
npm test           # crypto : 13 tests
npm run test:e2e   # bout-en-bout sur anvil : 7 étapes (lance son propre anvil sur 8546)
npx tsc --noEmit   # typecheck
```

## Structure

```
src/
├── config.ts        toute la config vient de l'env (.env.local) — RIEN en dur
├── abi.ts           ABIs minimales (vault + ENS)
├── wagmi.ts         chaînes et connecteurs
├── session.tsx      clés dérivées + postes détectés — EN MÉMOIRE UNIQUEMENT
├── lib/
│   ├── stealth.ts   ⚠️ cryptographie (§5 du README) — ne pas modifier sans relancer npm test
│   ├── scan.ts      ⚠️ détection, dernier événement par nœud (§5.4) — idem
│   ├── chain.ts     lectures on-chain partagées
│   └── pending.ts   transactions en attente (localStorage + export/import)
└── screens/         un fichier par écran, numérotés comme le README §7
```

## Règles du projet

- **Pas de backend.** Tout est client + chaîne (argument de pitch).
- **Aucune valeur codée en dur** — adresses et noms viennent de l'env
  (critère de qualification de la track ENS).
- Les deux fichiers marqués ⚠️ sont couverts par les tests : n'importe quel
  changement dedans doit garder `npm test` et `npm run test:e2e` verts.
- Les textes des écrans font partie du pitch — les reformulations sont
  bienvenues, mais garder les messages clés (bandeau de destruction de r,
  « calculé, pas reçu », « le corps est public, l'attribution ne l'est pas »).
